import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TOLERANCE, type MotionDocument } from '../motion/MotionDocument'
import { reduceBaked } from '../motion/reduce'
import { axisAngle } from '../motion/testing/buildVrma'
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

describe('editorStore(モーション)', () => {
  beforeEach(() => {
    useEditorStore.setState(initialEditorState)
  })

  const makeDoc = (): MotionDocument => {
    const baked = new Float32Array(100 * 4)
    for (let f = 0; f < 100; f++) baked.set(axisAngle([0, 1, 0], Math.sin(f / 10)), f * 4)
    const bakedSource = { rotations: { head: baked }, hipsPosition: null, expressions: {} }
    return {
      name: 'd',
      fps: 60,
      frameCount: 100,
      ...reduceBaked(bakedSource, 100, DEFAULT_TOLERANCE),
      restHipsHeight: 1,
      tolerance: DEFAULT_TOLERANCE,
      bakedSource,
    }
  }

  it('setDocument でフレームを 0 に戻し fps をドキュメントに合わせる', () => {
    useEditorStore.getState().setFrame(40)
    useEditorStore.getState().setDocument(makeDoc())
    const s = useEditorStore.getState()
    expect(s.frame).toBe(0)
    expect(s.fps).toBe(60)
    expect(s.isPlaying).toBe(false)
    expect(s.selectedBones).toEqual([])
  })

  it('ドキュメントがあるとフレームは 0〜frameCount-1 に収まる', () => {
    useEditorStore.getState().setDocument(makeDoc())
    useEditorStore.getState().setFrame(500)
    expect(useEditorStore.getState().frame).toBe(99)
    useEditorStore.getState().stepFrame(-10)
    expect(useEditorStore.getState().frame).toBe(89)
    useEditorStore.getState().stepFrame(-1000)
    expect(useEditorStore.getState().frame).toBe(0)
  })

  it('ドキュメントが無いと再生しない', () => {
    useEditorStore.getState().setPlaying(true)
    expect(useEditorStore.getState().isPlaying).toBe(false)
  })

  it('間引きしきい値を大きくするとキーが減る', () => {
    useEditorStore.getState().setDocument(makeDoc())
    const before = useEditorStore.getState().document!.tracks.head!.length
    useEditorStore.getState().setReduceAngle(5)
    const after = useEditorStore.getState().document!
    expect(after.tolerance.angleDeg).toBe(5)
    expect(after.tracks.head!.length).toBeLessThan(before)
  })
})
