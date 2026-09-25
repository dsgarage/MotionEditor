import * as THREE from 'three'

/** VRM 未読込時に表示する簡易マネキン(カプセル + 球)。身長はおよそ 1.6m */
export function createMannequin(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Mannequin'
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7 })

  const part = (geo: THREE.BufferGeometry, x: number, y: number, z = 0, rotZ = 0) => {
    const m = new THREE.Mesh(geo, mat.clone())
    m.position.set(x, y, z)
    m.rotation.z = rotZ
    group.add(m)
  }

  // 胴体
  part(new THREE.CapsuleGeometry(0.16, 0.42, 4, 16), 0, 1.08)
  // 頭
  part(new THREE.SphereGeometry(0.12, 24, 16), 0, 1.5)
  // 脚
  part(new THREE.CapsuleGeometry(0.065, 0.66, 4, 12), -0.09, 0.42)
  part(new THREE.CapsuleGeometry(0.065, 0.66, 4, 12), 0.09, 0.42)
  // 腕(A ポーズ気味)
  part(new THREE.CapsuleGeometry(0.05, 0.5, 4, 12), -0.3, 1.08, 0, -0.35)
  part(new THREE.CapsuleGeometry(0.05, 0.5, 4, 12), 0.3, 1.08, 0, 0.35)

  mat.dispose()
  return group
}
