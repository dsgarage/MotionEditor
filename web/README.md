# MotionEditor Web

VRM アバターのモーションをブラウザで編集するエディタ本体です(Vite + React + TypeScript + Three.js + three-vrm)。
仕様はリポジトリ直下の `docs/requirements.md` を参照してください。

## コマンド

Node.js 22 を想定しています。

```sh
npm ci          # 依存のインストール
npm run dev     # 開発サーバ(http://localhost:5173)
npm run build   # 型チェック + 本番ビルド(dist/)
npm test        # テスト(vitest)
npm run lint    # lint(oxlint)
```

## 使い方(現時点)

- 起動するとビューポートに簡易マネキンが出ます
- `.vrm`(VRM 0.x / 1.0)を画面にドラッグ&ドロップするか、ツールバーの「ファイルを選ぶ」で開くと表示が切り替わります
- ビューポート右下にアバター名と改変・再配布の可否が出ます(改変禁止なら警告色)
- ファイルはブラウザ内だけで処理し、外部へ送りません

## 構成

```
src/
  app/        レイアウト(ツールバー / 左右パネル / ビューポート / タイムライン)
  viewport/   Three.js のシーンと描画ループ、未読込時のマネキン
  avatar/     VRM 読み込みとライセンス情報の正規化
  store/      zustand のエディタ状態
  ui/         ドロップ受付・ライセンス表示
  styles/     デザイントークン(tokens.css)とグローバル CSS
```
