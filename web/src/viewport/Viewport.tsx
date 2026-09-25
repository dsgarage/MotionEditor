import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMUtils } from '@pixiv/three-vrm'
import { applyPose } from '../motion/applyPose'
import { evaluate } from '../motion/evaluate'
import { useEditorStore } from '../store/editorStore'
import c from '../ui/controls.module.css'
import { FocusIcon, IkIcon, MirrorIcon, MoveIcon, OnionIcon, RotateIcon } from '../ui/icons'
import { LicenseBadge } from '../ui/LicenseBadge'
import { createContactShadow, createMannequin } from './mannequin'
import styles from './Viewport.module.css'

interface SceneHandles {
  scene: THREE.Scene
  mannequin: THREE.Object3D
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
}

type ViewId = 'front' | 'side' | 'top'

/** 注視点から見たカメラの向き(正面はアバターの前 = +Z 側、側面はアバターの左 = +X 側) */
const VIEW_DIR: Record<ViewId, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0.11, 1),
  side: new THREE.Vector3(1, 0.11, 0),
  top: new THREE.Vector3(0, 1, 0.001),
}

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'front', label: '正面' },
  { id: 'side', label: '側面' },
  { id: 'top', label: '上' },
]

const SOON = '今後対応します'

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null)
  const handlesRef = useRef<SceneHandles | null>(null)
  const avatar = useEditorStore((s) => s.avatar)
  const loadStatus = useEditorStore((s) => s.loadStatus)
  const [view, setView] = useState<ViewId | null>('front')

  // シーン・レンダラー・描画ループ(マウント時に 1 回)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // 背景は CSS のホリゾント(グラデーション)を透かす
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = null

    // 足元がトランスポートのカプセルに隠れないよう、注視点を低めにして全身を上寄せで収める
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.78, 0)
    camera.position.copy(controls.target).addScaledVector(VIEW_DIR.front.clone().normalize(), 4.4)
    controls.enableDamping = true
    controls.update()
    // ドラッグで回したら視点プリセットの選択を外す
    const onStart = () => setView(null)
    controls.addEventListener('start', onStart)

    // 白ホリに合わせた柔らかい環境光 + 斜め前上からのキーライト + 背面の弱い縁取り
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 2.0)
    key.position.set(-1.6, 3, 2.4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 0.6)
    rim.position.set(1.5, 2, -2.5)
    scene.add(rim)

    // 床は描かず、足元の接地影だけ置く
    const shadow = createContactShadow()
    scene.add(shadow)

    const mannequin = createMannequin()
    scene.add(mannequin)

    handlesRef.current = { scene, mannequin, camera, controls }

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
      const { avatar: current, document: doc, frame } = useEditorStore.getState()
      if (current) {
        // モーションは AnimationMixer を使わず、ドキュメントを現在フレームで評価して正規化ボーンへ流す
        if (doc) applyPose(current.vrm, evaluate(doc, frame), doc.restHipsHeight)
        current.vrm.update(delta)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      timer.dispose()
      ro.disconnect()
      controls.removeEventListener('start', onStart)
      controls.dispose()
      for (const root of [mannequin, shadow]) {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose()
            const mat = o.material as THREE.MeshBasicMaterial
            mat.map?.dispose()
            mat.dispose()
          }
        })
      }
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

  /** 注視点までの距離を保ったまま、カメラを正面・側面・上へ回す */
  const applyView = (id: ViewId) => {
    const h = handlesRef.current
    if (!h) return
    const dist = h.camera.position.distanceTo(h.controls.target)
    h.camera.position.copy(h.controls.target).addScaledVector(VIEW_DIR[id].clone().normalize(), dist)
    h.camera.lookAt(h.controls.target)
    h.controls.update()
    setView(id)
  }

  return (
    <div className={styles.viewport}>
      <div ref={hostRef} className={styles.canvasHost} />

      <div className={`${c.float} ${styles.tools}`} role="toolbar" aria-label="ツール">
        <button type="button" className={c.iconBtn} aria-label="移動" aria-disabled="true" title={`移動 W(${SOON})`}>
          <MoveIcon />
        </button>
        <button type="button" className={`${c.iconBtn} ${c.iconBtnOn}`} aria-label="回転" aria-pressed="true" aria-disabled="true" title={`回転 E(${SOON})`}>
          <RotateIcon />
        </button>
        <button type="button" className={c.iconBtn} aria-label="IK" aria-disabled="true" title={`IK R(${SOON})`}>
          <IkIcon />
        </button>
        <span className={c.vrule} />
        <button type="button" className={c.iconBtn} aria-label="ミラー" aria-disabled="true" title={`ミラー(${SOON})`}>
          <MirrorIcon />
        </button>
        <button type="button" className={c.iconBtn} aria-label="オニオンスキン" aria-disabled="true" title={`オニオンスキン(${SOON})`}>
          <OnionIcon />
        </button>
      </div>

      <div className={`${c.float} ${styles.views}`} role="group" aria-label="視点">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`${c.tab} ${styles.viewBtn} ${view === v.id ? c.tabOn : ''}`}
            aria-pressed={view === v.id}
            onClick={() => applyView(v.id)}
          >
            {v.label}
          </button>
        ))}
        <button type="button" className={c.iconBtn} aria-label="選択にフォーカス" aria-disabled="true" title={`選択にフォーカス F(${SOON})`}>
          <FocusIcon />
        </button>
      </div>

      {!avatar && loadStatus.kind !== 'loading' && (
        <div className={styles.hint}>
          <p className={styles.hintTitle}>アバターをドロップ</p>
          <p className={styles.hintSub}>.vrm(VRM 0.x / 1.0)をこの画面にドラッグするか、上の「ファイル」から開きます</p>
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
