import type * as THREE from 'three'
import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import type { VRMAnimation } from '@pixiv/three-vrm-animation'
import { DEFAULT_TOLERANCE, type BakedSource, type MotionDocument, type ReduceTolerance } from './MotionDocument'
import { reduceBaked } from './reduce'

/** fps の候補。先頭ほど優先(VRMA は fps を持たないため、キーの時刻がそろう値を採用する) */
const FPS_CANDIDATES = [30, 60, 24, 25, 50, 120]
export const FALLBACK_FPS = 30

function allTracks(anim: VRMAnimation): THREE.KeyframeTrack[] {
  return [
    ...anim.humanoidTracks.rotation.values(),
    ...anim.humanoidTracks.translation.values(),
    ...anim.expressionTracks.preset.values(),
    ...anim.expressionTracks.custom.values(),
  ]
}

/**
 * キーの時刻がすべて 1/fps の整数倍に乗る fps を候補から選ぶ。どれにも乗らなければ 30fps
 */
export function detectFps(anim: VRMAnimation): number {
  const tracks = allTracks(anim)
  for (const fps of FPS_CANDIDATES) {
    let ok = true
    for (const track of tracks) {
      for (const t of track.times) {
        const f = t * fps
        if (Math.abs(f - Math.round(f)) > 0.01) {
          ok = false
          break
        }
      }
      if (!ok) break
    }
    if (ok) return fps
  }
  return FALLBACK_FPS
}

/** 長さ duration 秒を fps で割ったフレーム数(両端を含む) */
export function frameCountFor(duration: number, fps: number): number {
  return Math.max(1, Math.round(duration * fps) + 1)
}

/** トラックを毎フレーム評価して frameCount × itemSize の配列にする(トラック自身の補間方式に従う) */
function sampleTrack(track: THREE.KeyframeTrack, frameCount: number, fps: number, duration: number): Float32Array {
  const size = track.getValueSize()
  const out = new Float32Array(frameCount * size)
  // createInterpolant は setInterpolation が差し込む実行時メソッドで、型定義には無い
  const interpolant = (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant()
  for (let f = 0; f < frameCount; f++) {
    const result = interpolant.evaluate(Math.min(f / fps, duration))
    for (let k = 0; k < size; k++) out[f * size + k] = result[k]
  }
  return out
}

/** VRMAnimation を毎フレームサンプリングした生データ(LookAt は読み飛ばす) */
export function bakeVrmAnimation(anim: VRMAnimation, fps: number): { baked: BakedSource; frameCount: number } {
  const frameCount = frameCountFor(anim.duration, fps)
  const rotations: BakedSource['rotations'] = {}
  for (const [name, track] of anim.humanoidTracks.rotation) {
    const data = sampleTrack(track, frameCount, fps, anim.duration)
    for (let f = 0; f < frameCount; f++) {
      const o = f * 4
      // ファイル内の値が単位長からずれていることがある(例: 0.7071, 0.7071)ので正規化する
      const len = Math.hypot(data[o], data[o + 1], data[o + 2], data[o + 3]) || 1
      // 符号の反転(q と -q)でキー間の補間が遠回りしないよう、前のフレームと同じ半球にそろえる
      const dot =
        f === 0 ? 1 : data[o] * data[o - 4] + data[o + 1] * data[o - 3] + data[o + 2] * data[o - 2] + data[o + 3] * data[o - 1]
      const s = (dot < 0 ? -1 : 1) / len
      for (let k = 0; k < 4; k++) data[o + k] *= s
    }
    rotations[name as VRMHumanBoneName] = data
  }
  const hipsTrack = anim.humanoidTracks.translation.get('hips')
  const hipsPosition = hipsTrack ? sampleTrack(hipsTrack, frameCount, fps, anim.duration) : null
  const expressions: Record<string, Float32Array> = {}
  for (const map of [anim.expressionTracks.preset, anim.expressionTracks.custom] as Map<string, THREE.KeyframeTrack>[]) {
    for (const [name, track] of map) expressions[name] = sampleTrack(track, frameCount, fps, anim.duration)
  }
  return { baked: { rotations, hipsPosition, expressions }, frameCount }
}

export interface FromVrmAnimationOptions {
  name: string
  /** 省略時はキーの時刻から推定 */
  fps?: number
  tolerance?: ReduceTolerance
}

/** VRMAnimation → MotionDocument(毎フレームベイク → しきい値で間引き) */
export function fromVrmAnimation(anim: VRMAnimation, options: FromVrmAnimationOptions): MotionDocument {
  const fps = options.fps ?? detectFps(anim)
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const { baked, frameCount } = bakeVrmAnimation(anim, fps)
  return {
    name: options.name,
    fps,
    frameCount,
    ...reduceBaked(baked, frameCount, tolerance),
    restHipsHeight: anim.restHipsPosition.y,
    tolerance,
    bakedSource: baked,
  }
}
