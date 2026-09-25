"""Issue #11 spike(診断用): assimp が書いた ASCII FBX に、疑わしい箇所の修正を当てた版を作る。

assimp 本体を直す前に「どこを直せば Unity で正しく動くか」を切り分けるためのもの。
    python3 patch_assimp_fbx.py in_ascii.fbx out.fbx keys        # キー補間属性だけ直す
    python3 patch_assimp_fbx.py in_ascii.fbx out.fbx keys,unit,fps

パッチの内容:
  keys : KeyAttrFlags 0 -> 24836(linear + auto tangent。Blender FBX 出力と同じ値)
         KeyAttrDataFloat 0,0,0,0 -> 0,0,218434821,0(既定ウェイト 1/3。Blender と同じビット列)
  unit : GlobalSettings の UnitScaleFactor 1(cm) -> 100(m)。assimp は m 単位の値を cm として宣言している
  fps  : GlobalSettings の TimeMode 11(24fps) -> 6(30fps)
"""
import re
import sys

src, dst, which = sys.argv[1], sys.argv[2], set(sys.argv[3].split(","))
text = open(src, encoding="utf-8").read()
counts = {}


def sub(pattern, repl, name):
    global text
    text, n = re.subn(pattern, repl, text)
    counts[name] = n


if "keys" in which:
    sub(r"(KeyAttrFlags: \*1 \{\s*a: )0\b", r"\g<1>24836", "KeyAttrFlags")
    sub(r"(KeyAttrDataFloat: \*4 \{\s*a: )0,0,0,0\b", r"\g<1>0,0,218434821,0", "KeyAttrDataFloat")
if "unit" in which:
    sub(r'(P: "UnitScaleFactor", "double", "Number", "", )1\b', r"\g<1>100", "UnitScaleFactor")
    sub(r'(P: "OriginalUnitScaleFactor", "double", "Number", "", )1\b', r"\g<1>100", "OriginalUnitScaleFactor")
if "fps" in which:
    sub(r'(P: "TimeMode", "enum", "", "", )11\b', r"\g<1>6", "TimeMode")

open(dst, "w", encoding="utf-8").write(text)
print(f"[patch_assimp_fbx] {dst}: {counts}")
