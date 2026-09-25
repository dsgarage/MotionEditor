import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { countKeys } from '../motion/MotionDocument'
import { openSampleVrma } from '../motion/openVrmaFile'
import { useEditorStore } from '../store/editorStore'
import {
  drawTimeline,
  frameToX,
  LEFT_PAD,
  MAX_PX_PER_FRAME,
  maxScrollX,
  MIN_PX_PER_FRAME,
  readColors,
  RULER_H,
  xToFrame,
  type TimelineColors,
  type TimelineView,
} from './draw'
import { buildRows, type TimelineRow } from './rows'
import styles from './Timeline.module.css'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 下段パネル: ドープシート(ルーラー + 行)。キーの表示とスクラブのみ(編集は #4) */
export function Timeline() {
  const doc = useEditorStore((s) => s.document)
  const loading = useEditorStore((s) => s.loadStatus.kind === 'loading')

  return (
    <footer className={styles.timeline} aria-label="タイムライン">
      <TimelineToolbar />
      {doc ? (
        <DopeSheet key={doc.name + doc.frameCount} />
      ) : (
        <div className={styles.empty}>
          <p>モーション(.vrma)をドロップすると、ボーンごとのキーが表示されます</p>
          <button type="button" className={styles.sampleBtn} onClick={() => void openSampleVrma()} disabled={loading}>
            サンプルを読む
          </button>
        </div>
      )}
    </footer>
  )
}

function TimelineToolbar() {
  const doc = useEditorStore((s) => s.document)
  const setReduceAngle = useEditorStore((s) => s.setReduceAngle)
  const angle = doc?.tolerance.angleDeg ?? 0.5
  const [draft, setDraft] = useState<string | null>(null)
  const keyCount = useMemo(() => (doc ? countKeys(doc) : 0), [doc])

  const commit = () => {
    if (draft == null) return
    const v = Number(draft)
    if (Number.isFinite(v) && v > 0) setReduceAngle(clamp(v, 0.01, 30))
    setDraft(null)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    }
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label="タイムラインの表示">
        <button type="button" role="tab" aria-selected="true" className={styles.tabActive}>
          ドープシート
        </button>
        <button type="button" role="tab" aria-selected="false" disabled title="グラフエディタは今後対応します">
          グラフ
        </button>
      </div>
      <span className={styles.meta}>
        スナップ <span className="mono">1f</span>
      </span>
      <label className={styles.meta}>
        キー間引き
        <input
          className={`mono ${styles.num}`}
          type="number"
          min={0.01}
          max={30}
          step={0.1}
          disabled={!doc?.bakedSource}
          value={draft ?? String(angle)}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={onKey}
          aria-label="キー間引きの角度しきい値(度)"
        />
        °
      </label>
      {doc && (
        <span className={`${styles.meta} ${styles.right}`}>
          <span className={styles.docName} title={doc.name}>
            {doc.name}
          </span>
          <span className="mono">{keyCount.toLocaleString()} キー</span>
        </span>
      )}
    </div>
  )
}

