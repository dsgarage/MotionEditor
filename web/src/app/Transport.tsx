import type { ReactNode } from 'react'
import { useEditorStore } from '../store/editorStore'
import styles from './App.module.css'

/** 16px のアイコン(currentColor) */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  )
}

const ICONS = {
  toStart: (
    <Icon>
      <rect x="3" y="3" width="2" height="10" rx="0.5" />
      <path d="M13 3.5v9L6 8z" />
    </Icon>
  ),
  stepBack: (
    <Icon>
      <path d="M10 3.5v9L3 8z" />
      <rect x="11" y="3" width="2" height="10" rx="0.5" />
    </Icon>
  ),
  play: (
    <Icon>
      <path d="M4.5 2.8v10.4L13 8z" />
    </Icon>
  ),
  pause: (
    <Icon>
      <rect x="4" y="3" width="3" height="10" rx="0.5" />
      <rect x="9" y="3" width="3" height="10" rx="0.5" />
    </Icon>
  ),
  stepForward: (
    <Icon>
      <rect x="3" y="3" width="2" height="10" rx="0.5" />
      <path d="M6 3.5v9L13 8z" />
    </Icon>
  ),
  toEnd: (
    <Icon>
      <path d="M3 3.5v9L10 8z" />
      <rect x="11" y="3" width="2" height="10" rx="0.5" />
    </Icon>
  ),
  loop: (
    <Icon>
      <path
        d="M4 6.5A3.5 3.5 0 0 1 7.5 3H11V1.5L13.5 4 11 6.5V5H7.5A1.5 1.5 0 0 0 6 6.5V7H4zM12 9.5A3.5 3.5 0 0 1 8.5 13H5v1.5L2.5 12 5 9.5V11h3.5A1.5 1.5 0 0 0 10 9.5V9h2z"
      />
    </Icon>
  ),
}

/** ツールバー中央: 先頭 / 1f 戻る / 再生・一時停止 / 1f 進む / 末尾、フレーム表示、fps、ループ */
export function Transport() {
  const doc = useEditorStore((s) => s.document)
  const frame = useEditorStore((s) => s.frame)
  const fps = useEditorStore((s) => s.fps)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const loopEnabled = useEditorStore((s) => s.loopEnabled)
  const { setPlaying, setFrame, stepFrame, setLoopEnabled } = useEditorStore.getState()
  const disabled = !doc
  const last = doc ? doc.frameCount - 1 : 0
  const digits = Math.max(4, String(doc?.frameCount ?? 0).length)

  return (
    <div className={styles.transport} role="group" aria-label="再生">
      <button type="button" disabled={disabled} onClick={() => setFrame(0)} aria-label="先頭へ(Home)" title="先頭へ(Home)">
        {ICONS.toStart}
      </button>
      <button type="button" disabled={disabled} onClick={() => stepFrame(-1)} aria-label="1 フレーム戻る(←)" title="1 フレーム戻る(←)">
        {ICONS.stepBack}
      </button>
      <button
        type="button"
        className={styles.playBtn}
        disabled={disabled}
        onClick={() => setPlaying(!isPlaying)}
        aria-label={isPlaying ? '一時停止(Space)' : '再生(Space)'}
        title={isPlaying ? '一時停止(Space)' : '再生(Space)'}
      >
        {isPlaying ? ICONS.pause : ICONS.play}
      </button>
      <button type="button" disabled={disabled} onClick={() => stepFrame(1)} aria-label="1 フレーム進む(→)" title="1 フレーム進む(→)">
        {ICONS.stepForward}
      </button>
      <button type="button" disabled={disabled} onClick={() => setFrame(last)} aria-label="末尾へ(End)" title="末尾へ(End)">
        {ICONS.toEnd}
      </button>
      <span className={`mono ${styles.frameReadout}`} aria-live="off">
        {String(frame).padStart(digits, '0')}
        <span className={styles.sub}> / {String(doc?.frameCount ?? 0).padStart(digits, '0')}</span>
      </span>
      <span className={`mono ${styles.sub}`}>{fps}fps</span>
      <button
        type="button"
        className={loopEnabled ? styles.toggleOn : undefined}
        onClick={() => setLoopEnabled(!loopEnabled)}
        aria-pressed={loopEnabled}
        aria-label="ループ再生"
        title="ループ再生"
      >
        {ICONS.loop}
      </button>
    </div>
  )
}
