# MotionEditor 要件定義

最終更新: 2026-09-25

## 1. コンセプト

- Humanoid アバター(VRM)のモーションを、ブラウザ上でキーフレーム編集する Web アプリ
- 最終ゴールは **Unity Humanoid の `.anim`** を得ること
- [Pose2Clip](https://github.com/dsgarage/Pose2Clip)(動画からポーズ推定して AnimationClip 化するツール)が出力したクリップを手直しする編集ツールとして始め、最終的には Pose2Clip のインターフェースになる
- 一般公開・無料。ファイル(アバター・モーション)は原則ブラウザ内で処理し、外部へ送らない

## 2. 用語

| 用語 | 意味 |
|---|---|
| VRMA | VRM Animation。VRM Humanoid のボーン回転・Hips 移動・表情・LookAt を持つ glTF 拡張 |
| Muscle | Unity Humanoid の内部表現。95 本の正規化値(-1〜1)+ RootT/RootQ |
| ベイク | VRM + VRMA から Unity の `HumanPoseHandler` で Muscle を取り出し `.anim` にすること |
| `.p2cmotion` | Pose2Clip のモバイル再生用バイナリ(`"P2CM"`/version/fps/frameCount/muscleCount + フレーム列) |

## 3. アーキテクチャ

Muscle ↔ ボーン回転の変換は Unity の内部仕様に依存し、Unity 外で正確に再現できない。
そのため **Web はボーン回転(VRMA)で編集し、Muscle 変換は Unity に残す**。

```
[Pose2Clip / exia] 動画 → 推論 → Unity headless → .anim                 (既存)
                                        │ 追加: .anim → .vrma
                                        ▼
[MotionEditor Web]  .vrma 読込 → VRM で表示 → キーフレーム編集 → .vrma 書出
                                        │
                                        ▼
[MotionEditor Unity] VRM + .vrma → HumanPose 列 → .anim / .p2cmotion
```

- 交換形式は VRMA。Web 側の読込は `@pixiv/three-vrm-animation`、書出は `vrm-c/bvh2vrma` の Exporter(MIT)を土台にする
- ベイクに使う Humanoid Avatar は、ユーザーがアップロードした VRM から作る(`humanScale` や可動域がそのアバター基準になる)
- 既定アバターを同梱し、読み込み直後から動かせる状態にする(再配布可のライセンスのものを使う)

### ベイクの提供形態

| 形態 | 用途 | 状態 |
|---|---|---|
| exia の headless Unity | dsgarage 内部(Pose2Clip 連携)のベイク | 決定 |
| Unity パッケージ(UPM) | 一般ユーザーが自分の Unity プロジェクト内で VRMA → `.anim` に変換する | 提案中 |

## 4. 機能要件

### 4.1 入力

| 種別 | 形式 | 備考 |
|---|---|---|
| アバター | VRM 0.x / 1.0 | ライセンスメタ(改変・再配布)を表示し、禁止なら警告 |
| モーション(主) | VRMA | Pose2Clip の出力 |
| モーション(副) | BVH、Mixamo FBX、glTF アニメーション | 読込時に VRM Humanoid へリターゲット |

### 4.2 汎用キーフレーム編集

- FK 編集: ボーン選択 + 回転ギズモ + キー打ち
- IK: 手足の 2-bone IK、Foot Lock、ポールベクター
- タイムライン: ドープシート(キーの追加・削除・移動・複製・範囲選択・スナップ)
- グラフエディタ: ベジェ接線、補間の切替(LINEAR / STEP / ベジェ)
- ポーズ: ミラー、コピー/ペースト、T/A ポーズへのリセット
- クリップ: トリム、ループ化、速度変更、30/60fps リサンプル
- キーの間引き: 毎フレームベイクされた入力を誤差しきい値でキーに減らす。書出時に再ベイク
- アニメーションレイヤー: 加算/オーバーライド、ボーンマスク
- ルートモーション: 抽出、ロック、原点合わせ
- Undo/Redo(全操作)

### 4.3 Pose2Clip 向けの編集

- 元動画の同期表示(再生ヘッドに同期)
- 区間の一括修正: 範囲選択して前後から補間 / 平滑化(遮蔽・手首スパイクの修正)
- めり込み補正: 区間指定のオフセットレイヤー(腕・手)
- 肩・UpperChest の手直し(Pose2Clip の既知の損失部分)
- メタ情報レーン: ジャンプ区間、遮蔽区間、手の検出率をタイムライン上に表示
- ブックエンド(前後ポーズ)の差し替え

### 4.4 出力

| 形式 | 経路 |
|---|---|
| `.vrma` | Web から直接 |
| `.glb`(アバター + アニメーション) | Web から直接(GLTFExporter) |
| `.anim` + `.p2cmotion` | Unity ベイク経由 |
| `.bvh` | Web から直接(他 DCC 向け、優先度低) |

### 4.5 保存

- プロジェクトファイル(JSON + 元データ)のダウンロード
- IndexedDB への自動保存(復元用)

### 4.6 Pose2Clip インターフェース化(最終形)

- exia の `/jobs` 一覧を表示し、ジョブを開く
- URL 送信 → 推論 → 編集 → 再ベイク → 配信 を 1 画面で回す

## 5. UI

### 5.1 レイアウト

```
┌──────────────────────────────────────────────────────────┐
│ MotionEditor  ファイル 編集 表示   ▶ ⏸ ⏹  30fps  [書き出し] │ ツールバー
├────────────┬──────────────────────────────┬──────────────┤
│ 元動画      │                              │ インスペクタ   │
│ (折りたたみ) │        3D ビューポート         │ 選択ボーン     │
│ ボーン      │     (アバター + ギズモ)         │ 回転 X/Y/Z    │
│ 人体図      │  [移動][回転][IK]  [視点▼]     │ 補間 / IK     │
│ ▸ ツリー    │                              │ 区間補間/平滑化 │
├────────────┴──────────────────────────────┴──────────────┤
│ メタ  ▓▓ジャンプ▓▓      ░遮蔽░           [ドープ|グラフ]     │
│ 全体   ◆─────◆──────────◆─────────◆                      │ タイムライン
│ 左腕   ◆─────◆──────────◆                                │
└──────────────────────────────────────────────────────────┘
```

### 5.2 方針

- ダークテーマ基本、ライトテーマも用意
- ボーン選択は人体図ピッカー + ツリー表示。左=青、右=赤、中心=黄
- パネルはドラッグで幅変更、折りたたみ可
- デスクトップ優先。タブレット以下は閲覧・再生のみ
- ショートカットは Blender / Unity に合わせる(Space 再生、K キー打ち、W/E/R ツール、←→ フレーム移動、Ctrl+Z/Shift+Z、F フォーカス)

## 6. 非機能要件

- 性能: 10 万ポリゴンのアバターで 60fps 表示。3,600 フレーム(60fps × 1 分)を滞りなく編集
- 対応ブラウザ: Chrome / Edge / Safari 最新版(WebGL2)
- 読込ファイルは 100MB まで
- プライバシー: ファイル内容を外部へ送らない。解析を入れる場合も内容は送らない
- ホスティング: Cloudflare Pages(静的配信)

## 7. 技術スタック

| 層 | 選定 |
|---|---|
| ビルド | Vite + TypeScript |
| UI | React + Zustand |
| 3D | Three.js + `@pixiv/three-vrm` + `@pixiv/three-vrm-animation` |
| タイムライン | `animation-timeline-control`(MIT)を第一候補 |
| IK | 2-bone IK 自作 |
| Unity | UniVRM(VRMA 読込) + `HumanPoseHandler` |

## 8. 参考リポジトリ

| リポジトリ | ライセンス | 参考にする部分 |
|---|---|---|
| vrm-c/bvh2vrma | MIT | VRMA 書出(`VRMAnimationExporterPlugin.ts`)、BVH → VRM マッピング |
| pixiv/three-vrm examples/humanoidAnimation | MIT | Mixamo FBX リターゲット |
| malaybaku/AnimationClipToVrmaSample | MIT | Unity で AnimationClip → VRMA |
| YuBan834/vrma-lab | Apache-2.0 | 構成が近い。FBX → VRMA、Agent SDK |
| Mesh2Motion/mesh2motion-app | MIT | リターゲット処理 |
| ievgennaida/animation-timeline-control | MIT | Canvas タイムライン |
| yeemachine/kalidokit | MIT | 将来の動画モーキャプ |

ライセンス表記のないリポジトリ(nanasi-apps/vrm-animation-web-editor 等)は UI の参考にとどめ、コードは流用しない。

## 9. フェーズ

1. Unity 側の橋渡し: VRM + VRMA → `.anim` / `.p2cmotion`(headless)。Pose2Clip 側に `.anim → .vrma` 書出を追加
2. Web MVP: VRMA 読込 → VRM 表示 → 元動画同期 → FK 編集・区間補間・トリム → VRMA 書出 → Unity で再ベイクして確認
3. v1.1: IK・Foot Lock、グラフエディタ、キー間引き、めり込み補正レイヤー
4. v1.2: exia API 連携、汎用入力(BVH / Mixamo)、UPM パッケージ配布
5. 最終: Pose2Clip の UI として統合

## 10. 未検証・未決

- UniVRM の VRMA 読込から毎フレーム `HumanPose` を取り出す経路は未検証(フェーズ 1 の最初に検証)
- 同梱する既定アバターの選定(再配布可のライセンスが必要)
- 一般ユーザー向けベイクの提供形態(UPM パッケージ案)
