import type { CSSProperties, ReactNode } from 'react'

/** 線のアイコン(24 グリッド、線幅 2、currentColor) */
function Stroke({ size = 17, width = 2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** 塗りのアイコン(再生系の記号) */
function Fill({ size = 16, children, style }: { size?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={style}>
      {children}
    </svg>
  )
}

export const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 18l6-13 4 9 3-5 5 9" />
  </svg>
)

export const MoveIcon = () => (
  <Stroke>
    <path d="M12 2v20M2 12h20" />
    <path d="M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
  </Stroke>
)

export const RotateIcon = () => (
  <Stroke>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </Stroke>
)

export const IkIcon = () => (
  <Stroke>
    <circle cx="5" cy="19" r="2" />
    <circle cx="12" cy="7" r="2" />
    <circle cx="19" cy="17" r="2" />
    <path d="M6.5 17.5L11 8.5M13.5 8.5l4 7" />
  </Stroke>
)

export const MirrorIcon = () => (
  <Stroke>
    <path d="M12 3v18" />
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
  </Stroke>
)

export const OnionIcon = () => (
  <Stroke>
    <circle cx="9" cy="12" r="6" />
    <circle cx="15" cy="12" r="6" opacity="0.5" />
  </Stroke>
)

export const FocusIcon = () => (
  <Stroke>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
)

export const ToStartIcon = () => (
  <Fill>
    <path d="M19 20L9 12l10-8v16z" />
    <rect x="4" y="4" width="2.5" height="16" rx="1" />
  </Fill>
)

export const ToEndIcon = () => (
  <Fill>
    <path d="M5 4l10 8-10 8V4z" />
    <rect x="17.5" y="4" width="2.5" height="16" rx="1" />
  </Fill>
)

export const StepBackIcon = () => (
  <Stroke size={16} width={2.2}>
    <path d="M15 18l-6-6 6-6" />
  </Stroke>
)

export const StepForwardIcon = () => (
  <Stroke size={16} width={2.2}>
    <path d="M9 6l6 6-6 6" />
  </Stroke>
)

export const PlayIcon = () => (
  // 三角形は重心が左に寄って見えるので 2px 右へ寄せる
  <Fill size={18} style={{ marginLeft: 2 }}>
    <path d="M7 5l12 7-12 7z" />
  </Fill>
)

export const PauseIcon = () => (
  <Fill size={18}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Fill>
)

export const LoopIcon = () => (
  <Stroke size={15}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Stroke>
)

export const TrashIcon = () => (
  <Stroke size={15}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Stroke>
)

export const ChevronIcon = ({ dir }: { dir: 'left' | 'right' | 'down' }) => (
  <Stroke size={14}>
    <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : dir === 'right' ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'} />
  </Stroke>
)

export const CloseIcon = () => (
  <Stroke size={14}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
)
