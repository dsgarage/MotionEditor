import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Viewport } from '../viewport/Viewport'
import { DropZone } from '../ui/DropZone'
import { usePlaybackLoop } from '../motion/playback'
import { BonePicker } from '../panels/BonePicker'
import { Inspector } from '../panels/Inspector'
import { Timeline } from '../timeline/Timeline'
import c from '../ui/controls.module.css'
import { ChevronIcon } from '../ui/icons'
import { TopBar } from './TopBar'
import { Transport } from './Transport'
import { useShortcuts } from './useShortcuts'
import styles from './App.module.css'

const PANEL_MIN = 180
const PANEL_MAX = 520
const COLLAPSED_W = 44

type Side = 'left' | 'right'

interface PanelState {
  width: number
  collapsed: boolean
}

const clamp = (v: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, v))

const BODY_TABS = ['全身', '手', '表情', 'ツリー']

export default function App() {
  const [left, setLeft] = useState<PanelState>({ width: 250, collapsed: false })
  const [right, setRight] = useState<PanelState>({ width: 280, collapsed: false })
  usePlaybackLoop()
  useShortcuts()

  // 溝(6px)のドラッグで幅を変える
  const startResize = (side: Side, e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const setter = side === 'left' ? setLeft : setRight
    const startW = side === 'left' ? left.width : right.width
    setter((p) => ({ ...p, collapsed: false }))
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      setter((p) => ({ ...p, width: clamp(side === 'left' ? startW + dx : startW - dx) }))
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const leftW = left.collapsed ? COLLAPSED_W : left.width
  const rightW = right.collapsed ? COLLAPSED_W : right.width
  const toggleLeft = () => setLeft((p) => ({ ...p, collapsed: !p.collapsed }))
  const toggleRight = () => setRight((p) => ({ ...p, collapsed: !p.collapsed }))

  return (
    <div className={styles.app}>
      <TopBar />
      <div
        className={styles.main}
        style={{ gridTemplateColumns: `${leftW}px var(--gutter) minmax(0, 1fr) var(--gutter) ${rightW}px` }}
      >
        <aside className={styles.tray} aria-label="ボーン選択">
          {left.collapsed ? (
            <CollapseButton side="left" collapsed onClick={toggleLeft} />
          ) : (
            <>
              <div className={styles.tabRow} role="tablist" aria-label="選択の方法">
                {BODY_TABS.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={i === 0}
                    aria-disabled={i === 0 ? undefined : 'true'}
                    title={i === 0 ? undefined : '今後対応します'}
                    className={`${c.tab} ${i === 0 ? c.tabOn : ''}`}
                  >
                    {t}
                  </button>
                ))}
                <span className={styles.grow} />
                <CollapseButton side="left" collapsed={false} onClick={toggleLeft} />
              </div>
              <BonePicker />
            </>
          )}
        </aside>
        <div
          className={styles.splitter}
          role="separator"
          aria-orientation="vertical"
          aria-label="左パネルの幅"
          onPointerDown={(e) => startResize('left', e)}
        />
        <main className={styles.stage}>
          <Viewport />
          <Transport />
        </main>
        <div
          className={styles.splitter}
          role="separator"
          aria-orientation="vertical"
          aria-label="右パネルの幅"
          onPointerDown={(e) => startResize('right', e)}
        />
        <aside className={styles.tray} aria-label="選択ボーンの値">
          {right.collapsed ? (
            <CollapseButton side="right" collapsed onClick={toggleRight} />
          ) : (
            <Inspector collapseButton={<CollapseButton side="right" collapsed={false} onClick={toggleRight} />} />
          )}
        </aside>
      </div>
      <Timeline />
      <DropZone />
    </div>
  )
}

function CollapseButton({ side, collapsed, onClick }: { side: Side; collapsed: boolean; onClick: () => void }) {
  // 開いているときは外側へ、閉じているときは内側へ向ける
  const dir = side === 'left' ? (collapsed ? 'right' : 'left') : collapsed ? 'left' : 'right'
  const name = side === 'left' ? '左パネル' : '右パネル'
  return (
    <button
      type="button"
      className={`${styles.collapseBtn} ${collapsed ? styles.collapsedBtn : ''}`}
      onClick={onClick}
      aria-label={collapsed ? `${name}を開く` : `${name}を折りたたむ`}
      aria-expanded={!collapsed}
      title={collapsed ? `${name}を開く` : `${name}を折りたたむ`}
    >
      <ChevronIcon dir={dir} />
    </button>
  )
}
