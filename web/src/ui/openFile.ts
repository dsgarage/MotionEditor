import { isVrmFileName } from '../avatar/loadVrm'
import { openVrmFile } from '../avatar/openVrmFile'
import { isVrmaFileName } from '../motion/loadVrma'
import { openVrmaFile } from '../motion/openVrmaFile'
import { useEditorStore } from '../store/editorStore'

/** ファイル選択で受け付ける拡張子 */
export const ACCEPT_EXTENSIONS = '.vrm,.vrma'

/** 拡張子で振り分ける: .vrm はアバター、.vrma はモーション */
export async function openFile(file: File): Promise<void> {
  if (isVrmaFileName(file.name)) return openVrmaFile(file)
  if (isVrmFileName(file.name)) return openVrmFile(file)
  useEditorStore.getState().setLoadStatus({
    kind: 'error',
    message: `「${file.name}」は読み込めません。.vrm(アバター)か .vrma(モーション)を選んでください`,
  })
}
