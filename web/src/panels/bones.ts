import type { VRMHumanBoneName } from '@pixiv/three-vrm'

export type BoneSide = 'left' | 'right' | 'center'

/** 人体図のボーン点。x / y は 200 × 430 の図の座標(正面から見た図なので、アバターの右は図の左) */
export interface PickerBone {
  id: VRMHumanBoneName
  label: string
  x: number
  y: number
  side: BoneSide
}

export const PICKER_W = 200
export const PICKER_H = 430

/** 承認済みデザイン(Stage.dc.html)の座標をそのまま使う */
export const PICKER_BONES: readonly PickerBone[] = [
  { id: 'head', label: '頭', x: 100, y: 40, side: 'center' },
  { id: 'neck', label: '首', x: 100, y: 78, side: 'center' },
  { id: 'chest', label: '胸', x: 100, y: 120, side: 'center' },
  { id: 'spine', label: '背骨', x: 100, y: 160, side: 'center' },
  { id: 'hips', label: '腰', x: 100, y: 204, side: 'center' },
  { id: 'leftShoulder', label: '左肩', x: 128, y: 100, side: 'left' },
  { id: 'rightShoulder', label: '右肩', x: 72, y: 100, side: 'right' },
  { id: 'leftUpperArm', label: '左上腕', x: 156, y: 140, side: 'left' },
  { id: 'rightUpperArm', label: '右上腕', x: 44, y: 140, side: 'right' },
  { id: 'leftLowerArm', label: '左前腕', x: 166, y: 200, side: 'left' },
  { id: 'rightLowerArm', label: '右前腕', x: 34, y: 200, side: 'right' },
  { id: 'leftHand', label: '左手(手首)', x: 172, y: 246, side: 'left' },
  { id: 'rightHand', label: '右手(手首)', x: 28, y: 246, side: 'right' },
  { id: 'leftUpperLeg', label: '左太もも', x: 119, y: 262, side: 'left' },
  { id: 'rightUpperLeg', label: '右太もも', x: 81, y: 262, side: 'right' },
  { id: 'leftLowerLeg', label: '左すね', x: 122, y: 354, side: 'left' },
  { id: 'rightLowerLeg', label: '右すね', x: 78, y: 354, side: 'right' },
  { id: 'leftFoot', label: '左足(足首)', x: 124, y: 404, side: 'left' },
  { id: 'rightFoot', label: '右足(足首)', x: 76, y: 404, side: 'right' },
  { id: 'leftToes', label: '左つま先', x: 142, y: 412, side: 'left' },
  { id: 'rightToes', label: '右つま先', x: 58, y: 412, side: 'right' },
]

/** ボーン名から左右中心を決める */
export function sideOf(bone: string): BoneSide {
  if (bone.startsWith('left')) return 'left'
  if (bone.startsWith('right')) return 'right'
  return 'center'
}

/** 表示用の情報(人体図に無いボーンは ID をそのまま名前にする) */
export function boneInfo(bone: string): { label: string; side: BoneSide } {
  const hit = PICKER_BONES.find((b) => b.id === bone)
  return hit ? { label: hit.label, side: hit.side } : { label: bone, side: sideOf(bone) }
}

/** 左右中心の色(CSS 変数) */
export const SIDE_COLOR: Record<BoneSide, string> = {
  left: 'var(--left)',
  right: 'var(--right)',
  center: 'var(--center)',
}
