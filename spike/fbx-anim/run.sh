#!/usr/bin/env bash
# Issue #11 spike: GLB -> (assimp) -> FBX -> Unity Humanoid 読み込み検証を一括で再実行する。
#
# 使い方: spike/fbx-anim/run.sh
# 環境変数で上書き可: BLENDER / ASSIMP / UNITY
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
PROJ="$HERE/UnityCheck"

BLENDER="${BLENDER:-/opt/homebrew/bin/blender}"
ASSIMP="${ASSIMP:-/opt/homebrew/bin/assimp}"
UNITY="${UNITY:-/Applications/Unity/Hub/Editor/6000.3.9f1/Unity.app/Contents/MacOS/Unity}"

mkdir -p "$OUT"

echo "== 1. Blender で GLB(noMesh / withMesh)と対照用 FBX を生成"
"$BLENDER" -b --factory-startup --python "$HERE/make_test_glb.py" -- "$OUT" 2>&1 | grep -E "make_test_glb|Error|Traceback" || true

echo "== 2. assimp で GLB -> FBX"
"$ASSIMP" version | grep -i version || true
for n in noMesh withMesh noMeshRoot; do
  "$ASSIMP" export "$OUT/test_$n.glb" "$OUT/test_$n.fbx" > "$OUT/assimp_export_$n.log" 2>&1
  "$ASSIMP" info "$OUT/test_$n.fbx" > "$OUT/assimp_info_$n.txt" 2>&1
  grep -E "^(Nodes|Meshes|Animations|Bones|Animation Channels):" "$OUT/assimp_info_$n.txt" | sed "s/^/  [$n] /"
done

echo "== 2b. 診断用: assimp の ASCII FBX に修正パッチを当てた版(どこを直せば通るかの切り分け)"
"$ASSIMP" export "$OUT/test_noMeshRoot.glb" "$OUT/test_noMeshRoot_ascii.fbx" -ffbxa > "$OUT/assimp_export_noMeshRoot_ascii.log" 2>&1
python3 "$HERE/patch_assimp_fbx.py" "$OUT/test_noMeshRoot_ascii.fbx" "$OUT/test_noMeshRoot_fixKeys.fbx" keys
python3 "$HERE/patch_assimp_fbx.py" "$OUT/test_noMeshRoot_ascii.fbx" "$OUT/test_noMeshRoot_fixAll.fbx" keys,unit,fps
ls -l "$OUT"/*.glb "$OUT"/*.fbx

echo "== 3. Unity で Rig=Humanoid 読み込み検証"
if [ ! -d "$PROJ/ProjectSettings" ]; then
  echo "  UnityCheck プロジェクトを生成"
  # createProject は Assets/Editor/FbxHumanoidCheck.cs を消さないので、既存のスクリプトはそのまま残る
  "$UNITY" -batchmode -nographics -quit -createProject "$PROJ" -logFile "$OUT/unity_create.log"
fi
rm -rf "$PROJ/Assets/Spike" "$PROJ/Assets/Spike.meta" "$OUT/unity"
FBX_LIST="$OUT/test_noMesh.fbx;$OUT/test_withMesh.fbx;$OUT/test_blender.fbx;$OUT/test_noMeshRoot.fbx;$OUT/test_noMeshRoot_ascii.fbx;$OUT/test_noMeshRoot_fixKeys.fbx;$OUT/test_noMeshRoot_fixAll.fbx"
set +e
"$UNITY" -batchmode -nographics -quit -projectPath "$PROJ" \
  -executeMethod FbxHumanoidCheck.Run -fbx "$FBX_LIST" -outDir "$OUT/unity" \
  -logFile "$OUT/unity_check.log"
code=$?
set -e
grep -E "\[FbxHumanoidCheck\]|error CS" "$OUT/unity_check.log" || true
echo "Unity exit code: $code"
echo "結果 JSON: $OUT/unity/summary.json"
exit $code
