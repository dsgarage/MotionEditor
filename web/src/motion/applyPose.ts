import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import type { Pose } from './evaluate'

/**
 * VRMA 空間のポーズを VRM の正規化ボーン・Hips 位置・表情に流す。
 * 変換は three-vrm-animation の createVRMAnimationHumanoidTracks と同じ:
 * - VRM 0.x は向きが逆なので回転の x, z と位置の x, z を反転
 * - Hips 位置はアバターと VRMA の静止時の Hips の高さの比でスケール
 */
export function applyPose(vrm: VRM, pose: Pose, restHipsHeight: number): void {
  const humanoid = vrm.humanoid
  const isVrm0 = vrm.meta.metaVersion === '0'

  for (const [name, q] of Object.entries(pose.rotations) as [VRMHumanBoneName, [number, number, number, number]][]) {
    const node = humanoid.getNormalizedBoneNode(name)
    if (!node) continue
    if (isVrm0) node.quaternion.set(-q[0], q[1], -q[2], q[3])
    else node.quaternion.set(q[0], q[1], q[2], q[3])
  }

  if (pose.hipsPosition) {
    const hips = humanoid.getNormalizedBoneNode('hips')
    if (hips) {
      const avatarHipsY = humanoid.normalizedRestPose.hips?.position?.[1] ?? 0
      const scale = restHipsHeight > 1e-3 && avatarHipsY > 0 ? avatarHipsY / restHipsHeight : 1
      const [x, y, z] = pose.hipsPosition
      if (isVrm0) hips.position.set(-x * scale, y * scale, -z * scale)
      else hips.position.set(x * scale, y * scale, z * scale)
    }
  }

  const expressionManager = vrm.expressionManager
  if (expressionManager) {
    for (const [name, v] of Object.entries(pose.expressions)) {
      expressionManager.setValue(name, v)
    }
  }
}
