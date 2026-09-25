import type { TimelineRow } from './rows'

export const RULER_H = 28
export const ROW_H = 28
/** フレーム 0 のキーが左端で欠けないための余白 */
export const LEFT_PAD = 12
export const MIN_PX_PER_FRAME = 2
export const MAX_PX_PER_FRAME = 40

export interface TimelineColors {
  bg: string
  panel: string
  line: string
  text: string
  textSub: string
  accent: string
  key: string
}

/** CSS のデザイントークンから描画色を取る */
export function readColors(el: Element): TimelineColors {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--color-bg', '#15171c'),
    panel: v('--color-panel', '#1c1f26'),
    line: v('--color-line', '#2e333d'),
    text: v('--color-text', '#e8eaef'),
    textSub: v('--color-text-sub', '#8f97a5'),
    accent: v('--color-accent', '#3ec9b3'),
    key: v('--color-key', '#f5b431'),
  }
}

export interface TimelineView {
  width: number
  height: number
  /** 横スクロール量(px) */
  scrollX: number
  /** 行の縦スクロール量(px) */
  scrollY: number
  pxPerFrame: number
}

export function frameToX(frame: number, view: TimelineView): number {
  return LEFT_PAD + frame * view.pxPerFrame - view.scrollX
}

export function xToFrame(x: number, view: TimelineView): number {
  return (x + view.scrollX - LEFT_PAD) / view.pxPerFrame
}

/** 横スクロールの上限 */
export function maxScrollX(frameCount: number, view: Pick<TimelineView, 'width' | 'pxPerFrame'>): number {
  return Math.max(0, LEFT_PAD * 2 + Math.max(0, frameCount - 1) * view.pxPerFrame - view.width)
}

/** ラベルが重ならない目盛りラベルの間隔(フレーム) */
export function labelStep(pxPerFrame: number): number {
  for (const step of [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) {
    if (step * pxPerFrame >= 48) return step
  }
  return 10000
}

/** 昇順の frames から value 以上の最初の添字 */
function lowerBound(frames: Int32Array, value: number): number {
  let lo = 0
  let hi = frames.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

export interface DrawInput {
  ctx: CanvasRenderingContext2D
  view: TimelineView
  rows: readonly TimelineRow[]
  frameCount: number
  frame: number
  colors: TimelineColors
}

/**
 * ルーラー + ドープシートを描く。可視範囲のフレーム・行だけを描くので、キー数に比例して重くならない
 */
export function drawTimeline({ ctx, view, rows, frameCount, frame, colors }: DrawInput): void {
  const { width, height, pxPerFrame } = view
  ctx.clearRect(0, 0, width, height)

  // 可視フレーム範囲
  const f0 = Math.max(0, Math.floor(xToFrame(0, view)) - 1)
  const f1 = Math.min(frameCount - 1, Math.ceil(xToFrame(width, view)) + 1)
  const endX = frameToX(frameCount - 1, view)

  // ---- 行 ----
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, RULER_H, width, height - RULER_H)
  ctx.clip()

  const r0 = Math.max(0, Math.floor(view.scrollY / ROW_H))
  const r1 = Math.min(rows.length - 1, Math.floor((view.scrollY + height - RULER_H) / ROW_H))
  const half = pxPerFrame >= 6 ? 5 : 3.5

  for (let r = r0; r <= r1; r++) {
    const row = rows[r]
    const top = RULER_H + r * ROW_H - view.scrollY
    const cy = top + ROW_H / 2

    // 行の地(グループ行は少し明るく)
    ctx.fillStyle = row.depth === 0 ? colors.panel : colors.bg
    ctx.fillRect(0, top, width, ROW_H)
    ctx.fillStyle = colors.line
    ctx.fillRect(0, top + ROW_H - 1, width, 1)

    // 生データの帯
    if (row.baked && frameCount > 0) {
      const bx0 = Math.max(0, frameToX(0, view))
      const bx1 = Math.min(width, endX)
      if (bx1 > bx0) {
        ctx.globalAlpha = 0.14
        ctx.fillStyle = colors.key
        ctx.fillRect(bx0, cy - 5, bx1 - bx0, 10)
        ctx.globalAlpha = 1
      }
    }

    // キー(菱形)。同じピクセルに重なるキーは 1 つだけ描く
    const frames = row.frames
    if (frames.length === 0) continue
    ctx.beginPath()
    let lastX = -Infinity
    for (let i = lowerBound(frames, f0); i < frames.length; i++) {
      const f = frames[i]
      if (f > f1) break
      const x = Math.round(frameToX(f, view)) + 0.5
      if (x - lastX < 1) continue
      lastX = x
      ctx.moveTo(x, cy - half)
      ctx.lineTo(x + half, cy)
      ctx.lineTo(x, cy + half)
      ctx.lineTo(x - half, cy)
      ctx.closePath()
    }
    ctx.fillStyle = colors.key
    ctx.fill()
    if (half >= 5) {
      ctx.strokeStyle = colors.bg
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // クリップ末尾より後ろを暗くする
  if (endX < width) {
    ctx.fillStyle = colors.bg
    ctx.globalAlpha = 0.6
    ctx.fillRect(Math.max(0, endX + LEFT_PAD / 2), RULER_H, width, height - RULER_H)
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // ---- ルーラー ----
  ctx.fillStyle = colors.panel
  ctx.fillRect(0, 0, width, RULER_H)
  ctx.fillStyle = colors.line
  ctx.fillRect(0, RULER_H - 1, width, 1)

  const step = labelStep(pxPerFrame)
  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  // 1 フレーム目盛り(拡大時のみ)
  if (pxPerFrame >= 8) {
    ctx.fillStyle = colors.line
    for (let f = f0; f <= f1; f++) {
      if (f % 10 === 0) continue
      ctx.fillRect(Math.round(frameToX(f, view)), RULER_H - 5, 1, 4)
    }
  }
  // 10 フレームごとの目盛りとラベル
  for (let f = Math.floor(f0 / 10) * 10; f <= f1; f += 10) {
    if (f < 0) continue
    const x = Math.round(frameToX(f, view))
    const major = f % step === 0
    ctx.fillStyle = major ? colors.textSub : colors.line
    ctx.fillRect(x, major ? RULER_H - 12 : RULER_H - 8, 1, major ? 11 : 7)
    if (major) {
      ctx.fillStyle = colors.textSub
      ctx.fillText(String(f), x + 3, 5)
    }
  }

  // ---- 再生ヘッド ----
  const px = Math.round(frameToX(frame, view)) + 0.5
  if (px >= -40 && px <= width + 40) {
    ctx.strokeStyle = colors.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, 4)
    ctx.lineTo(px, height)
    ctx.stroke()

    const label = String(frame)
    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'
    const tw = Math.ceil(ctx.measureText(label).width) + 10
    const tx = Math.min(Math.max(px - tw / 2, 0), width - tw)
    ctx.fillStyle = colors.accent
    roundRect(ctx, tx, 3, tw, 17, 4)
    ctx.fill()
    ctx.fillStyle = colors.bg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, tx + tw / 2, 12)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
