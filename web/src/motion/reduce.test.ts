import { describe, expect, it } from 'vitest'
import { evaluatePosition, evaluateRotation, evaluateScalar } from './evaluate'
import { quatAngle } from './math'
import { reducePosition, reduceRotation, reduceScalar } from './reduce'
import { axisAngle } from './testing/buildVrma'

const deg = (r: number) => (r * 180) / Math.PI

function bakeRotation(n: number, fn: (f: number) => [number, number, number, number]): Float32Array {
  const out = new Float32Array(n * 4)
  for (let f = 0; f < n; f++) out.set(fn(f), f * 4)
  return out
}

describe('キー間引き', () => {
  it('等速回転は両端の 2 キーになる(途中のキーは誤差内なので消える)', () => {
    const baked = bakeRotation(61, (f) => axisAngle([0, 1, 0], (f / 60) * Math.PI * 0.5))
    const keys = reduceRotation(baked, 61, 0.5)
    expect(keys.map((k) => k.frame)).toEqual([0, 60])
  })

  it('しきい値を超える変化(折れ点)のキーは残る', () => {
    // 0〜30 で 60° 回して 30〜60 で戻す
    const baked = bakeRotation(61, (f) => axisAngle([1, 0, 0], ((f <= 30 ? f : 60 - f) / 30) * (Math.PI / 3)))
    const keys = reduceRotation(baked, 61, 0.5)
    expect(keys.map((k) => k.frame)).toEqual([0, 30, 60])
  })

  it('誤差しきい値より小さい揺れは消え、大きい揺れは残る', () => {
    const n = 100
    const small = bakeRotation(n, (f) => axisAngle([0, 0, 1], (f === 50 ? 0.3 : 0) * (Math.PI / 180)))
    expect(reduceRotation(small, n, 0.5).map((k) => k.frame)).toEqual([0, n - 1])
    const large = bakeRotation(n, (f) => axisAngle([0, 0, 1], (f === 50 ? 2 : 0) * (Math.PI / 180)))
    expect(reduceRotation(large, n, 0.5).map((k) => k.frame)).toEqual([0, 49, 50, 51, n - 1])
  })

  it('間引いた後の評価は、全フレームで生データとの誤差がしきい値以内', () => {
    const n = 300
    const baked = bakeRotation(n, (f) => axisAngle([0.3, 1, 0.2], 0.8 * Math.sin(f / 13) + 0.02 * Math.sin(f * 2.1)))
    const keys = reduceRotation(baked, n, 0.5)
    expect(keys.length).toBeLessThan(n)
    let maxErr = 0
    for (let f = 0; f < n; f++) {
      maxErr = Math.max(maxErr, deg(quatAngle(evaluateRotation(keys, f)!, 0, baked, f * 4)))
    }
    expect(maxErr).toBeLessThanOrEqual(0.5 + 1e-3)
  })

  it('位置は 1mm、表情は 0.01 のしきい値で間引く', () => {
    const n = 50
    const pos = new Float32Array(n * 3)
    for (let f = 0; f < n; f++) pos.set([f * 0.01 + (f === 20 ? 0.0005 : 0), 1, f === 30 ? 0.005 : 0], f * 3)
    const pkeys = reducePosition(pos, n, 0.001)
    // 0.5mm の揺れは消え、5mm の揺れは残る
    expect(pkeys.map((k) => k.frame)).toEqual([0, 29, 30, 31, n - 1])
    for (let f = 0; f < n; f++) {
      const p = evaluatePosition(pkeys, f)!
      expect(Math.hypot(p[0] - pos[f * 3], p[1] - pos[f * 3 + 1], p[2] - pos[f * 3 + 2])).toBeLessThanOrEqual(0.001 + 1e-6)
    }

    const expr = new Float32Array(n)
    for (let f = 0; f < n; f++) expr[f] = f < 25 ? 0 : 1
    expr[10] = 0.005
    const ekeys = reduceScalar(expr, n, 0.01)
    expect(ekeys.map((k) => k.frame)).toEqual([0, 24, 25, n - 1])
    expect(evaluateScalar(ekeys, 10)).toBe(0)
  })

  it('1 フレームだけのトラックは 1 キー', () => {
    expect(reduceRotation(bakeRotation(1, () => [0, 0, 0, 1]), 1, 0.5)).toHaveLength(1)
  })
})
