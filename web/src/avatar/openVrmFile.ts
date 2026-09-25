import { useEditorStore } from '../store/editorStore'
import { isVrmFileName, loadVrm, MAX_FILE_BYTES } from './loadVrm'

/** ドロップ・ファイル選択の共通入口。検証 → 読み込み → ストアへ反映 */
export async function openVrmFile(file: File): Promise<void> {
  const { setAvatar, setLoadStatus } = useEditorStore.getState()

  if (!isVrmFileName(file.name)) {
    setLoadStatus({ kind: 'error', message: `「${file.name}」は読み込めません。.vrm ファイルを選んでください` })
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    setLoadStatus({ kind: 'error', message: `「${file.name}」は 100MB を超えているため読み込めません` })
    return
  }

  setLoadStatus({ kind: 'loading', fileName: file.name })
  try {
    const { vrm, license } = await loadVrm(file)
    setAvatar({ name: license.name, meta: vrm.meta, license, vrm })
    setLoadStatus({ kind: 'idle' })
  } catch (e) {
    console.error(e)
    const reason = e instanceof Error ? e.message : String(e)
    setLoadStatus({ kind: 'error', message: `「${file.name}」の読み込みに失敗しました: ${reason}` })
  }
}
