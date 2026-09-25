import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { normalizeLicense, type AvatarLicense } from './license'

/** 読み込めるファイルの上限(要件 6: 100MB) */
export const MAX_FILE_BYTES = 100 * 1024 * 1024

export interface LoadedVrm {
  vrm: VRM
  license: AvatarLicense
}

export function isVrmFileName(name: string): boolean {
  return /\.vrm$/i.test(name)
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * File を VRM(0.x / 1.0)として読み込む。ファイルはブラウザ内だけで処理し外部へ送らない
 */
export async function loadVrm(file: File): Promise<LoadedVrm> {
  const buffer = await file.arrayBuffer()

  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = await loader.parseAsync(buffer, '')

  const vrm = gltf.userData.vrm as VRM | undefined
  if (!vrm) {
    throw new Error('VRM として読み込めませんでした(VRM 拡張が見つかりません)')
  }

  // three-vrm 推奨の後処理(removeUnnecessaryJoints は非推奨になり combineSkeletons に置き換わった)
  VRMUtils.removeUnnecessaryVertices(vrm.scene)
  VRMUtils.combineSkeletons(vrm.scene)
  VRMUtils.combineMorphs(vrm)
  // VRM 0.x は -Z 向きなので 1.0 と同じ +Z 向きにそろえる
  VRMUtils.rotateVRM0(vrm)

  // 骨で変形したメッシュが視錐台カリングで消えないようにする
  vrm.scene.traverse((obj) => {
    obj.frustumCulled = false
  })

  return { vrm, license: normalizeLicense(vrm.meta, stripExt(file.name)) }
}
