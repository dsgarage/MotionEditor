import { create } from 'zustand'
import type { VRM, VRMMeta } from '@pixiv/three-vrm'
import type { AvatarLicense } from '../avatar/license'
import type { MotionDocument } from '../motion/MotionDocument'
import { rereduce } from '../motion/reduce'

export interface Avatar {
  name: string
  meta: VRMMeta
  license: AvatarLicense
  /** 表示用の VRM インスタンス(シリアライズしない) */
  vrm: VRM
}

export type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; fileName: string }
  | { kind: 'error'; message: string }

export interface EditorState {
  avatar: Avatar | null
  /** 編集中のモーション。未読込なら null */
  document: MotionDocument | null
  frame: number
  fps: number
  isPlaying: boolean
  loopEnabled: boolean
  /** 選択中のボーン(表示用。選択操作は #4) */
  selectedBones: string[]
  loadStatus: LoadStatus

  setAvatar: (avatar: Avatar | null) => void
  setDocument: (document: MotionDocument | null) => void
  /** 回転の間引きしきい値(度)を変えてキー列を作り直す */
  setReduceAngle: (angleDeg: number) => void
  setFrame: (frame: number) => void
  /** 現在のフレームから delta だけ動かす(範囲内に収める) */
  stepFrame: (delta: number) => void
  setPlaying: (playing: boolean) => void
  setLoopEnabled: (loop: boolean) => void
  setLoadStatus: (status: LoadStatus) => void
}

export const initialEditorState = {
  avatar: null,
  document: null,
  frame: 0,
  fps: 30,
  isPlaying: false,
  loopEnabled: true,
  selectedBones: [],
  loadStatus: { kind: 'idle' },
} satisfies Pick<
  EditorState,
  'avatar' | 'document' | 'frame' | 'fps' | 'isPlaying' | 'loopEnabled' | 'selectedBones' | 'loadStatus'
>

/** ドキュメントがあれば 0〜frameCount-1、無ければ 0 以上に丸める */
function clampFrame(frame: number, document: MotionDocument | null): number {
  const f = Math.max(0, Math.floor(frame))
  return document ? Math.min(f, document.frameCount - 1) : f
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...initialEditorState,
  setAvatar: (avatar) => set({ avatar }),
  setDocument: (document) =>
    set({
      document,
      frame: 0,
      isPlaying: false,
      fps: document?.fps ?? initialEditorState.fps,
      selectedBones: [],
    }),
  setReduceAngle: (angleDeg) => {
    const { document } = get()
    if (!document || !(angleDeg > 0) || angleDeg === document.tolerance.angleDeg) return
    set({ document: rereduce(document, { ...document.tolerance, angleDeg }) })
  },
  setFrame: (frame) => set({ frame: clampFrame(frame, get().document) }),
  stepFrame: (delta) => set({ frame: clampFrame(get().frame + delta, get().document) }),
  setPlaying: (isPlaying) => set({ isPlaying: isPlaying && get().document != null }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setLoadStatus: (loadStatus) => set({ loadStatus }),
}))
