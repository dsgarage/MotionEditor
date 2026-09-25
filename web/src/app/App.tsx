import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Viewport } from '../viewport/Viewport'
import { DropZone, OpenFileButton } from '../ui/DropZone'
import { usePlaybackLoop } from '../motion/playback'
import { Timeline } from '../timeline/Timeline'
import { Transport } from './Transport'
import { useShortcuts } from './useShortcuts'
import styles from './App.module.css'

const PANEL_MIN = 180
const PANEL_MAX = 520
const COLLAPSED_W = 28

type Side = 'left' | 'right'

interface PanelState {
  width: number
  collapsed: boolean
}

const clamp = (v: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, v))

export default function App() {
  const [left, setLeft] = useState<PanelState>({ width: 264, collapsed: false })
  const [right, setRight] = useState<PanelState>({ width: 288, collapsed: false })
  usePlaybackLoop()
  useShortcuts()

  // 仕切りのドラッグで幅を変える
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

  return (
    <div className={styles.app}>
      <Toolbar />
      <div
        className={styles.main}
        style={{ gridTemplateColumns: `${leftW}px var(--splitter-w) minmax(0, 1fr) var(--splitter-w) ${rightW}px` }}
      >
        <SidePanel
          side="left"
          title="元動画 / ボーン"
          collapsed={left.collapsed}
          onToggle={() => setLeft((p) => ({ ...p, collapsed: !p.collapsed }))}
        >
          <Section title="元動画">未読込</Section>
          <Section title="ボーン">アバターを読み込むと表示されます</Section>
        </SidePanel>
        <div
          className={styles.splitter}
          role="separator"
          aria-orientation="vertical"
          aria-label="左パネルの幅"
          onPointerDown={(e) => startResize('left', e)}
        />
        <main className={styles.viewport}>
          <Viewport />
        </main>
        <div
          className={styles.splitter}
          role="separator"
          aria-orientation="vertical"
          aria-label="右パネルの幅"
          onPointerDown={(e) => startResize('right', e)}
        />
        <SidePanel
          side="right"
          title="インスペクタ"
          collapsed={right.collapsed}
          onToggle={() => setRight((p) => ({ ...p, collapsed: !p.collapsed }))}
        >
          <Section title="選択ボーン">なし</Section>
        </SidePanel>
      </div>
      <Timeline />
      <DropZone />
    </div>
  )
}

function Toolbar() {
  return (
    <header className={styles.toolbar}>
      <div className={styles.toolbarStart}>
        <span className={styles.brand}>MotionEditor</span>
        <OpenFileButton />
      </div>
      <Transport />
      <div className={styles.toolbarEnd} />
    </header>
  )
}

interface SidePanelProps {
  side: Side
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}

function SidePanel({ side, title, collapsed, onToggle, children }: SidePanelProps) {
  const arrow = side === 'left' ? (collapsed ? '›' : '‹') : collapsed ? '‹' : '›'
  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.panelHeader}>
        {!collapsed && <span className={styles.panelTitle}>{title}</span>}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggle}
          aria-label={collapsed ? `${title}を開く` : `${title}を折りたたむ`}
          aria-expanded={!collapsed}
        >
          {arrow}
        </button>
      </div>
      {!collapsed && <div className={styles.panelBody}>{children}</div>}
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}
