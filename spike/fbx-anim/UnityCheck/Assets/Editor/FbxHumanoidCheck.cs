// Issue #11 spike: FBX を Rig=Humanoid で読み込み、Avatar と Humanoid AnimationClip が
// 生成されるかを検証してログ + JSON に出す。
//
// 実行例:
//   Unity -batchmode -nographics -quit -projectPath UnityCheck \
//     -executeMethod FbxHumanoidCheck.Run -fbx a.fbx;b.fbx -outDir ../out/unity -logFile -
//
// 各 FBX を 2 モードで読み込む:
//   auto     : avatarSetup = CreateFromThisModel、ボーン割り当ては Unity の自動マッピング任せ
//   explicit : VRM ボーン名 → HumanBodyBones を humanDescription に明示して CreateFromThisModel
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

public static class FbxHumanoidCheck
{
    const string SpikeDir = "Assets/Spike";

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        string fbxArg = GetArg(args, "-fbx");
        string outDir = GetArg(args, "-outDir") ?? "SpikeResults";
        if (string.IsNullOrEmpty(fbxArg))
        {
            Debug.LogError("[FbxHumanoidCheck] -fbx <path;path...> が必要です");
            EditorApplication.Exit(2);
            return;
        }
        Directory.CreateDirectory(outDir);

