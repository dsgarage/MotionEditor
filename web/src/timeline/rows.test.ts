import { describe, expect, it } from 'vitest'
import { DEFAULT_TOLERANCE, type MotionDocument, type RotationKey } from '../motion/MotionDocument'
import { buildRows, rowHasBone } from './rows'

const key = (frame: number): RotationKey => ({ frame, q: [0, 0, 0, 1], interp: 'linear' })

const doc: MotionDocument = {
  name: 'd',
  fps: 30,
  frameCount: 50,
  tracks: {
    hips: [key(0), key(10)],
    leftUpperArm: [key(0), key(5), key(20)],
    leftHand: [key(5), key(30)],
    leftIndexProximal: [key(7)],
  },
  hipsPosition: [{ frame: 12, p: [0, 1, 0], interp: 'linear' }],
  expressions: { happy: [{ frame: 40, v: 1, interp: 'linear' }] },
  restHipsHeight: 1,
  tolerance: DEFAULT_TOLERANCE,
  bakedSource: null,
}

describe('タイムラインの行', () => {
  it('折りたたみ時は 全体 + 10 グループ。全体は全キーの和集合', () => {
    const rows = buildRows(doc, new Set())
    expect(rows.map((r) => r.label)).toEqual([
      '全体',
      'Hips',
      'Spine / Chest',
      'Head',
      '左腕',
      '右腕',
      '左手(指)',
      '右手(指)',
      '左脚・つま先',
      '右脚・つま先',
      '表情',
    ])
    expect(Array.from(rows[0].frames)).toEqual([0, 5, 7, 10, 12, 20, 30, 40])
    expect(Array.from(rows.find((r) => r.id === 'hips')!.frames)).toEqual([0, 10, 12])
    expect(Array.from(rows.find((r) => r.id === 'leftArm')!.frames)).toEqual([0, 5, 20, 30])
    expect(rows.every((r) => !r.baked)).toBe(true)
  })

  it('グループを展開すると個別ボーン行が続く', () => {
    const rows = buildRows(doc, new Set(['leftFingers', 'expressions']))
    const i = rows.findIndex((r) => r.id === 'leftFingers')
    expect(rows[i].expanded).toBe(true)
    expect(rows[i + 1].label).toBe('leftThumbMetacarpal')
    expect(rows.slice(i + 1, i + 16).every((r) => r.depth === 1 && r.side === 'left')).toBe(true)
    expect(Array.from(rows.find((r) => r.label === 'leftIndexProximal')!.frames)).toEqual([7])
    const last = rows[rows.length - 1]
    expect(last.label).toBe('happy')
    expect(Array.from(last.frames)).toEqual([40])
  })

  it('選択ボーンを含む行(グループと個別行)だけが強調対象になる', () => {
    const rows = buildRows(doc, new Set(['leftArm', 'hips']))
    const hit = rows.filter((r) => rowHasBone(r, 'leftUpperArm')).map((r) => r.id)
    expect(hit).toEqual(['leftArm', 'leftArm/leftUpperArm'])
    expect(rows.filter((r) => rowHasBone(r, 'hips')).map((r) => r.id)).toEqual(['hips', 'hips/hips 回転'])
    expect(rows.some((r) => rowHasBone(r, 'happy'))).toBe(false)
  })
})
