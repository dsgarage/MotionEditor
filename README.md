# MotionEditor

Humanoid アバター(VRM)のモーションをブラウザでキーフレーム編集し、Unity Humanoid の `.anim` として書き出すための Web アプリです。
[Pose2Clip](https://github.com/dsgarage/Pose2Clip) が出力したモーションの手直しツールとして開発しています。

- 仕様: [docs/requirements.md](docs/requirements.md)
- ライセンス: MIT

## 構成

```
web/      エディタ本体(Vite + React + Three.js + three-vrm)
unity/    ベイク用 Unity プロジェクト(VRM + VRMA → .anim / .p2cmotion)
scripts/  ベイクジョブ・配信スクリプト
docs/     仕様・データフロー
```

## 開発

```sh
cd web
npm install
npm run dev
```
