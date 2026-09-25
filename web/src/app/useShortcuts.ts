import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

/** 入力欄・編集可能な要素にフォーカスがあるときはショートカットを無効にする */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * 再生系のショートカット(Blender / Unity に合わせる)
 * Space 再生・一時停止、← → 1 フレーム、Shift+← → 10 フレーム、Home / End 先頭・末尾
 */
export function handleShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return false
  const s = useEditorStore.getState()
  if (!s.document) return false
  switch (e.key) {
    case ' ':
      s.setPlaying(!s.isPlaying)
      return true
    case 'ArrowLeft':
      s.setPlaying(false)
      s.stepFrame(e.shiftKey ? -10 : -1)
      return true
    case 'ArrowRight':
      s.setPlaying(false)
      s.stepFrame(e.shiftKey ? 10 : 1)
      return true
    case 'Home':
      s.setFrame(0)
      return true
    case 'End':
      s.setFrame(s.document.frameCount - 1)
      return true
    default:
      return false
  }
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ボタンにフォーカスがあるときの Space でボタンが二重に押されないよう既定動作を止める
      if (handleShortcut(e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
