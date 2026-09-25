import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import type { MotionDocument, PositionKey, Quat, RotationKey, ScalarKey, Vec3 } from './MotionDocument'
import { findKeyIndex, lerp, slerpInto } from './math'

/** あるフレームでのポーズ(VRMA 空間) */
export interface Pose {
  rotations: Partial<Record<VRMHumanBoneName, Quat>>
  hipsPosition: Vec3 | null
  expressions: Record<string, number>
}

/** キー a から次のキーへの補間係数。step は 0 のまま保持、bezier は接線を持つまで linear と同じ */
function segmentT(a: { frame: number; interp: string }, b: { frame: number }, frame: number): number {
  if (a.interp === 'step') return 0
  const span = b.frame - a.frame
  return span > 0 ? (frame - a.frame) / span : 0
}

export function evaluateRotation(keys: readonly RotationKey[], frame: number): Quat | null {
  if (keys.length === 0) return null
  const i = findKeyIndex(keys, frame)
  if (i < 0) return [...keys[0].q]
  if (i >= keys.length - 1) return [...keys[i].q]
  const a = keys[i]
  const b = keys[i + 1]
  const out: Quat = [0, 0, 0, 1]
  slerpInto(out, 0, a.q, 0, b.q, 0, segmentT(a, b, frame))
  return out
}

export function evaluatePosition(keys: readonly PositionKey[], frame: number): Vec3 | null {
  if (keys.length === 0) return null
  const i = findKeyIndex(keys, frame)
  if (i < 0) return [...keys[0].p]
  if (i >= keys.length - 1) return [...keys[i].p]
  const a = keys[i]
  const b = keys[i + 1]
  const t = segmentT(a, b, frame)
  return [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)]
}

export function evaluateScalar(keys: readonly ScalarKey[], frame: number): number | null {
  if (keys.length === 0) return null
  const i = findKeyIndex(keys, frame)
  if (i < 0) return keys[0].v
  if (i >= keys.length - 1) return keys[i].v
  const a = keys[i]
  const b = keys[i + 1]
  return lerp(a.v, b.v, segmentT(a, b, frame))
}

/**
 * ドキュメントを frame(小数可)で評価する。回転は球面線形補間、位置・表情は線形補間。
 * キーの範囲外は端のキーの値を保持する
 */
export function evaluate(doc: MotionDocument, frame: number): Pose {
  const rotations: Pose['rotations'] = {}
  for (const [name, keys] of Object.entries(doc.tracks) as [VRMHumanBoneName, RotationKey[] | undefined][]) {
    if (!keys) continue
    const q = evaluateRotation(keys, frame)
    if (q) rotations[name] = q
  }
  const expressions: Record<string, number> = {}
  for (const [name, keys] of Object.entries(doc.expressions)) {
    const v = evaluateScalar(keys, frame)
    if (v != null) expressions[name] = v
  }
  return { rotations, hipsPosition: evaluatePosition(doc.hipsPosition, frame), expressions }
}
