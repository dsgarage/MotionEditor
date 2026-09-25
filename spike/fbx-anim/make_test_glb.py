"""Issue #11 spike: VRM Humanoid ボーン名のアーマチュア + 回転アニメを作り、
GLB(メッシュなし / 小さなスキンメッシュ付き)と Blender 直の FBX を書き出す。

実行: blender -b --factory-startup --python make_test_glb.py -- <out_dir>
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = os.path.abspath(argv[0] if argv else os.path.join(os.path.dirname(__file__), "out"))
os.makedirs(OUT_DIR, exist_ok=True)

FPS = 30
FRAMES = 60

# Blender 座標(Z-up, キャラの正面 = -Y, キャラの左 = +X)。身長約 1.65m の T ポーズ。
# (name, parent, head, tail)
BONES = [
    ("hips", None, (0, 0, 0.95), (0, 0, 1.05)),
    ("spine", "hips", (0, 0, 1.05), (0, 0, 1.15)),
    ("chest", "spine", (0, 0, 1.15), (0, 0, 1.25)),
    ("upperChest", "chest", (0, 0, 1.25), (0, 0, 1.38)),
    ("neck", "upperChest", (0, 0, 1.40), (0, 0, 1.48)),
    ("head", "neck", (0, 0, 1.48), (0, 0, 1.65)),
    ("leftShoulder", "upperChest", (0.02, 0, 1.38), (0.15, 0, 1.40)),
    ("leftUpperArm", "leftShoulder", (0.15, 0, 1.40), (0.43, 0, 1.40)),
    ("leftLowerArm", "leftUpperArm", (0.43, 0, 1.40), (0.68, 0, 1.40)),
    ("leftHand", "leftLowerArm", (0.68, 0, 1.40), (0.78, 0, 1.40)),
    ("rightShoulder", "upperChest", (-0.02, 0, 1.38), (-0.15, 0, 1.40)),
    ("rightUpperArm", "rightShoulder", (-0.15, 0, 1.40), (-0.43, 0, 1.40)),
    ("rightLowerArm", "rightUpperArm", (-0.43, 0, 1.40), (-0.68, 0, 1.40)),
    ("rightHand", "rightLowerArm", (-0.68, 0, 1.40), (-0.78, 0, 1.40)),
    ("leftUpperLeg", "hips", (0.09, 0, 0.93), (0.09, 0, 0.52)),
    ("leftLowerLeg", "leftUpperLeg", (0.09, 0, 0.52), (0.09, 0, 0.10)),
    ("leftFoot", "leftLowerLeg", (0.09, 0, 0.10), (0.09, -0.12, 0.02)),
    ("leftToes", "leftFoot", (0.09, -0.12, 0.02), (0.09, -0.18, 0.02)),
    ("rightUpperLeg", "hips", (-0.09, 0, 0.93), (-0.09, 0, 0.52)),
    ("rightLowerLeg", "rightUpperLeg", (-0.09, 0, 0.52), (-0.09, 0, 0.10)),
    ("rightFoot", "rightLowerLeg", (-0.09, 0, 0.10), (-0.09, -0.12, 0.02)),
    ("rightToes", "rightFoot", (-0.09, -0.12, 0.02), (-0.09, -0.18, 0.02)),
]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = FRAMES
    return scene


def build_armature():
    arm_data = bpy.data.armatures.new("Armature")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    ebones = {}
    for name, parent, head, tail in BONES:
        eb = arm_data.edit_bones.new(name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.roll = 0.0
        if parent:
            eb.parent = ebones[parent]
            eb.use_connect = False
        ebones[name] = eb
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def key_rot(pb, frame, euler_deg):
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Euler([math.radians(a) for a in euler_deg], "XYZ").to_quaternion()
    pb.keyframe_insert("rotation_quaternion", frame=frame)


def animate(arm_obj):
    pbs = arm_obj.pose.bones
    # 全ボーンに 0 フレーム目の恒等キーを打つ(レスト = T ポーズ)
    for pb in pbs:
        key_rot(pb, 0, (0, 0, 0))
    hips = pbs["hips"]
    for f, z in [(0, 0.0), (15, -0.08), (30, 0.0), (45, -0.08), (60, 0.0)]:
        hips.location = (0, z, 0)  # ボーンローカル Y = ワールド Z(上下)
        hips.keyframe_insert("location", frame=f)
    # ボーンローカル軸での回転(Blender のボーン Y 軸 = ボーン方向)
    for f, r in [(0, 0), (30, 70), (60, 0)]:
        key_rot(pbs["leftUpperArm"], f, (-r, 0, 0))  # 腕を下ろす方向(ボーン X 軸 = ワールド -Y)
    for f, r in [(0, 0), (30, 45), (60, 0)]:
        key_rot(pbs["rightUpperLeg"], f, (r, 0, 0))  # 脚を前へ
    for f, r in [(0, 0), (20, 30), (40, -30), (60, 0)]:
        key_rot(pbs["head"], f, (0, r, 0))  # 首を左右に振る
    return arm_obj.animation_data.action


def build_skinned_mesh(arm_obj):
    """各ボーンの中点に 2cm の箱を置き、そのボーンにウェイト 1 で割り当てた 1 メッシュ。"""
    verts, faces, groups = [], [], []
    s = 0.02
    cube_v = [(-s, -s, -s), (s, -s, -s), (s, s, -s), (-s, s, -s),
              (-s, -s, s), (s, -s, s), (s, s, s), (-s, s, s)]
    cube_f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for name, _parent, head, tail in BONES:
        c = (Vector(head) + Vector(tail)) / 2
        base = len(verts)
        verts += [tuple(c + Vector(v)) for v in cube_v]
        faces += [tuple(base + i for i in f) for f in cube_f]
        groups.append((name, list(range(base, base + 8))))
    me = bpy.data.meshes.new("Body")
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new("Body", me)
    bpy.context.scene.collection.objects.link(obj)
    for name, idx in groups:
        vg = obj.vertex_groups.new(name=name)
        vg.add(idx, 1.0, "REPLACE")
    obj.parent = arm_obj
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    return obj


def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def export_glb(path, objs):
    select_only(objs)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_yup=True,
    )
    print(f"[make_test_glb] wrote {path}")


def export_fbx(path, objs, types):
    select_only(objs)
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=True,
        object_types=types,
        add_leaf_bones=False,
        bake_anim=True,
        bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=False,
        apply_scale_options="FBX_SCALE_ALL",
    )
    print(f"[make_test_glb] wrote {path}")


def main():
    reset_scene()
    arm = build_armature()
    action = animate(arm)
    action.name = "TestMotion"
    bpy.context.scene.frame_set(0)

    export_glb(os.path.join(OUT_DIR, "test_noMesh.glb"), [arm])
    export_fbx(os.path.join(OUT_DIR, "test_blender.fbx"), [arm], {"ARMATURE"})

    body = build_skinned_mesh(arm)
    export_glb(os.path.join(OUT_DIR, "test_withMesh.glb"), [arm, body])

    # 追加検証: メッシュなしで、アーマチュアの上に空の親ノード "Root" を 1 段足した GLB。
    # assimp は glTF のシーン直下ノード 1 つを aiScene のルートに吸収し、FBX 出力でそれを書かないため、
    # 親が 1 段ないと FBX の最上位が hips 1 つだけになる(Unity はそれを prefab ルートに潰して名前を変える)。
    root = bpy.data.objects.new("Root", None)
    bpy.context.scene.collection.objects.link(root)
    arm.parent = root
    export_glb(os.path.join(OUT_DIR, "test_noMeshRoot.glb"), [root, arm])


main()
