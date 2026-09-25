import { useEditorStore } from '../store/editorStore'
import c from '../ui/controls.module.css'
import { OpenFileButton } from '../ui/DropZone'
import { LogoMark } from '../ui/icons'
import styles from './App.module.css'

const SOON = '今後対応します'

/** 上バー: ロゴ・メニュー | モーション名と未保存の印 | 再ベイク・書き出し */
export function TopBar() {
  const doc = useEditorStore((s) => s.document)
  return (
    <header className={styles.topbar}>
      <div className={styles.topStart}>
        <LogoMark />
        <span className={styles.brand}>MotionEditor</span>
        <nav className={styles.menu} aria-label="メニュー">
          <OpenFileButton className={c.tab} />
          <button type="button" className={c.tab} aria-disabled="true" title={SOON}>
            編集
          </button>
          <button type="button" className={c.tab} aria-disabled="true" title={SOON}>
            表示
          </button>
        </nav>
      </div>
      <div className={styles.topCenter}>
        {doc ? (
          <>
            <span className={styles.docName} title={doc.name}>
              {doc.name}
            </span>
            <span className={styles.unsaved} aria-hidden="true" />
            <span>未保存</span>
          </>
        ) : (
          <span className={styles.noDoc}>モーション未読込</span>
        )}
      </div>
      <div className={styles.topEnd}>
        <button type="button" className={c.tab} aria-disabled="true" title={SOON}>
          Unity で再ベイク
        </button>
        <button type="button" className={c.primary} aria-disabled="true" title={SOON}>
          書き出し
        </button>
      </div>
    </header>
  )
}
