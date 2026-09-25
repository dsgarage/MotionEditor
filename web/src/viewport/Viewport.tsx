import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMUtils } from '@pixiv/three-vrm'
import { useEditorStore } from '../store/editorStore'
import { LicenseBadge } from '../ui/LicenseBadge'
import { createMannequin } from './mannequin'
import styles from './Viewport.module.css'

interface SceneHandles {
  scene: THREE.Scene
  mannequin: THREE.Object3D
}

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null)
  const handlesRef = useRef<SceneHandles | null>(null)
  const avatar = useEditorStore((s) => s.avatar)
  const loadStatus = useEditorStore((s) => s.loadStatus)

  // シーン・レンダラー・描画ループ(マウント時に 1 回)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#15171c')

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100)
    camera.position.set(0, 1.3, 3.6)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.9, 0)
    controls.enableDamping = true
    controls.update()

    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2d35, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(1.5, 3, 2)
    scene.add(key)

    const grid = new THREE.GridHelper(10, 20, 0x3a404c, 0x262a33)
    scene.add(grid)

    const mannequin = createMannequin()
    scene.add(mannequin)

    handlesRef.current = { scene, mannequin }

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const timer = new THREE.Timer()
    timer.connect(document)
    let raf = 0
    const tick = (timestamp: number) => {
      raf = requestAnimationFrame(tick)
      timer.update(timestamp)
      const delta = timer.getDelta()
      useEditorStore.getState().avatar?.vrm.update(delta)
      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      timer.dispose()
      ro.disconnect()
      controls.dispose()
      grid.dispose()
      mannequin.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
      handlesRef.current = null
    }
  }, [])

  // アバターの差し替え
  useEffect(() => {
    const handles = handlesRef.current
    if (!handles) return
    handles.mannequin.visible = !avatar
    if (!avatar) return

    const root = avatar.vrm.scene
    handles.scene.add(root)
    return () => {
      handles.scene.remove(root)
      // 差し替えで不要になったときだけ解放する(再マウント時は現役の VRM を残す)
      if (useEditorStore.getState().avatar?.vrm.scene !== root) {
        VRMUtils.deepDispose(root)
      }
    }
  }, [avatar])

  return (
    <div className={styles.viewport}>
      <div ref={hostRef} className={styles.canvasHost} />
      {!avatar && loadStatus.kind !== 'loading' && (
        <div className={styles.hint}>
          <p className={styles.hintTitle}>アバターをドロップ</p>
          <p className={styles.hintSub}>.vrm(VRM 0.x / 1.0)をこの画面にドラッグするか、ツールバーの「ファイルを選ぶ」から開きます</p>
        </div>
      )}
      {loadStatus.kind === 'loading' && (
        <div className={styles.hint}>
          <p className={styles.hintTitle}>読み込み中…</p>
          <p className={styles.hintSub}>{loadStatus.fileName}</p>
        </div>
      )}
      {avatar && <LicenseBadge license={avatar.license} />}
    </div>
  )
}
