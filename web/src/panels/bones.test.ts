import { VRMHumanBoneList } from '@pixiv/three-vrm'
import { describe, expect, it } from 'vitest'
import { boneInfo, PICKER_BONES, PICKER_H, PICKER_W, sideOf } from './bones'

describe('人体図のボーン', () => {
  it('すべて VRM のヒューマノイドボーン名で、重複しない', () => {
    const ids = PICKER_BONES.map((b) => b.id)
    for (const id of ids) expect(VRMHumanBoneList).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('左右中心の分類がボーン名と一致し、座標が図の中に収まる', () => {
    for (const b of PICKER_BONES) {
      expect(b.side).toBe(sideOf(b.id))
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x).toBeLessThanOrEqual(PICKER_W)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeLessThanOrEqual(PICKER_H)
    }
  })

  it('正面図なので、アバターの右は図の左側に置く', () => {
    const r = PICKER_BONES.find((b) => b.id === 'rightUpperArm')!
    const l = PICKER_BONES.find((b) => b.id === 'leftUpperArm')!
    expect(r.x).toBeLessThan(PICKER_W / 2)
    expect(l.x).toBeGreaterThan(PICKER_W / 2)
  })

  it('人体図に無いボーンは ID を名前にする', () => {
    expect(boneInfo('leftUpperArm')).toEqual({ label: '左上腕', side: 'left' })
    expect(boneInfo('rightIndexProximal')).toEqual({ label: 'rightIndexProximal', side: 'right' })
    expect(boneInfo('upperChest')).toEqual({ label: 'upperChest', side: 'center' })
  })
})
