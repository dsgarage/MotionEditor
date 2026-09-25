/**
 * キー評価・間引き用の小さな数値計算。配列 + オフセットで扱い、ホットパスで割り当てを避ける
 */

type Nums = ArrayLike<number>

/**
 * 球面線形補間(three.js の Quaternion.slerpFlat と同じく最短経路を取る)。結果を out[oo..oo+3] に書く
 */
export function slerpInto(
  out: number[] | Float32Array,
  oo: number,
  a: Nums,
  ao: number,
  b: Nums,
  bo: number,
  t: number,
): void {
  const ax = a[ao]
  const ay = a[ao + 1]
  const az = a[ao + 2]
  const aw = a[ao + 3]
  let bx = b[bo]
  let by = b[bo + 1]
  let bz = b[bo + 2]
  let bw = b[bo + 3]

  if (t <= 0) {
    out[oo] = ax
    out[oo + 1] = ay
    out[oo + 2] = az
    out[oo + 3] = aw
    return
  }
  if (t >= 1) {
    out[oo] = bx
    out[oo + 1] = by
    out[oo + 2] = bz
    out[oo + 3] = bw
    return
  }

  let cos = ax * bx + ay * by + az * bz + aw * bw
  if (cos < 0) {
    cos = -cos
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }

  let s0: number
  let s1: number
  if (cos > 0.9995) {
    // ほぼ同じ向きは線形補間 + 正規化
    s0 = 1 - t
    s1 = t
  } else {
    const theta = Math.acos(cos)
    const sin = Math.sin(theta)
    s0 = Math.sin((1 - t) * theta) / sin
    s1 = Math.sin(t * theta) / sin
  }
  let x = s0 * ax + s1 * bx
  let y = s0 * ay + s1 * by
  let z = s0 * az + s1 * bz
  let w = s0 * aw + s1 * bw
  const len = Math.hypot(x, y, z, w) || 1
  x /= len
  y /= len
  z /= len
  w /= len
  out[oo] = x
  out[oo + 1] = y
  out[oo + 2] = z
  out[oo + 3] = w
}

/** 2 つのクォータニオンの間の回転角(ラジアン、0〜π)。単位長からのずれは正規化して吸収する */
export function quatAngle(a: Nums, ao: number, b: Nums, bo: number): number {
  const dot = a[ao] * b[bo] + a[ao + 1] * b[bo + 1] + a[ao + 2] * b[bo + 2] + a[ao + 3] * b[bo + 3]
  const la = Math.hypot(a[ao], a[ao + 1], a[ao + 2], a[ao + 3])
  const lb = Math.hypot(b[bo], b[bo + 1], b[bo + 2], b[bo + 3])
  const c = la > 0 && lb > 0 ? Math.abs(dot) / (la * lb) : 1
  return 2 * Math.acos(Math.min(1, c))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** frame 昇順の配列から、frame 以下で最大のキーの添字を二分探索で返す。先頭より前なら -1 */
export function findKeyIndex(keys: readonly { frame: number }[], frame: number): number {
  let lo = 0
  let hi = keys.length - 1
  if (hi < 0 || frame < keys[0].frame) return -1
  if (frame >= keys[hi].frame) return hi
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (keys[mid].frame <= frame) lo = mid
    else hi = mid - 1
  }
  return lo
}
