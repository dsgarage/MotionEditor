import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import { evaluateRotation } from '../motion/evaluate'
import { findKeyIndex } from '../motion/math'
import type { Interp, MotionDocument } from '../motion/MotionDocument'
import { useEditorStore } from '../store/editorStore'
import { TrashIcon } from '../ui/icons'
import c from '../ui/controls.module.css'
import { boneInfo, SIDE_COLOR } from './bones'
import styles from './Inspector.module.css'

const SOON = '今後対応します'
const RAD2DEG = 180 / Math.PI

/** 現在フレームのボーン回転(オイラー XYZ、度)と、そのフレームが属する区間の補間 */
function readBone(doc: MotionDocument | null, bone: string, frame: number): { euler: [number, number, number] | null; interp: Interp | null } {
  if (!doc) return { euler: null, interp: null }
  const keys = doc.tracks[bone as VRMHumanBoneName]
  if (!keys || keys.length === 0) return { euler: [0, 0, 0], interp: null }
  const q = evaluateRotation(keys, frame)!
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q[0], q[1], q[2], q[3]), 'XYZ')
  const i = Math.max(0, findKeyIndex(keys, frame))
  return { euler: [e.x * RAD2DEG, e.y * RAD2DEG, e.z * RAD2DEG], interp: keys[i].interp }
}

const fmt = (v: number) => (Math.abs(v) < 0.05 ? 0 : v).toFixed(1)

const INTERPS: { id: Interp; label: string }[] = [
  { id: 'bezier', label: 'ベジェ' },
  { id: 'linear', label: 'リニア' },
  { id: 'step', label: 'ステップ' },
]

/** 右トレイ: 選択ボーンの値。編集操作(キー打ち・IK など)は #4 以降なので見た目だけ */
export function Inspector({ collapseButton }: { collapseButton: ReactNode }) {
  const bone = useEditorStore((s) => s.selectedBones[0] ?? null)
  const doc = useEditorStore((s) => s.document)
  const frame = useEditorStore((s) => s.frame)
  const { euler, interp } = useMemo(() => (bone ? readBone(doc, bone, frame) : { euler: null, interp: null }), [doc, bone, frame])

  if (!bone) {
    return (
      <div className={styles.inspector}>
        <div className={styles.head}>
          <span className={styles.empty}>人体図でボーンを選ぶ</span>
          {collapseButton}
        </div>
      </div>
    )
  }

  const info = boneInfo(bone)
  const axes = [
    { id: 'x', label: 'X', color: 'var(--axis-x)' },
    { id: 'y', label: 'Y', color: 'var(--axis-y)' },
    { id: 'z', label: 'Z', color: 'var(--axis-z)' },
  ]

  return (
    <div className={styles.inspector}>
      <div className={styles.head}>
        <i className={styles.dot} style={{ background: SIDE_COLOR[info.side] }} />
        <span className={styles.name}>{info.label}</span>
        <span className={`mono ${styles.id}`} title={bone}>
          {bone}
        </span>
        {collapseButton}
      </div>

      <div className={styles.group}>
        <div className={styles.caption}>
          <span>回転</span>
          <span className="mono">frame {frame}</span>
        </div>
        {axes.map((a, i) => (
          <div key={a.id} className={styles.field}>
            <label htmlFor={`rot-${a.id}`} style={{ color: a.color }}>
              {a.label}
            </label>
            <input id={`rot-${a.id}`} className="mono" readOnly value={euler ? fmt(euler[i]) : '—'} title={`${SOON}(表示のみ)`} />
          </div>
        ))}
      </div>

      <div className={styles.keyRow}>
        <button type="button" className={`${c.act} ${c.keep} ${styles.keyBtn}`} disabled title={SOON}>
          キーを打つ <span className={styles.keyKbd}>K</span>
        </button>
        <button type="button" className={`${c.act} ${c.keep}`} disabled aria-label="キーを削除" title={SOON}>
          <TrashIcon />
        </button>
      </div>

      <div className={styles.group}>
        <span className={styles.caption}>補間</span>
        <div className={styles.seg} role="group" aria-label="補間">
          {INTERPS.map((m) => (
            <button key={m.id} type="button" className={interp === m.id ? styles.segOn : undefined} aria-pressed={interp === m.id} aria-disabled="true" title={SOON}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.toggles}>
        <Toggle label="IK で動かす" />
        <Toggle label="足を床に固定" dim />
      </div>

      <div className={styles.actions}>
        {['左右ミラー', 'コピー', 'ペースト', 'T ポーズ'].map((l) => (
          <button key={l} type="button" className={c.act} aria-disabled="true" title={SOON}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <div className={`${styles.toggle} ${dim ? styles.dim : ''}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked="false" aria-disabled="true" aria-label={label} title={SOON} className={styles.switch}>
        <i />
      </button>
    </div>
  )
}
