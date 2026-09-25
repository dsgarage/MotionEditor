import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation'

export function isVrmaFileName(name: string): boolean {
  return /\.vrma$/i.test(name)
}

/** VRMA(glb)のバイト列を VRMAnimation にする。ファイルはブラウザ内だけで処理し外部へ送らない */
export async function parseVrma(buffer: ArrayBuffer): Promise<VRMAnimation> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  const gltf = await loader.parseAsync(buffer, '')
  const animations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined
  const anim = animations?.[0]
  if (!anim) {
    throw new Error('VRMA として読み込めませんでした(VRMC_vrm_animation 拡張またはアニメーションが見つかりません)')
  }
  return anim
}
