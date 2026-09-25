import { MAX_FILE_BYTES } from '../avatar/loadVrm'
import { useEditorStore } from '../store/editorStore'
import { fromVrmAnimation } from './fromVrmAnimation'
import { isVrmaFileName, parseVrma } from './loadVrma'

/** 同梱のサンプル VRMA(pixiv/three-vrm の examples、MIT) */
export const SAMPLE_VRMA_URL = `${import.meta.env.BASE_URL}samples/test.vrma`

const NEED_AVATAR = '先にアバターを読み込んでください'

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/** バイト列 → MotionDocument → ストア。アバターが無ければ読まない */
async function loadMotion(fileName: string, getBuffer: () => Promise<ArrayBuffer>): Promise<void> {
  const { avatar, setDocument, setLoadStatus } = useEditorStore.getState()
  if (!avatar) {
    setLoadStatus({ kind: 'error', message: NEED_AVATAR })
    return
  }
  setLoadStatus({ kind: 'loading', fileName })
  try {
    const anim = await parseVrma(await getBuffer())
    const doc = fromVrmAnimation(anim, { name: stripExt(fileName) })
    // 前のモーションで動いたボーンを静止姿勢に戻してから差し替える
    useEditorStore.getState().avatar?.vrm.humanoid.resetNormalizedPose()
    setDocument(doc)
    setLoadStatus({ kind: 'idle' })
  } catch (e) {
    console.error(e)
    const reason = e instanceof Error ? e.message : String(e)
    setLoadStatus({ kind: 'error', message: `「${fileName}」の読み込みに失敗しました: ${reason}` })
  }
}

/** ドロップ・ファイル選択された .vrma を読む */
export async function openVrmaFile(file: File): Promise<void> {
  const { setLoadStatus } = useEditorStore.getState()
  if (!isVrmaFileName(file.name)) {
    setLoadStatus({ kind: 'error', message: `「${file.name}」は読み込めません。.vrma ファイルを選んでください` })
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    setLoadStatus({ kind: 'error', message: `「${file.name}」は 100MB を超えているため読み込めません` })
    return
  }
  await loadMotion(file.name, () => file.arrayBuffer())
}

/** 同梱のサンプル VRMA を読む */
export async function openSampleVrma(): Promise<void> {
  await loadMotion('test.vrma', async () => {
    const res = await fetch(SAMPLE_VRMA_URL)
    if (!res.ok) throw new Error(`サンプルを取得できませんでした(HTTP ${res.status})`)
    return res.arrayBuffer()
  })
}
