import type { TimelineRow } from './rows'

export const RULER_H = 24
export const ROW_H = 26
/** フレーム 0 のキーが左端で欠けないための余白 */
export const LEFT_PAD = 12
export const MIN_PX_PER_FRAME = 2
export const MAX_PX_PER_FRAME = 40

export interface TimelineColors {
  track: string
  tray: string
  rule: string
  fg: string
  fg3: string
  key: string
  playhead: string
}

const MONO = '"Spline Sans Mono", monospace'

/** CSS のデザイントークンから描画色を取る */
export function readColors(el: Element): TimelineColors {
  const cs = getComputedStyle(el)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    track: v('--track', '#222222'),
    tray: v('--tray', '#262626'),
    rule: v('--rule', '#3a3a3a'),
    fg: v('--fg', '#ececec'),
    fg3: v('--fg-3', '#6f6f6f'),
    key: v('--key', '#ffd23f'),
    playhead: v('--playhead', '#ff4d3d'),
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
  /** 強調する行(選択ボーンを含む行)の id */
  highlight?: ReadonlySet<string>
}

/**
 * ルーラー + ドープシートを描く。可視範囲のフレーム・行だけを描くので、キー数に比例して重くならない
 */
export function drawTimeline({ ctx, view, rows, frameCount, frame, colors, highlight }: DrawInput): void {
  const { width, height, pxPerFrame } = view
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = colors.track
  ctx.fillRect(0, 0, width, height)

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
  // 菱形の半対角線。拡大時は 10px 角の菱形、詰まってきたら小さくする
  const half = pxPerFrame >= 10 ? 7 : pxPerFrame >= 6 ? 5 : 3.5

  for (let r = r0; r <= r1; r++) {
    const row = rows[r]
    const top = RULER_H + r * ROW_H - view.scrollY
    const cy = top + ROW_H / 2

    // 行の地: 1 行おきにわずかに明るく。選択ボーンの行はさらに明るく
    if (highlight?.has(row.id)) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, top, width, ROW_H)
    } else if (r % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      ctx.fillRect(0, top, width, ROW_H)
    }

    // 生データの帯
    if (row.baked && frameCount > 0) {
      const bx0 = Math.max(0, frameToX(0, view))
      const bx1 = Math.min(width, endX)
      if (bx1 > bx0) {
        ctx.globalAlpha = 0.1
        ctx.fillStyle = colors.key
        ctx.fillRect(bx0, cy - 4, bx1 - bx0, 8)
        ctx.globalAlpha = 1
      }
    }

    // キー(黄の菱形)。同じピクセルに重なるキーは 1 つだけ描く
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
      // 隣り合うキーが 1 つの塊に見えないよう、トラック面の色で縁を切る
      ctx.strokeStyle = colors.track
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // クリップ末尾より後ろを沈める
  if (endX < width) {
    ctx.fillStyle = colors.tray
    ctx.globalAlpha = 0.7
    ctx.fillRect(Math.max(0, endX + LEFT_PAD / 2), RULER_H, width, height - RULER_H)
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // ---- ルーラー ----
  ctx.fillStyle = colors.track
  ctx.fillRect(0, 0, width, RULER_H)

  const step = labelStep(pxPerFrame)
  ctx.font = `11px ${MONO}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  // 1 フレーム目盛り(拡大時のみ)
  if (pxPerFrame >= 8) {
    ctx.fillStyle = colors.rule
    for (let f = f0; f <= f1; f++) {
      if (f % 10 === 0) continue
      ctx.fillRect(Math.round(frameToX(f, view)), RULER_H - 5, 1, 4)
    }
  }
  // 10 フレームごとの目盛り。ラベルの付く目盛りは縦線 + 数字
  for (let f = Math.floor(f0 / 10) * 10; f <= f1; f += 10) {
    if (f < 0) continue
    const x = Math.round(frameToX(f, view))
    const major = f % step === 0
    ctx.fillStyle = colors.rule
    if (major) {
      ctx.fillRect(x, 5, 1, 14)
      ctx.fillStyle = colors.fg3
      ctx.fillText(String(f), x + 5, 12.5)
    } else {
      ctx.fillRect(x, RULER_H - 8, 1, 7)
    }
  }

  // ---- 再生ヘッド: 赤 2px の線 + 上端の赤タグ ----
  const px = Math.round(frameToX(frame, view))
  if (px >= -40 && px <= width + 40) {
    ctx.fillStyle = colors.playhead
    ctx.fillRect(px - 1, 0, 2, height)

    const label = String(frame)
    ctx.font = `500 11.5px ${MONO}`
    const tw = Math.max(38, Math.ceil(ctx.measureText(label).width) + 12)
    const tx = Math.min(Math.max(px - tw / 2, 0), width - tw)
    bottomRoundRect(ctx, tx, 0, tw, 20, 6)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, tx + tw / 2, 10.5)
  }
}

/** 上辺が直角・下の 2 角だけ丸い矩形 */
function bottomRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.closePath()
}
