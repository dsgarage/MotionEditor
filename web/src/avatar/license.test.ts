import { describe, expect, it } from 'vitest'
import type { VRM0Meta, VRM1Meta } from '@pixiv/three-vrm'
import { normalizeLicense } from './license'
import { isVrmFileName } from './loadVrm'

describe('normalizeLicense', () => {
  it('VRM0: CC_BY_ND は改変不可・再配布可', () => {
    const meta: VRM0Meta = { metaVersion: '0', title: 'Alice', licenseName: 'CC_BY_ND', allowedUserName: 'Everyone' }
    const l = normalizeLicense(meta, 'file')
    expect(l).toMatchObject({ specVersion: '0', name: 'Alice', modification: 'prohibited', redistribution: 'allowed' })
  })

  it('VRM0: Redistribution_Prohibited は再配布不可、title が無ければファイル名', () => {
    const l = normalizeLicense({ metaVersion: '0', licenseName: 'Redistribution_Prohibited' }, 'file')
    expect(l).toMatchObject({ name: 'file', modification: 'unknown', redistribution: 'prohibited' })
  })

  it('VRM1: 未指定は仕様の既定値(改変不可・再配布不可)', () => {
    const meta: VRM1Meta = { metaVersion: '1', name: 'Bob', authors: ['x'], licenseUrl: 'https://vrm.dev/licenses/1.0/' }
    const l = normalizeLicense(meta, 'file')
    expect(l).toMatchObject({ specVersion: '1', name: 'Bob', modification: 'prohibited', redistribution: 'prohibited' })
  })

  it('VRM1: 改変・再配布を許可', () => {
    const meta: VRM1Meta = {
      metaVersion: '1',
      name: 'Carol',
      authors: [],
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
      modification: 'allowModificationRedistribution',
      allowRedistribution: true,
    }
    expect(normalizeLicense(meta, 'file')).toMatchObject({ modification: 'allowed', redistribution: 'allowed' })
  })
})

describe('isVrmFileName', () => {
  it('.vrm だけを受け付ける(大文字も可)', () => {
    expect(isVrmFileName('a.vrm')).toBe(true)
    expect(isVrmFileName('A.VRM')).toBe(true)
    expect(isVrmFileName('a.vrma')).toBe(false)
    expect(isVrmFileName('a.glb')).toBe(false)
  })
})
