import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import type { MotionDocument } from '../motion/MotionDocument'

export type Side = 'left' | 'right' | 'center'

/** 行が参照するトラック */
export type TrackRef =
  | { kind: 'bone'; bone: VRMHumanBoneName }
  | { kind: 'hipsPosition' }
  | { kind: 'expression'; name: string }

interface GroupDef {
  id: string
  label: string
  side: Side
  /** 子行(ラベル + トラック)。expressions グループはドキュメントの表情から作る */
  members: { label: string; ref: TrackRef }[] | 'expressions'
}

const bone = (b: VRMHumanBoneName) => ({ label: b, ref: { kind: 'bone', bone: b } as TrackRef })

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const
function fingerBones(side: 'left' | 'right'): VRMHumanBoneName[] {
  const out: VRMHumanBoneName[] = []
  for (const f of FINGERS) {
    const joints = f === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']
    for (const j of joints) out.push(`${side}${f}${j}` as VRMHumanBoneName)
  }
  return out
}

/** タイムラインの行グループ(上から順に並ぶ) */
export const ROW_GROUPS: GroupDef[] = [
  {
    id: 'hips',
    label: 'Hips',
    side: 'center',
    members: [
      { label: 'hips 回転', ref: { kind: 'bone', bone: 'hips' } },
      { label: 'hips 位置', ref: { kind: 'hipsPosition' } },
    ],
  },
  { id: 'spine', label: 'Spine / Chest', side: 'center', members: ['spine', 'chest', 'upperChest'].map((b) => bone(b as VRMHumanBoneName)) },
  { id: 'head', label: 'Head', side: 'center', members: ['neck', 'head', 'jaw', 'leftEye', 'rightEye'].map((b) => bone(b as VRMHumanBoneName)) },
  {
    id: 'leftArm',
    label: '左腕',
    side: 'left',
    members: ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand'].map((b) => bone(b as VRMHumanBoneName)),
  },
  {
    id: 'rightArm',
    label: '右腕',
    side: 'right',
    members: ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'].map((b) => bone(b as VRMHumanBoneName)),
  },
  { id: 'leftFingers', label: '左手(指)', side: 'left', members: fingerBones('left').map(bone) },
  { id: 'rightFingers', label: '右手(指)', side: 'right', members: fingerBones('right').map(bone) },
  {
    id: 'leftLeg',
    label: '左脚・つま先',
    side: 'left',
    members: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes'].map((b) => bone(b as VRMHumanBoneName)),
  },
  {
    id: 'rightLeg',
    label: '右脚・つま先',
    side: 'right',
    members: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'].map((b) => bone(b as VRMHumanBoneName)),
  },
  { id: 'expressions', label: '表情', side: 'center', members: 'expressions' },
]

/** 描画用の 1 行 */
export interface TimelineRow {
  id: string
  label: string
  /** 0 = 全体・グループ、1 = 個別トラック */
  depth: 0 | 1
  side: Side
  /** 展開できるか(子行を持つか) */
  expandable: boolean
  expanded: boolean
  /** キーのあるフレーム(昇順・重複なし) */
  frames: Int32Array
  /** 間引き前の生データを持つか(帯を描く) */
  baked: boolean
}

function keyFrames(doc: MotionDocument, ref: TrackRef): readonly { frame: number }[] {
  switch (ref.kind) {
    case 'bone':
      return doc.tracks[ref.bone] ?? []
    case 'hipsPosition':
      return doc.hipsPosition
    case 'expression':
      return doc.expressions[ref.name] ?? []
  }
}

function hasBaked(doc: MotionDocument, ref: TrackRef): boolean {
  const src = doc.bakedSource
  if (!src) return false
  switch (ref.kind) {
    case 'bone':
      return src.rotations[ref.bone] != null
    case 'hipsPosition':
      return src.hipsPosition != null
    case 'expression':
      return src.expressions[ref.name] != null
  }
}

/** 複数トラックのキーフレームの和集合 */
function unionFrames(doc: MotionDocument, refs: TrackRef[]): Int32Array {
  const mark = new Uint8Array(Math.max(1, doc.frameCount))
  let count = 0
  for (const ref of refs) {
    for (const k of keyFrames(doc, ref)) {
      if (k.frame >= 0 && k.frame < mark.length && !mark[k.frame]) {
        mark[k.frame] = 1
        count++
      }
    }
  }
  const out = new Int32Array(count)
  let j = 0
  for (let f = 0; f < mark.length; f++) if (mark[f]) out[j++] = f
  return out
}

function membersOf(doc: MotionDocument, group: GroupDef): { label: string; ref: TrackRef }[] {
  if (group.members !== 'expressions') return group.members
  return Object.keys(doc.expressions).map((name) => ({ label: name, ref: { kind: 'expression', name } }))
}

/** 全トラック(和集合用) */
function allRefs(doc: MotionDocument): TrackRef[] {
  const refs: TrackRef[] = Object.keys(doc.tracks).map((b) => ({ kind: 'bone', bone: b as VRMHumanBoneName }))
  if (doc.hipsPosition.length > 0) refs.push({ kind: 'hipsPosition' })
  for (const name of Object.keys(doc.expressions)) refs.push({ kind: 'expression', name })
  return refs
}

/** ドキュメントと展開状態から行を作る。先頭は「全体」 */
export function buildRows(doc: MotionDocument, expanded: ReadonlySet<string>): TimelineRow[] {
  const all = allRefs(doc)
  const rows: TimelineRow[] = [
    {
      id: 'all',
      label: '全体',
      depth: 0,
      side: 'center',
      expandable: false,
      expanded: false,
      frames: unionFrames(doc, all),
      baked: all.some((r) => hasBaked(doc, r)),
    },
  ]
  for (const group of ROW_GROUPS) {
    const members = membersOf(doc, group)
    const refs = members.map((m) => m.ref)
    const isExpanded = expanded.has(group.id) && members.length > 0
    rows.push({
      id: group.id,
      label: group.label,
      depth: 0,
      side: group.side,
      expandable: members.length > 0,
      expanded: isExpanded,
      frames: unionFrames(doc, refs),
      baked: refs.some((r) => hasBaked(doc, r)),
    })
    if (!isExpanded) continue
    for (const m of members) {
      rows.push({
        id: `${group.id}/${m.label}`,
        label: m.label,
        depth: 1,
        side: m.ref.kind === 'bone' && m.ref.bone.startsWith('left') ? 'left' : m.ref.kind === 'bone' && m.ref.bone.startsWith('right') ? 'right' : group.side,
        expandable: false,
        expanded: false,
        frames: unionFrames(doc, [m.ref]),
        baked: hasBaked(doc, m.ref),
      })
    }
  }
  return rows
}

/** その行が bone のトラックを含むか(選択ボーンの行を強調する表示用。「全体」は含めない) */
export function rowHasBone(row: Pick<TimelineRow, 'id' | 'depth'>, bone: string): boolean {
  const slash = row.id.indexOf('/')
  const groupId = slash < 0 ? row.id : row.id.slice(0, slash)
  const group = ROW_GROUPS.find((g) => g.id === groupId)
  if (!group || group.members === 'expressions') return false
  if (row.depth === 0) return group.members.some((m) => m.ref.kind === 'bone' && m.ref.bone === bone)
  const label = row.id.slice(slash + 1)
  return group.members.some((m) => m.label === label && m.ref.kind === 'bone' && m.ref.bone === bone)
}
