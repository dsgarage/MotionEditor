import { beforeEach, describe, expect, it } from 'vitest'
import { initialEditorState, useEditorStore } from './editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState(initialEditorState)
  })

  it('初期状態はアバター無し・0 フレーム・30fps・停止中', () => {
    const s = useEditorStore.getState()
    expect(s.avatar).toBeNull()
    expect(s.frame).toBe(0)
    expect(s.fps).toBe(30)
    expect(s.isPlaying).toBe(false)
    expect(s.loadStatus).toEqual({ kind: 'idle' })
  })

  it('setFrame は負値と小数を丸める', () => {
    useEditorStore.getState().setFrame(-3)
    expect(useEditorStore.getState().frame).toBe(0)
    useEditorStore.getState().setFrame(12.7)
    expect(useEditorStore.getState().frame).toBe(12)
  })
})
