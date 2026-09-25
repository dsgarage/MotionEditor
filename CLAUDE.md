# MotionEditor

Humanoid モーション編集 Web アプリ。最終出力は Unity Humanoid `.anim`。仕様は `docs/requirements.md`。

## 方針

- Web はボーン回転(VRMA)で編集し、Muscle 変換は Unity(`HumanPoseHandler`)に残す。Web で Muscle を計算しない
- ファイル内容を外部へ送らない(一般公開・無料)
- ブランチ運用は Git Flow(`main` / `develop` / `feature/<issue>-<slug>`)。`main`・`develop` は PR 経由のみ

## ディレクトリ

- `web/` エディタ本体(Vite + React + TS + Three.js + three-vrm)
- `unity/` ベイク用 Unity プロジェクト(UniVRM)
- `scripts/` exia で回すベイク・配信スクリプト
- `docs/` 仕様

## コマンド

- `cd web && npm run dev` 開発サーバ
- `cd web && npm run build` ビルド
- `cd web && npm test` テスト
