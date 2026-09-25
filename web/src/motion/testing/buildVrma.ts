/**
 * テスト・性能確認用に、毎フレームのキーを持つ VRMA(glb)をメモリ上で組み立てる。
 * 静止姿勢はすべて単位回転(T ポーズ相当)、Hips は高さ restHipsY。依存なしで Node からも直接実行できる
 */

export interface VrmaTrackSpec {
  /** VRM Humanoid のボーン名 */
  bone: string
  /** フレーム f の回転 [x, y, z, w] */
  rotation: (f: number) => [number, number, number, number]
}

export interface BuildVrmaOptions {
  fps: number
  frameCount: number
  bones: VrmaTrackSpec[]
  /** フレーム f の Hips 位置。省略時は位置トラックなし */
  hipsPosition?: (f: number) => [number, number, number]
  /** 表情名 → フレーム f の値 */
  expressions?: Record<string, (f: number) => number>
  restHipsY?: number
}

const PRESET_EXPRESSIONS = new Set([
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'aa', 'ih', 'ou', 'ee', 'oh',
  'blink', 'blinkLeft', 'blinkRight', 'lookUp', 'lookDown', 'lookLeft', 'lookRight', 'neutral',
])

export function buildVrma(options: BuildVrmaOptions): ArrayBuffer {
  const { fps, frameCount, bones } = options
  const restHipsY = options.restHipsY ?? 1
  const chunks: Float32Array[] = []
  let byteOffset = 0
  const bufferViews: object[] = []
  const accessors: object[] = []

  const addAccessor = (data: Float32Array, type: 'SCALAR' | 'VEC3' | 'VEC4', withMinMax = false): number => {
    chunks.push(data)
    bufferViews.push({ buffer: 0, byteOffset, byteLength: data.byteLength })
    byteOffset += data.byteLength
    const count = data.length / (type === 'SCALAR' ? 1 : type === 'VEC3' ? 3 : 4)
    const accessor: Record<string, unknown> = { bufferView: bufferViews.length - 1, componentType: 5126, count, type }
    if (withMinMax) {
      accessor.min = [data[0]]
      accessor.max = [data[data.length - 1]]
    }
    accessors.push(accessor)
    return accessors.length - 1
  }

  const times = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) times[f] = f / fps
  const timeAccessor = addAccessor(times, 'SCALAR', true)

  // ノード: 0 = hips、以降は hips の子として各ボーン、最後に表情ノード
  const nodes: Record<string, unknown>[] = [{ name: 'hips', translation: [0, restHipsY, 0], children: [] as number[] }]
  const humanBones: Record<string, { node: number }> = { hips: { node: 0 } }
  for (const spec of bones) {
    if (spec.bone === 'hips') continue
    nodes.push({ name: spec.bone, translation: [0, 0.1, 0] })
    humanBones[spec.bone] = { node: nodes.length - 1 }
    ;(nodes[0].children as number[]).push(nodes.length - 1)
  }
  const expressionNames = Object.keys(options.expressions ?? {})
  const preset: Record<string, { node: number }> = {}
  const custom: Record<string, { node: number }> = {}
  for (const name of expressionNames) {
    nodes.push({ name: `expression_${name}` })
    ;(PRESET_EXPRESSIONS.has(name) ? preset : custom)[name] = { node: nodes.length - 1 }
  }

  const channels: object[] = []
  const samplers: object[] = []
  const addChannel = (node: number, path: 'rotation' | 'translation', output: number) => {
    samplers.push({ input: timeAccessor, output, interpolation: 'LINEAR' })
    channels.push({ sampler: samplers.length - 1, target: { node, path } })
  }

  for (const spec of bones) {
    const data = new Float32Array(frameCount * 4)
    for (let f = 0; f < frameCount; f++) data.set(spec.rotation(f), f * 4)
    addChannel(humanBones[spec.bone].node, 'rotation', addAccessor(data, 'VEC4'))
  }
  if (options.hipsPosition) {
    const data = new Float32Array(frameCount * 3)
    for (let f = 0; f < frameCount; f++) data.set(options.hipsPosition(f), f * 3)
    addChannel(0, 'translation', addAccessor(data, 'VEC3'))
  }
  for (const name of expressionNames) {
    const fn = options.expressions![name]
    const data = new Float32Array(frameCount * 3)
    for (let f = 0; f < frameCount; f++) data[f * 3] = fn(f)
    const node = (preset[name] ?? custom[name]).node
    addChannel(node, 'translation', addAccessor(data, 'VEC3'))
  }

  const rootNodes = [0, ...expressionNames.map((_, i) => bones.filter((b) => b.bone !== 'hips').length + 1 + i)]
  const json = {
    asset: { version: '2.0', generator: 'MotionEditor test buildVrma' },
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: { humanBones },
        expressions: { preset, custom },
      },
    },
    scene: 0,
    scenes: [{ nodes: rootNodes }],
    nodes,
    buffers: [{ byteLength: byteOffset }],
    bufferViews,
    accessors,
    animations: [{ channels, samplers }],
  }

  const pad4 = (n: number) => (n + 3) & ~3
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonLen = pad4(jsonBytes.length)
  const binLen = pad4(byteOffset)
  const total = 12 + 8 + jsonLen + 8 + binLen
  const out = new ArrayBuffer(total)
  const view = new DataView(out)
  const u8 = new Uint8Array(out)
  view.setUint32(0, 0x46546c67, true) // 'glTF'
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, jsonLen, true)
  view.setUint32(16, 0x4e4f534a, true) // 'JSON'
  u8.set(jsonBytes, 20)
  u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen)
  const binStart = 20 + jsonLen
  view.setUint32(binStart, binLen, true)
  view.setUint32(binStart + 4, 0x004e4942, true) // 'BIN'
  let o = binStart + 8
  for (const c of chunks) {
    u8.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), o)
    o += c.byteLength
  }
  return out
}

/** VRM Humanoid の全ボーン名(指・つま先を含む 55 本) */
export const ALL_HUMAN_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftEye', 'rightEye', 'jaw',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  ...['left', 'right'].flatMap((side) =>
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].flatMap((finger) =>
      (finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']).map(
        (joint) => `${side}${finger}${joint}`,
      ),
    ),
  ),
]

/** 軸 axis まわりに angle ラジアン回す単位クォータニオン */
export function axisAngle(axis: [number, number, number], angle: number): [number, number, number, number] {
  const len = Math.hypot(...axis) || 1
  const s = Math.sin(angle / 2) / len
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/**
 * Pose2Clip 由来の VRMA を模した、全ボーンが毎フレーム動くモーション(既定 826 フレーム・30fps)
 */
export function buildLongVrma(frameCount = 826, fps = 30): ArrayBuffer {
  return buildVrma({
    fps,
    frameCount,
    bones: ALL_HUMAN_BONES.map((bone, i) => ({
      bone,
      rotation: (f) => {
        const t = f / fps
        // ボーンごとに周期と振幅を変えた揺れ + 小さなノイズ(推定由来のジッタ相当)
        const angle = 0.4 * Math.sin(t * (0.7 + (i % 7) * 0.3) + i) + 0.01 * Math.sin(f * 1.7 + i * 3.1)
        return axisAngle([Math.sin(i), Math.cos(i * 1.3), 0.5], angle)
      },
    })),
    hipsPosition: (f) => [0.2 * Math.sin(f / 60), 1 + 0.03 * Math.sin(f / 9), 0.1 * Math.cos(f / 80)],
    expressions: {
      happy: (f) => 0.5 + 0.5 * Math.sin(f / 40),
      blink: (f) => (f % 90 < 6 ? 1 : 0),
    },
  })
}