        var summary = new StringBuilder();
        summary.Append("[\n");
        bool first = true;
        foreach (var src in fbxArg.Split(';').Where(s => !string.IsNullOrWhiteSpace(s)))
        {
            foreach (var mode in new[] { "auto", "explicit" })
            {
                string json;
                try
                {
                    json = CheckOne(src, mode);
                }
                catch (Exception e)
                {
                    Debug.LogError($"[FbxHumanoidCheck] {src} ({mode}) で例外: {e}");
                    json = "{\"source\":" + Q(src) + ",\"mode\":" + Q(mode) + ",\"exception\":" + Q(e.ToString()) + "}";
                }
                string name = Path.GetFileNameWithoutExtension(src) + "." + mode + ".json";
                File.WriteAllText(Path.Combine(outDir, name), json);
                summary.Append(first ? "" : ",\n").Append(json);
                first = false;
            }
        }
        summary.Append("\n]\n");
        File.WriteAllText(Path.Combine(outDir, "summary.json"), summary.ToString());
        Debug.Log("[FbxHumanoidCheck] done -> " + Path.GetFullPath(outDir));
    }

    static string CheckOne(string src, string mode)
    {
        string dir = $"{SpikeDir}/{mode}";
        Directory.CreateDirectory(dir);
        string assetPath = $"{dir}/{Path.GetFileName(src)}";
        File.Copy(src, assetPath, true);

        // import 中の警告・エラーを拾う
        var logs = new List<string>();
        Application.LogCallback cb = (msg, stack, type) =>
        {
            if (type != LogType.Log) logs.Add($"{type}: {msg}");
        };
        Application.logMessageReceived += cb;
        try
        {
            AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            var importer = (ModelImporter)AssetImporter.GetAtPath(assetPath);

            if (mode == "explicit")
            {
                // まず Generic で読み込み、Transform 階層から skeleton を作る
                importer.animationType = ModelImporterAnimationType.Generic;
                importer.SaveAndReimport();
                var go = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
                var hd = importer.humanDescription;
                hd.skeleton = go.GetComponentsInChildren<Transform>(true).Select(t => new SkeletonBone
                {
                    name = t.name,
                    position = t.localPosition,
                    rotation = t.localRotation,
                    scale = t.localScale,
                }).ToArray();
                var names = new HashSet<string>(hd.skeleton.Select(s => s.name));
                var human = new List<HumanBone>();
                for (int i = 0; i < HumanTrait.BoneCount; i++)
                {
                    string unityName = HumanTrait.BoneName[i]; // 例 "LeftUpperArm"
                    string vrmName = char.ToLowerInvariant(unityName[0]) + unityName.Substring(1);
                    if (!names.Contains(vrmName)) continue;
                    var hb = new HumanBone { boneName = vrmName, humanName = unityName };
                    hb.limit.useDefaultValues = true;
                    human.Add(hb);
                }
                hd.human = human.ToArray();
                hd.upperArmTwist = 0.5f;
                hd.lowerArmTwist = 0.5f;
                hd.upperLegTwist = 0.5f;
                hd.lowerLegTwist = 0.5f;
                hd.armStretch = 0.05f;
                hd.legStretch = 0.05f;
                hd.feetSpacing = 0f;
                hd.hasTranslationDoF = false;
                importer.humanDescription = hd;
            }

            importer.animationType = ModelImporterAnimationType.Human;
            importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            importer.SaveAndReimport();

            return Report(src, mode, assetPath, importer, logs);
        }
        finally
        {
            Application.logMessageReceived -= cb;
        }
    }

    static string Report(string src, string mode, string assetPath, ModelImporter importer, List<string> logs)
    {
        var all = AssetDatabase.LoadAllAssetsAtPath(assetPath);
        var avatar = all.OfType<Avatar>().FirstOrDefault();
        var clips = all.OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview__")).ToArray();
        var muscleNames = new HashSet<string>(HumanTrait.MuscleName);

        var sb = new StringBuilder();
        sb.Append("{");
        sb.Append("\"source\":").Append(Q(src)).Append(',');
        sb.Append("\"mode\":").Append(Q(mode)).Append(',');
        sb.Append("\"fileSizeBytes\":").Append(new FileInfo(src).Length).Append(',');
        sb.Append("\"fileScale\":").Append(F(importer.fileScale)).Append(',');
        sb.Append("\"globalScale\":").Append(F(importer.globalScale)).Append(',');
        sb.Append("\"animationType\":").Append(Q(importer.animationType.ToString())).Append(',');

        // 読み込まれた Transform 階層とレスト時のワールド位置(単一ルートの潰れ・スケール・姿勢崩れの診断用)
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (prefab != null)
        {
            var ts = prefab.GetComponentsInChildren<Transform>(true);
            sb.Append("\"transforms\":[").Append(string.Join(",", ts.Select(t => Q(AnimationUtility.CalculateTransformPath(t, prefab.transform))))).Append("],");
            sb.Append("\"restWorldPositions\":{").Append(string.Join(",", ts.Select(t =>
                Q(t.name) + ":[" + F(t.position.x) + "," + F(t.position.y) + "," + F(t.position.z) + "]"))).Append("},");
        }

        sb.Append("\"avatarExists\":").Append(B(avatar != null)).Append(',');
        if (avatar != null)
        {
            var hd = avatar.humanDescription;
            var mapped = new HashSet<string>(hd.human.Select(h => h.humanName));
            var missingRequired = Enumerable.Range(0, HumanTrait.BoneCount)
                .Where(HumanTrait.RequiredBone)
                .Select(i => HumanTrait.BoneName[i])
                .Where(n => !mapped.Contains(n)).ToArray();
            sb.Append("\"avatarIsValid\":").Append(B(avatar.isValid)).Append(',');
            sb.Append("\"avatarIsHuman\":").Append(B(avatar.isHuman)).Append(',');
            sb.Append("\"humanMappingCount\":").Append(hd.human.Length).Append(',');
            sb.Append("\"humanMapping\":{").Append(string.Join(",", hd.human.Select(h => Q(h.humanName) + ":" + Q(h.boneName)))).Append("},");
            sb.Append("\"missingRequiredBones\":[").Append(string.Join(",", missingRequired.Select(Q))).Append("],");
        }

        sb.Append("\"clipCount\":").Append(clips.Length).Append(',');
        sb.Append("\"clips\":[");
        for (int c = 0; c < clips.Length; c++)
        {
            var clip = clips[c];
            var bindings = AnimationUtility.GetCurveBindings(clip);
            var props = bindings.Select(b => (string.IsNullOrEmpty(b.path) ? "" : b.path + ":") + b.propertyName).ToArray();
            var muscleBindings = bindings.Where(b => muscleNames.Contains(b.propertyName)).ToArray();
            // 動いている Muscle カーブ(値の幅が 0.01 以上)
            var moving = new List<string>();
            foreach (var b in muscleBindings)
            {
                var curve = AnimationUtility.GetEditorCurve(clip, b);
                if (curve == null || curve.length == 0) continue;
                float min = curve.keys.Min(k => k.value), max = curve.keys.Max(k => k.value);
                if (max - min >= 0.01f) moving.Add($"{{\"name\":{Q(b.propertyName)},\"min\":{F(min)},\"max\":{F(max)},\"keys\":{curve.length}}}");
            }
            if (c > 0) sb.Append(',');
            sb.Append("{");
            sb.Append("\"name\":").Append(Q(clip.name)).Append(',');
            sb.Append("\"length\":").Append(F(clip.length)).Append(',');
            sb.Append("\"frameRate\":").Append(F(clip.frameRate)).Append(',');
            sb.Append("\"isHumanMotion\":").Append(B(clip.isHumanMotion)).Append(',');
            sb.Append("\"curveCount\":").Append(bindings.Length).Append(',');
            sb.Append("\"muscleCurveCount\":").Append(muscleBindings.Length).Append(',');
            sb.Append("\"movingMuscleCurves\":[").Append(string.Join(",", moving)).Append("],");
            sb.Append("\"sample\":").Append(SamplePose(assetPath, avatar, clip)).Append(',');
            sb.Append("\"curveNames\":[").Append(string.Join(",", props.Select(Q))).Append("]");
            sb.Append("}");
        }
        sb.Append("],");
        // Inspector の "Import Messages" 相当(internal なので reflection で拾う)
        var msgs = new List<string>();
        var flags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic;
        foreach (var p in typeof(ModelImporter).GetProperties(flags))
        {
            if (!(p.Name.Contains("Warning") || p.Name.Contains("Error")) || p.GetIndexParameters().Length > 0) continue;
            try
            {
                var v = p.GetValue(importer);
                string s = v is System.Collections.IEnumerable e && !(v is string) ? string.Join(" | ", e.Cast<object>()) : v?.ToString();
                if (!string.IsNullOrEmpty(s)) msgs.Add(p.Name + ": " + s);
            }
            catch (Exception) { }
        }
        sb.Append("\"importerMessages\":[").Append(string.Join(",", msgs.Select(Q))).Append("],");
        sb.Append("\"importLogs\":[").Append(string.Join(",", logs.Distinct().Select(Q))).Append("]");
        sb.Append("}");

        string json = sb.ToString();
        Debug.Log($"[FbxHumanoidCheck] {Path.GetFileName(src)} ({mode}): avatar={(avatar != null)} valid={(avatar != null && avatar.isValid)} human={(avatar != null && avatar.isHuman)} clips={clips.Length} humanMotion={string.Join(",", clips.Select(x => x.isHumanMotion))}");
        return json;
    }

    // Humanoid クリップを同じアバターで再生し、元アニメの意図どおりに動くかを数値で見る
    //   frame 15: hips が 0.08m 下がる / frame 30: 左上腕が約 70 度下がる / frame 20: 頭が左右に約 30 度回る
    static string SamplePose(string assetPath, Avatar avatar, AnimationClip clip)
    {
        if (avatar == null || !avatar.isHuman || !avatar.isValid || !clip.isHumanMotion) return "null";
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        var go = UnityEngine.Object.Instantiate(prefab);
        try
        {
            var anim = go.GetComponent<Animator>() ?? go.AddComponent<Animator>();
            anim.avatar = avatar;
            var hips = anim.GetBoneTransform(HumanBodyBones.Hips);
            var lua = anim.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            var lla = anim.GetBoneTransform(HumanBodyBones.LeftLowerArm);
            var head = anim.GetBoneTransform(HumanBodyBones.Head);
            var rul = anim.GetBoneTransform(HumanBodyBones.RightUpperLeg);
            var rll = anim.GetBoneTransform(HumanBodyBones.RightLowerLeg);

            clip.SampleAnimation(go, 0f);
            float hipsY0 = hips.position.y;
            Quaternion headRot0 = head.rotation;
            Vector3 legDir0 = (rll.position - rul.position).normalized;

            clip.SampleAnimation(go, 15f / 30f);
            float hipsY15 = hips.position.y;

            clip.SampleAnimation(go, 20f / 30f);
            // レストからの差分回転をワールド前方ベクトルに当てて水平面での振れ角を測る(ボーンの局所軸に依存しない)
            Vector3 fwd20 = (head.rotation * Quaternion.Inverse(headRot0)) * Vector3.forward;
            float headYaw20 = Vector3.SignedAngle(Vector3.forward, Vector3.ProjectOnPlane(fwd20, Vector3.up), Vector3.up);

            clip.SampleAnimation(go, 1.0f);
            Vector3 armDir30 = (lla.position - lua.position).normalized;
            float armBelowHorizontal30 = -Mathf.Asin(Mathf.Clamp(armDir30.y, -1, 1)) * Mathf.Rad2Deg;
            Vector3 legDir30 = (rll.position - rul.position).normalized;
            float legSwing30 = Vector3.Angle(legDir0, legDir30);

            return "{" +
                   "\"hipsY_f0\":" + F(hipsY0) + "," +
                   "\"hipsY_f15\":" + F(hipsY15) + "," +
                   "\"hipsDrop_f15\":" + F(hipsY0 - hipsY15) + "," +
                   "\"headYawDeg_f20\":" + F(headYaw20) + "," +
                   "\"leftArmBelowHorizontalDeg_f30\":" + F(armBelowHorizontal30) + "," +
                   "\"rightLegSwingDeg_f30\":" + F(legSwing30) +
                   "}";
        }
        catch (Exception e)
        {
            return "{\"error\":" + Q(e.Message) + "}";
        }
        finally
        {
            UnityEngine.Object.DestroyImmediate(go);
        }
    }

    static string GetArg(string[] args, string key)
    {
        int i = Array.IndexOf(args, key);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    static string B(bool v) => v ? "true" : "false";
    static string F(float v) => float.IsNaN(v) || float.IsInfinity(v) ? "null" : v.ToString("0.#####", System.Globalization.CultureInfo.InvariantCulture);

    static string Q(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder("\"");
        foreach (char ch in s)
        {
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20) sb.Append("\\u").Append(((int)ch).ToString("x4"));
                    else sb.Append(ch);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }
}
