import { useEditorStore } from '../store/editorStore'
import c from '../ui/controls.module.css'
import { LoopIcon, PauseIcon, PlayIcon, StepBackIcon, StepForwardIcon, ToEndIcon, ToStartIcon } from '../ui/icons'
import styles from './Transport.module.css'

/** ステージ下中央に浮くカプセル: 先頭 / 1f 戻る / 再生・一時停止 / 1f 進む / 末尾 | フレーム | fps | ループ */
export function Transport() {
  const doc = useEditorStore((s) => s.document)
  const frame = useEditorStore((s) => s.frame)
  const fps = useEditorStore((s) => s.fps)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const loopEnabled = useEditorStore((s) => s.loopEnabled)
  const { setPlaying, setFrame, stepFrame, setLoopEnabled } = useEditorStore.getState()
  const disabled = !doc
  const last = doc ? doc.frameCount - 1 : 0

  return (
    <div className={styles.capsule} role="group" aria-label="再生">
      <button type="button" className={c.iconBtn} disabled={disabled} onClick={() => setFrame(0)} aria-label="先頭へ(Home)" title="先頭へ(Home)">
        <ToStartIcon />
      </button>
      <button type="button" className={c.iconBtn} disabled={disabled} onClick={() => stepFrame(-1)} aria-label="1 フレーム戻る(←)" title="1 フレーム戻る(←)">
        <StepBackIcon />
      </button>
      <button
        type="button"
        className={`${c.iconBtn} ${c.iconBtnOn} ${styles.play}`}
        disabled={disabled}
        onClick={() => setPlaying(!isPlaying)}
        aria-label={isPlaying ? '一時停止(Space)' : '再生(Space)'}
        title={isPlaying ? '一時停止(Space)' : '再生(Space)'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className={c.iconBtn} disabled={disabled} onClick={() => stepFrame(1)} aria-label="1 フレーム進む(→)" title="1 フレーム進む(→)">
        <StepForwardIcon />
      </button>
      <button type="button" className={c.iconBtn} disabled={disabled} onClick={() => setFrame(last)} aria-label="末尾へ(End)" title="末尾へ(End)">
        <ToEndIcon />
      </button>
      <span className={styles.rule} />
      <span className={`mono ${styles.frame}`} aria-live="off">
        {frame}
        <span className={styles.total}> / {doc?.frameCount ?? 0}</span>
      </span>
      <span className={styles.spacer} />
      <span className={`mono ${styles.fps}`}>{fps} fps</span>
      <button
        type="button"
        className={`${c.tab} ${styles.loop} ${loopEnabled ? c.tabOn : ''}`}
        onClick={() => setLoopEnabled(!loopEnabled)}
        aria-pressed={loopEnabled}
        title="ループ再生"
      >
        <LoopIcon />
        ループ
      </button>
    </div>
  )
}
