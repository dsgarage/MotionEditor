import type { VRM0Meta, VRM1Meta, VRMMeta } from '@pixiv/three-vrm'

/** 許可状態。meta から判定できないときは unknown */
export type Permission = 'allowed' | 'prohibited' | 'unknown'

/** VRM 0.x / 1.0 のライセンス情報を表示用にそろえたもの */
export interface AvatarLicense {
  specVersion: '0' | '1'
  /** アバター名(meta に無ければファイル名) */
  name: string
  authors: string[]
  /** 改変の可否 */
  modification: Permission
  /** 再配布の可否 */
  redistribution: Permission
  /** アバターを使ってよい人(原文の値) */
  avatarPermission?: string
  /** ライセンス名または URL */
  licenseLabel?: string
  licenseUrl?: string
}

function fromVrm0(meta: VRM0Meta, fallbackName: string): AvatarLicense {
  const l = meta.licenseName
  let modification: Permission = 'unknown'
  let redistribution: Permission = 'unknown'
  switch (l) {
    case 'CC0':
    case 'CC_BY':
    case 'CC_BY_SA':
    case 'CC_BY_NC':
    case 'CC_BY_NC_SA':
      modification = 'allowed'
      redistribution = 'allowed'
      break
    case 'CC_BY_ND':
    case 'CC_BY_NC_ND':
      modification = 'prohibited'
      redistribution = 'allowed'
      break
    case 'Redistribution_Prohibited':
      redistribution = 'prohibited'
      break
    // 'Other' と未指定は判定できない
  }
  return {
    specVersion: '0',
    name: meta.title?.trim() || fallbackName,
    authors: meta.author ? [meta.author] : [],
    modification,
    redistribution,
    avatarPermission: meta.allowedUserName,
    licenseLabel: l,
    licenseUrl: meta.otherLicenseUrl || undefined,
  }
}

function fromVrm1(meta: VRM1Meta, fallbackName: string): AvatarLicense {
  // VRM 1.0 仕様の既定値: modification = prohibited, allowRedistribution = false
  const modification: Permission = (meta.modification ?? 'prohibited') === 'prohibited' ? 'prohibited' : 'allowed'
  const redistribution: Permission = meta.allowRedistribution ? 'allowed' : 'prohibited'
  return {
    specVersion: '1',
    name: meta.name?.trim() || fallbackName,
    authors: meta.authors ?? [],
    modification,
    redistribution,
    avatarPermission: meta.avatarPermission ?? 'onlyAuthor',
    licenseLabel: meta.licenseUrl,
    licenseUrl: meta.licenseUrl || undefined,
  }
}

/** vrm.meta を表示用のライセンス情報に正規化する */
export function normalizeLicense(meta: VRMMeta | null | undefined, fallbackName: string): AvatarLicense {
  if (!meta) {
    return {
      specVersion: '1',
      name: fallbackName,
      authors: [],
      modification: 'unknown',
      redistribution: 'unknown',
    }
  }
  return meta.metaVersion === '0' ? fromVrm0(meta, fallbackName) : fromVrm1(meta, fallbackName)
}
