# Spike #11: assimp で GLB → FBX(アニメ付き)変換し、Unity が Humanoid として読めるか

実施日: 2026-09-25 / 再現: `spike/fbx-anim/run.sh`

## 結論

**assimp 経由の FBX を Unity が Humanoid として読めるか → 現状の assimp そのままでは No。**

- メッシュなし GLB をそのまま変換した FBX は、**Avatar が Humanoid にならない**(Rig Error)。原因は最上位ノードが `hips` 1 つだけになることで、GLB 側でアーマチュアの上に空の親ノードを 1 段足せば Avatar 生成は通る
- Avatar が通っても、**アニメーションが壊れる**(腕・脚・頭の Muscle がほぼ動かず、無関係な肩・つま先が動き、`IsFinite` のアサートが大量に出る)。原因は assimp FBX exporter がアニメカーブの補間属性を 0 で書くこと
- 出力 FBX の補間属性・単位・fps の 3 箇所をテキストで直した版は、**Blender 直出力の FBX と数値がほぼ一致**した(下表の fixAll)

つまり「assimp の FBX exporter を 3 箇所直し、Web 側で親ノードを 1 段足す」ことで、FBX 書き出し案(#10)は成立する見込みが高い。修正箇所は特定済み(「次の一手」)。

## 環境

| 項目 | 値 |
|---|---|
| assimp | Homebrew `assimp` 6.0.5(`assimp version`: 6.0, GIT commit 0)。ds-assimp のビルドではない |
| Blender | 5.2.2 LTS(`blender -b --factory-startup`) |
| Unity | 6000.3.9f1(`-batchmode -nographics`) |
| テストデータ | VRM Humanoid 名の 22 ボーン、T ポーズ、身長約 1.65m、60 フレーム / 30fps(2 秒) |
| 動き | hips 上下(f15 で 0.08m 下がる)、leftUpperArm を f30 で 70 度下ろす、rightUpperLeg を f30 で 45 度前へ、head を f20 で 30 度・f40 で -30 度振る |

## 判定表

Unity の `ModelImporter` を `animationType = Human`, `avatarSetup = CreateFromThisModel` で再インポートした結果。
auto(Unity の自動ボーン割り当て)と explicit(VRM 名 → HumanBodyBones を `humanDescription` に明示)の 2 モードで実行し、どのケースも 2 モードの結果は同じだった。

| FBX | 生成元 | Avatar isHuman | 未マップ必須ボーン | Clip | isHumanMotion | fps | Muscle カーブ | 動きの再現 |
|---|---|---|---|---|---|---|---|---|
| `test_noMesh.fbx` | assimp(メッシュなし) | **false**(Rig Error) | 15 個すべて | 0 | – | – | – | – |
| `test_withMesh.fbx` | assimp(スキンメッシュ付き) | true | なし | 1(2.0 秒) | true | 24 | 55 本(うち動くもの 5) | **NG** |
| `test_blender.fbx` | Blender 直(対照) | true | なし | 1(2.0 秒) | true | 30 | 55 本 | **OK** |
| `test_noMeshRoot.fbx` | assimp(メッシュなし + 親ノード 1 段) | true | なし | 1(2.0 秒) | true | 24 | 55 本(うち動くもの 5) | **NG** |
| `test_noMeshRoot_fixKeys.fbx` | 上の ASCII 版に「補間属性」だけ修正 | true | なし | 1(2.0 秒) | true | 24 | 55 本 | **OK**(スケール 1/100) |
| `test_noMeshRoot_fixAll.fbx` | 上の ASCII 版に「補間属性 + 単位 + fps」を修正 | true | なし | 1(2.0 秒) | true | 30 | 55 本 | **OK**(Blender 直と一致) |

`test_noMeshRoot_ascii.fbx`(無修正の ASCII 版)は binary 版の `test_noMeshRoot.fbx` と同じ結果で、ASCII/binary の違いは結果に影響しない。

### 動きの数値(同じ Avatar で Humanoid クリップを `SampleAnimation` した結果)

| FBX | hips 下降 f15(期待 0.08m) | 左上腕の水平からの下げ角 f30(期待 70°) | 右脚の振り f30(期待 45°) | 頭のヨー f20(期待 ±30°) |
|---|---|---|---|---|
| test_blender | 0.0771 | 69.93 | 45.00 | -29.92 |
| test_withMesh | 0.00037(スケール 1/100 でも期待の半分) | **-81.25**(逆に上がっている) | **0** | **0** |
| test_noMeshRoot | 0.00037 | **-81.25** | **0** | **0** |
| test_noMeshRoot_fixKeys | 0.00078(= 0.078m の 1/100) | 69.85 | 45.00 | -29.96 |
| test_noMeshRoot_fixAll | 0.0771 | 69.93 | 44.98 | -29.92 |

動く Muscle カーブ(値の幅 0.01 以上)の比較:

- test_blender / fixKeys / fixAll: `Head Turn Left-Right`, `Right Upper Leg Front-Back`, `Left Arm Down-Up`, `Left Arm Front-Back`, `Left Arm Twist In-Out`
- test_withMesh / test_noMeshRoot: `Head Turn Left-Right`, `Left Toes Up-Down`, `Right Toes Up-Down`, `Left Shoulder Down-Up`(0〜2.71), `Right Shoulder Down-Up`(0〜2.71)(動かしていない部位が動き、腕・脚が動かない)

JSON の生データ: `out/unity/summary.json`(ケース別は `out/unity/<name>.<mode>.json`。カーブ名一覧・Transform 階層・レスト時ワールド位置を含む)

## 失敗したケースのエラー全文

`test_noMesh.fbx`(auto):

```
Error: Rig Error:  Invalid Avatar Rig Configuration. Missing or invalid transform:
	Required human bone 'LeftUpperLeg' not found
```

`test_noMesh.fbx`(explicit):

```
Error: Rig Error:  Invalid Avatar Rig Configuration. Missing or invalid transform:
	Required human bone 'Hips' not found
```

`test_withMesh.fbx` / `test_noMeshRoot.fbx`(Avatar は通るがアニメ取り込みで):

```
Assert: Assertion failed on expression: 'IsFinite(curve.GetKey(1).value)'
Assert: Assertion failed on expression: 'IsFinite(curve.GetKey(2).value)'
Assert: Assertion failed on expression: 'IsFinite(curve.GetKey(0).value)'   (withMesh のみ)
Assert: Key count: 0 on curve                                              (withMesh のみ)
Warning: File 'test_noMeshRoot' has animation import warnings. See Import Messages in Animation Import Settings for more details.
```

(withMesh で 114 行、noMeshRoot で 57 行。同じ文言の繰り返し)

## 原因

いずれも assimp 6.0 の `code/AssetLib/FBX/FBXExporter.cpp`(ds-assimp の同ファイルで行番号を確認)。

1. **最上位ノードが 1 つだけになる(Avatar が通らない原因。実験で確定)**
   Blender の GLB は `Armature → hips` の 2 段だが、assimp の glTF インポータはシーン直下の 1 ノード(Armature)を aiScene のルートに吸収し、FBX exporter は aiScene のルートを書かずに子から書く(`WriteModelNodes(outstream, mScene->mRootNode, 0, ...)`, 2357 行付近)。結果として FBX の最上位は `hips` 1 つだけになる。Unity は最上位ノードが 1 つの FBX ではそれを prefab のルートに潰してファイル名に置き換えるので、`hips` という Transform が消える(Transform 一覧の先頭が `""` = ルートで、その直下が `leftUpperLeg`)。
   - メッシュ付き(Body と hips の 2 つが最上位)と、親ノード `Root` を足した noMeshRoot(最上位が `Armature`)では起きない
2. **アニメカーブの補間属性が 0(アニメが壊れる原因。実験で確定)**
   `WriteAnimationCurve`(2879 行付近)が `KeyAttrFlags = {0}`、`KeyAttrDataFloat = {0,0,0,0}` を書く。補間モードの指定がなく、タンジェントのウェイトも 0 のため、Unity のカーブ変換で非有限値が出て(`IsFinite` アサート)Euler → Muscle 変換が崩れる。Blender と同じ `KeyAttrFlags = 24836`(linear + auto tangent)、`KeyAttrDataFloat = {0,0,218434821,0}`(既定ウェイト)に書き換えるだけで、動きが Blender 直と一致した(fixKeys)。
3. **単位が cm 宣言(1/100 スケールになる。実験で確定)**
   `UnitScaleFactor` を 1.0(= cm)固定で書く(470 行)が、値は glTF の m のまま。Unity は `fileScale = 0.01` で読み、hips が 0.0095m の高さになる。Humanoid の Muscle は相対値なので回転の再現には影響しないが、Root/Hips 移動量やスケルトンの大きさが 1/100 になる。100 に直すと Blender 直と一致した。
4. **TimeMode が 24fps 固定(fps がずれる。実験で確定)**
   `TimeMode = 11`(24fps)固定(474 行)。キー時刻自体は秒で正しく書かれているのでクリップ長は 2.0 秒で合うが、Unity のクリップ frameRate が 24 になる(30fps の元データが 24fps でリサンプルされる)。6(30fps)に直すと 30 になった。
5. (参考・未検証の影響)`AnimationCurveNode` の既定値 `d|X/Y/Z` にノードの**ワールド**変換を分解した値を**ラジアンのまま**書いている(2440〜2470 行付近の `get_world_transform` + `Decompose`)。キーがある限り使われないため今回の結果には影響していないが、正しくはローカル変換・度単位。

## 次の一手

**assimp(ds-assimp)の FBX exporter を直せば FBX 書き出し案は通る見込み。** 直す箇所:

| # | 箇所 | 修正内容 | 必須度 |
|---|---|---|---|
| 1 | `WriteAnimationCurve` の `KeyAttrFlags` / `KeyAttrDataFloat` | `24836` / `{0, 0, 218434821(ビット列として), 0}` にする(Blender と同じ) | 必須 |
| 2 | GlobalSettings の `UnitScaleFactor` / `OriginalUnitScaleFactor` | 100(m)にする。または aiScene メタデータで指定できるようにし、CLI から渡す | ほぼ必須(Root 移動量) |
| 3 | GlobalSettings の `TimeMode` | 元アニメの ticksPerSecond に合わせる(30fps なら 6)。`CustomFrameRate` も併用可 | 推奨 |
| 4 | 最上位ノードが 1 つだけになる問題 | Web 側の GLB 書き出しでアーマチュアの上に空の親ノード(例 `Root` → `Armature` → `hips`)を 1 段足す。assimp 側で直すなら aiScene のルートも Model として書く | 必須(どちらか一方) |
| 5 | `AnimationCurveNode` の既定値 | ローカル変換・度単位にする | 任意 |

進め方の案:

1. ds-assimp に上の 1〜3(と 5)を入れた版をビルドし、この spike の `run.sh` の `ASSIMP=` にそのバイナリを渡して `test_noMeshRoot.fbx` が fixAll と同じ数値になることを確認する
2. three.js `GLTFExporter` で書いた GLB(Web の実際の出力)でも同じ結果になるかを確認する(今回の GLB は Blender 書き出しで、全ボーンを毎フレームサンプリングしたキーになっている)
3. 通れば #10 の出力方式を「Web で GLB → assimp CLI で FBX」に切り替える

補足: ASCII FBX を後処理するパッチ(`patch_assimp_fbx.py`)でも同じ結果は得られるが、あくまで切り分け用で本番に使う想定ではない。

## ファイル

| パス | 内容 |
|---|---|
| `make_test_glb.py` | Blender スクリプト。`out/test_noMesh.glb`, `test_withMesh.glb`, `test_noMeshRoot.glb`, `test_blender.fbx` を生成 |
| `patch_assimp_fbx.py` | 診断用。assimp の ASCII FBX に補間属性・単位・fps の修正を当てる |
| `UnityCheck/Assets/Editor/FbxHumanoidCheck.cs` | `-executeMethod FbxHumanoidCheck.Run -fbx "a.fbx;b.fbx" -outDir <dir>` で各 FBX を Humanoid 読み込みし JSON を出す |
| `run.sh` | 上記を一括実行。`BLENDER` / `ASSIMP` / `UNITY` 環境変数で差し替え可 |
| `out/` | 生成した GLB / FBX(各 250KB 以下)、`assimp info` の出力、Unity の結果 JSON |
