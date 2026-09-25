import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import App from './app/App.tsx'
import { useEditorStore } from './store/editorStore'

// 開発サーバでだけ、ブラウザ自動テストから状態を読めるようにする(本番ビルドには入らない)
if (import.meta.env.DEV) {
  ;(window as unknown as { __editorStore: typeof useEditorStore }).__editorStore = useEditorStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
