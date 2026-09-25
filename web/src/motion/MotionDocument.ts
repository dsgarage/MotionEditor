import type { VRMHumanBoneName } from '@pixiv/three-vrm'

/**
 * エディタ内部のモーション表現。
 * three.js の AnimationClip を状態として持たず、編集(#4)でもそのまま使えるキー列で持つ。
 *
 * 座標系は VRMA(VRM 1.0 の正規化ボーン空間)に合わせる。アバター(VRM 0.x の向き・Hips の高さ)への
 * 変換は再生時に applyPose で行うため、ドキュメント自体はアバターに依存しない。
 */

/** キーから次のキーまでの補間。bezier の接線は #4(グラフエディタ)で持たせる。現状は linear と同じ評価 */
export type Interp = 'bezier' | 'linear' | 'step'

export type Quat = [number, number, number, number]
export type Vec3 = [number, number, number]

export interface RotationKey {
  frame: number
  /** 正規化ボーンのローカル回転 [x, y, z, w] */
  q: Quat
  interp: Interp
}

export interface PositionKey {
  frame: number
  /** Hips の位置(VRMA 空間、メートル) */
  p: Vec3
  interp: Interp
}

export interface ScalarKey {
  frame: number
  /** 0〜1 */
  v: number
  interp: Interp
}

/** キー間引きのしきい値 */
export interface ReduceTolerance {
  /** 回転の角度誤差(度) */
  angleDeg: number
  /** 位置の誤差(メートル) */
  positionM: number
  /** 表情値の誤差 */
  expression: number
}

export const DEFAULT_TOLERANCE: ReduceTolerance = {
  angleDeg: 0.5,
  positionM: 0.001,
  expression: 0.01,
}

/**
 * 間引き前の毎フレームの値(frameCount 個ぶん)。タイムラインで「帯」として表示し、しきい値を変えたときの再間引きに使う
 */
export interface BakedSource {
  /** ボーン名 → frameCount × 4 の回転 */
  rotations: Partial<Record<VRMHumanBoneName, Float32Array>>
  /** frameCount × 3 の Hips 位置 */
  hipsPosition: Float32Array | null
  /** 表情名 → frameCount 個の値 */
  expressions: Record<string, Float32Array>
}

export interface MotionDocument {
  /** 表示名(ファイル名など) */
  name: string
  fps: number
  /** フレーム数。フレーム番号は 0 〜 frameCount - 1 */
  frameCount: number
  /** ボーン名 → 回転キー列(frame 昇順) */
  tracks: Partial<Record<VRMHumanBoneName, RotationKey[]>>
  /** Hips の位置キー列(frame 昇順)。無ければ空 */
  hipsPosition: PositionKey[]
  /** 表情名 → 値キー列(frame 昇順) */
  expressions: Record<string, ScalarKey[]>
  /** VRMA 側の静止時の Hips の高さ(メートル)。アバターへの位置スケールに使う */
  restHipsHeight: number
  /** 間引きに使ったしきい値 */
  tolerance: ReduceTolerance
  /** 間引き前の生データ。手で作ったドキュメントでは null */
  bakedSource: BakedSource | null
}

/** ドキュメント内の全キー数(回転 + 位置 + 表情) */
export function countKeys(doc: MotionDocument): number {
  let n = doc.hipsPosition.length
  for (const keys of Object.values(doc.tracks)) n += keys?.length ?? 0
  for (const keys of Object.values(doc.expressions)) n += keys.length
  return n
}
