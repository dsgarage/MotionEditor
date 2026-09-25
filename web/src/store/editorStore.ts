import { create } from 'zustand'
import type { VRM, VRMMeta } from '@pixiv/three-vrm'
import type { AvatarLicense } from '../avatar/license'

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
  frame: number
  fps: number
  isPlaying: boolean
  loadStatus: LoadStatus

  setAvatar: (avatar: Avatar | null) => void
  setFrame: (frame: number) => void
  setPlaying: (playing: boolean) => void
  setLoadStatus: (status: LoadStatus) => void
}

export const initialEditorState = {
  avatar: null,
  frame: 0,
  fps: 30,
  isPlaying: false,
  loadStatus: { kind: 'idle' },
} satisfies Pick<EditorState, 'avatar' | 'frame' | 'fps' | 'isPlaying' | 'loadStatus'>

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialEditorState,
  setAvatar: (avatar) => set({ avatar }),
  setFrame: (frame) => set({ frame: Math.max(0, Math.floor(frame)) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setLoadStatus: (loadStatus) => set({ loadStatus }),
}))
