import { useEffect, useRef, useState } from 'react'
import { openVrmFile } from '../avatar/openVrmFile'
import { useEditorStore } from '../store/editorStore'
import styles from './DropZone.module.css'

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

/** 画面全体へのドラッグ&ドロップを受け付け、ドラッグ中のオーバーレイとエラーメッセージを出す */
export function DropZone() {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const loadStatus = useEditorStore((s) => s.loadStatus)
  const setLoadStatus = useEditorStore((s) => s.setLoadStatus)

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) void openVrmFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <>
      {dragging && (
        <div className={styles.overlay}>
          <div className={styles.overlayBox}>.vrm をドロップして読み込む</div>
        </div>
      )}
      {loadStatus.kind === 'error' && (
        <div className={styles.toast} role="alert">
          <span>{loadStatus.message}</span>
          <button type="button" onClick={() => setLoadStatus({ kind: 'idle' })} aria-label="閉じる">
            ×
          </button>
        </div>
      )}
    </>
  )
}

/** 「ファイルを選ぶ」ボタン */
export function OpenFileButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}>
        ファイルを選ぶ
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".vrm"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void openVrmFile(file)
        }}
      />
    </>
  )
}
