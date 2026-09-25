import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import type {
  BakedSource,
  MotionDocument,
  PositionKey,
  ReduceTolerance,
  RotationKey,
  ScalarKey,
} from './MotionDocument'
import { lerp, quatAngle, slerpInto } from './math'

/**
 * Ramer–Douglas–Peucker でキーを残すフレームを決める。
 * 区間 [a, b] の両端キーで補間した値と生データの誤差の最大が tol を超えたら、その位置で分割して再帰する。
 * 残すフレームは必ず先頭と末尾を含む
 */
export function rdpKeep(count: number, error: (a: number, b: number, i: number) => number, tol: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const keep = new Uint8Array(count)
  keep[0] = 1
  keep[count - 1] = 1
  const stack: number[] = [0, count - 1]
  while (stack.length > 0) {
    const b = stack.pop()!
    const a = stack.pop()!
    let maxErr = -1
    let maxI = -1
    for (let i = a + 1; i < b; i++) {
      const e = error(a, b, i)
      if (e > maxErr) {
        maxErr = e
        maxI = i
      }
    }
    if (maxI >= 0 && maxErr > tol) {
      keep[maxI] = 1
      stack.push(a, maxI, maxI, b)
    }
  }
  const frames: number[] = []
  for (let i = 0; i < count; i++) if (keep[i]) frames.push(i)
  return frames
}

/** frameCount × 4 の回転列を角度誤差 angleDeg 以内のキー列にする */
export function reduceRotation(baked: Float32Array, frameCount: number, angleDeg: number): RotationKey[] {
  const tol = (angleDeg * Math.PI) / 180
  const tmp = [0, 0, 0, 1]
  const frames = rdpKeep(
    frameCount,
    (a, b, i) => {
      slerpInto(tmp, 0, baked, a * 4, baked, b * 4, (i - a) / (b - a))
      return quatAngle(tmp, 0, baked, i * 4)
    },
    tol,
  )
  return frames.map((f) => ({
    frame: f,
    q: [baked[f * 4], baked[f * 4 + 1], baked[f * 4 + 2], baked[f * 4 + 3]],
    interp: 'linear',
  }))
}

/** frameCount × 3 の位置列を距離誤差 tolM 以内のキー列にする */
export function reducePosition(baked: Float32Array, frameCount: number, tolM: number): PositionKey[] {
  const frames = rdpKeep(
    frameCount,
    (a, b, i) => {
      const t = (i - a) / (b - a)
      const dx = lerp(baked[a * 3], baked[b * 3], t) - baked[i * 3]
      const dy = lerp(baked[a * 3 + 1], baked[b * 3 + 1], t) - baked[i * 3 + 1]
      const dz = lerp(baked[a * 3 + 2], baked[b * 3 + 2], t) - baked[i * 3 + 2]
      return Math.hypot(dx, dy, dz)
    },
    tolM,
  )
  return frames.map((f) => ({
    frame: f,
    p: [baked[f * 3], baked[f * 3 + 1], baked[f * 3 + 2]],
    interp: 'linear',
  }))
}

/** frameCount 個の値列を誤差 tol 以内のキー列にする */
export function reduceScalar(baked: Float32Array, frameCount: number, tol: number): ScalarKey[] {
  const frames = rdpKeep(
    frameCount,
    (a, b, i) => Math.abs(lerp(baked[a], baked[b], (i - a) / (b - a)) - baked[i]),
    tol,
  )
  return frames.map((f) => ({ frame: f, v: baked[f], interp: 'linear' }))
}

/** 生データ全体をしきい値で間引いてキー列を作る */
export function reduceBaked(
  baked: BakedSource,
  frameCount: number,
  tolerance: ReduceTolerance,
): Pick<MotionDocument, 'tracks' | 'hipsPosition' | 'expressions'> {
  const tracks: MotionDocument['tracks'] = {}
  for (const [name, data] of Object.entries(baked.rotations) as [VRMHumanBoneName, Float32Array | undefined][]) {
    if (data) tracks[name] = reduceRotation(data, frameCount, tolerance.angleDeg)
  }
  const expressions: MotionDocument['expressions'] = {}
  for (const [name, data] of Object.entries(baked.expressions)) {
    expressions[name] = reduceScalar(data, frameCount, tolerance.expression)
  }
  return {
    tracks,
    hipsPosition: baked.hipsPosition ? reducePosition(baked.hipsPosition, frameCount, tolerance.positionM) : [],
    expressions,
  }
}

/** しきい値を変えてキー列を作り直す(生データが無いドキュメントはそのまま返す) */
export function rereduce(doc: MotionDocument, tolerance: ReduceTolerance): MotionDocument {
  if (!doc.bakedSource) return doc
  return { ...doc, ...reduceBaked(doc.bakedSource, doc.frameCount, tolerance), tolerance }
}
