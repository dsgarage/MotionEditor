import * as THREE from 'three'

/** VRM 未読込時に表示する簡易マネキン(カプセル + 球)。身長はおよそ 1.6m */
export function createMannequin(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Mannequin'
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 })

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

/**
 * 足元の接地影(床面は描かない)。中心が濃く外へ向かって消える円を床に寝かせる
 */
export function createContactShadow(): THREE.Mesh {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.42)')
    g.addColorStop(0.45, 'rgba(0,0,0,0.2)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.0),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  mesh.name = 'ContactShadow'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.001
  mesh.renderOrder = -1
  return mesh
}
