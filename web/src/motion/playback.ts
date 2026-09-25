import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

/**
 * 再生中は requestAnimationFrame で「起点フレーム + 経過時間 × fps」へ進める。
 * 末尾に来たらループ(loopEnabled)か停止。フレームは整数で進むので、評価結果はスクラブと同じになる
 */
export function startPlaybackLoop(): () => void {
  let raf = 0
  let startTime = 0
  let startFrame = 0
  /** tick 自身が最後に設定したフレーム。これ以外への変化はユーザー操作とみなして起点を取り直す */
  let ownFrame = -1

  const tick = (now: number) => {
    const s = useEditorStore.getState()
    const doc = s.document
    if (!s.isPlaying || !doc) return
    const last = doc.frameCount - 1
    let target = startFrame + Math.floor(((now - startTime) / 1000) * doc.fps)
    if (target > last) {
      if (!s.loopEnabled || doc.frameCount <= 1) {
        ownFrame = last
        s.setFrame(last)
        s.setPlaying(false)
        return
      }
      target %= doc.frameCount
    }
    if (target !== s.frame) {
      ownFrame = target
      s.setFrame(target)
    }
    raf = requestAnimationFrame(tick)
  }

  const begin = () => {
    const s = useEditorStore.getState()
    const doc = s.document
    if (!doc) return
    // 末尾で止まっている状態から再生したら先頭に戻す
    if (s.frame >= doc.frameCount - 1) {
      ownFrame = 0
      s.setFrame(0)
    }
    startFrame = useEditorStore.getState().frame
    ownFrame = startFrame
    startTime = performance.now()
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(tick)
  }

  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (state.isPlaying && !prev.isPlaying) begin()
    else if (!state.isPlaying && prev.isPlaying) cancelAnimationFrame(raf)
    else if (state.isPlaying && state.frame !== prev.frame && state.frame !== ownFrame) begin()
  })

  return () => {
    unsubscribe()
    cancelAnimationFrame(raf)
  }
}

/** App のマウント中だけ再生ループを動かす */
export function usePlaybackLoop(): void {
  useEffect(() => startPlaybackLoop(), [])
}
