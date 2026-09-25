import type { CSSProperties } from 'react'
import { useEditorStore } from '../store/editorStore'
import { PICKER_BONES, PICKER_H, PICKER_W, SIDE_COLOR } from './bones'
import styles from './BonePicker.module.css'

const pct = (v: number, total: number) => `${(v / total) * 100}%`

/** 左トレイの人体図ピッカー。点を押すと selectedBones を更新する(表示用の選択。編集は #4) */
export function BonePicker() {
  const selected = useEditorStore((s) => s.selectedBones)

  return (
    <div className={styles.picker}>
      <div className={styles.stage}>
        <div className={styles.figure}>
          <svg className={styles.body} viewBox={`0 0 ${PICKER_W} ${PICKER_H}`} aria-hidden="true">
            <g fill="#333333">
              <circle cx="100" cy="40" r="25" />
              <path d="M70 72 h60 a12 12 0 0 1 12 12 v90 a12 12 0 0 1 -12 12 h-60 a12 12 0 0 1 -12 -12 v-90 a12 12 0 0 1 12 -12 z" />
              <path d="M78 186 h44 a12 12 0 0 1 12 12 v22 a12 12 0 0 1 -12 12 h-44 a12 12 0 0 1 -12 -12 v-22 a12 12 0 0 1 12 -12 z" />
              <path d="M52 84 a12 12 0 0 1 14 9 l16 90 a12 12 0 0 1 -23 5 l-16 -90 a12 12 0 0 1 9 -14 z" transform="rotate(26 60 130)" />
              <path d="M148 84 a12 12 0 0 0 -14 9 l-16 90 a12 12 0 0 0 23 5 l16 -90 a12 12 0 0 0 -9 -14 z" transform="rotate(-26 140 130)" />
              <rect x="20" y="178" width="22" height="72" rx="11" transform="rotate(10 31 214)" />
              <rect x="158" y="178" width="22" height="72" rx="11" transform="rotate(-10 169 214)" />
              <rect x="68" y="218" width="26" height="110" rx="13" />
              <rect x="106" y="218" width="26" height="110" rx="13" />
              <rect x="66" y="324" width="24" height="80" rx="12" />
              <rect x="110" y="324" width="24" height="80" rx="12" />
              <rect x="56" y="398" width="38" height="16" rx="8" />
              <rect x="106" y="398" width="38" height="16" rx="8" />
            </g>
            <text x="14" y="18" fill="var(--right)" fontSize="12" fontWeight="700">
              R
            </text>
            <text x="176" y="18" fill="var(--left)" fontSize="12" fontWeight="700">
              L
            </text>
          </svg>
          {PICKER_BONES.map((b) => {
            const on = selected.includes(b.id)
            return (
              <button
                key={b.id}
                type="button"
                className={`${styles.bone} ${on ? styles.boneOn : ''}`}
                style={{ left: pct(b.x, PICKER_W), top: pct(b.y, PICKER_H), '--dot': SIDE_COLOR[b.side] } as CSSProperties}
                onClick={() => useEditorStore.setState({ selectedBones: [b.id] })}
                aria-label={b.label}
                aria-pressed={on}
                title={b.label}
              >
                <i />
              </button>
            )
          })}
        </div>
      </div>
      <div className={styles.legend}>
        <span>
          <i style={{ background: 'var(--left)' }} />左
        </span>
        <span>
          <i style={{ background: 'var(--right)' }} />右
        </span>
        <span>
          <i style={{ background: 'var(--center)' }} />中心
        </span>
      </div>
    </div>
  )
}