function DopeSheet() {
  const doc = useEditorStore((s) => s.document)!
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const rows = useMemo(() => buildRows(doc, expanded), [doc, expanded])

  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<TimelineView>({ width: 0, height: 0, scrollX: 0, scrollY: 0, pxPerFrame: 8 })
  const rowsRef = useRef<readonly TimelineRow[]>(rows)
  const colorsRef = useRef<TimelineColors | null>(null)
  const rafRef = useRef(0)
  const fittedRef = useRef(false)

  const draw = useCallback(() => {
    rafRef.current = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const s = useEditorStore.getState()
    if (!canvas || !ctx || !s.document) return
    const view = viewRef.current
    if (view.width === 0 || view.height === 0) return
    colorsRef.current ??= readColors(canvas)
    const dpr = canvas.width / view.width
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawTimeline({
      ctx,
      view,
      rows: rowsRef.current,
      frameCount: s.document.frameCount,
      frame: s.frame,
      colors: colorsRef.current,
    })
  }, [])

  const requestDraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  const setScrollX = useCallback(
    (x: number) => {
      const view = viewRef.current
      const frameCount = useEditorStore.getState().document?.frameCount ?? 1
      view.scrollX = clamp(x, 0, maxScrollX(frameCount, view))
      requestDraw()
    },
    [requestDraw],
  )

  // 行が変わったら描き直す
  useEffect(() => {
    rowsRef.current = rows
    requestDraw()
  }, [rows, requestDraw])

  // キャンバスの大きさ(初回はクリップ全体が入る倍率にする)
  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const view = viewRef.current
      view.width = w
      view.height = h
      if (!fittedRef.current) {
        fittedRef.current = true
        const frameCount = useEditorStore.getState().document?.frameCount ?? 1
        view.pxPerFrame = clamp((w - LEFT_PAD * 2) / Math.max(1, frameCount - 1), MIN_PX_PER_FRAME, MAX_PX_PER_FRAME)
      }
      setScrollX(view.scrollX)
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()
    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [draw, setScrollX])

  // フレーム・ドキュメントの変化で描き直す。再生中は再生ヘッドが見える位置へ追従する
  useEffect(
    () =>
      useEditorStore.subscribe((state, prev) => {
        if (state.frame === prev.frame && state.document === prev.document) return
        if (state.isPlaying) {
          const view = viewRef.current
          const x = frameToX(state.frame, view)
          if (x < 0 || x > view.width - 24) setScrollX(view.scrollX + x - view.width * 0.1)
        }
        requestDraw()
      }),
    [requestDraw, setScrollX],
  )

  // ホイール: 横スクロール / Ctrl・⌘ でズーム / Shift で縦スクロール(preventDefault のため passive: false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const view = viewRef.current
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.width : 1
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const anchor = xToFrame(mx, view)
        view.pxPerFrame = clamp(view.pxPerFrame * Math.exp(-e.deltaY * unit * 0.002), MIN_PX_PER_FRAME, MAX_PX_PER_FRAME)
        setScrollX(LEFT_PAD + anchor * view.pxPerFrame - mx)
        return
      }
      if (e.shiftKey && labelsRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        labelsRef.current.scrollTop += e.deltaY * unit
        return
      }
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      setScrollX(view.scrollX + d * unit)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [setScrollX])

  // ルーラー・トラックのクリック / ドラッグでスクラブ
  const scrubTo = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const x = clientX - canvas.getBoundingClientRect().left
    useEditorStore.getState().setFrame(Math.round(xToFrame(x, viewRef.current)))
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    useEditorStore.getState().setPlaying(false)
    scrubTo(e.clientX)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX)
  }

  const onLabelsScroll = () => {
    viewRef.current.scrollY = labelsRef.current?.scrollTop ?? 0
    requestDraw()
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className={styles.body}>
      <div ref={labelsRef} className={styles.labels} onScroll={onLabelsScroll}>
        <div className={styles.labelsHeader} style={{ height: RULER_H }}>
          <span className="mono">
            {doc.fps}fps · {doc.frameCount}f
          </span>
        </div>
        {rows.map((row) =>
          row.expandable ? (
            <button
              key={row.id}
              type="button"
              className={`${styles.label} ${styles.group}`}
              data-side={row.side}
              aria-expanded={row.expanded}
              onClick={() => toggle(row.id)}
            >
              <span className={styles.caret} aria-hidden="true">
                {row.expanded ? '▾' : '▸'}
              </span>
              <span className={styles.dot} aria-hidden="true" />
              {row.label}
            </button>
          ) : (
            <div
              key={row.id}
              className={`${styles.label} ${row.depth === 0 ? styles.group : styles.child}`}
              data-side={row.side}
              title={row.label}
            >
              {row.depth === 0 && <span className={styles.caret} aria-hidden="true" />}
              <span className={styles.dot} aria-hidden="true" />
              {row.label}
            </div>
          ),
        )}
      </div>
      <div ref={hostRef} className={styles.tracks}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          aria-label="ドープシート(クリック・ドラッグで再生位置を移動)"
        />
      </div>
    </div>
  )
}
