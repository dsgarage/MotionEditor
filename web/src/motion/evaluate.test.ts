import { describe, expect, it } from 'vitest'
import { evaluate, evaluatePosition, evaluateRotation, evaluateScalar } from './evaluate'
import { DEFAULT_TOLERANCE, type MotionDocument, type RotationKey } from './MotionDocument'
import { axisAngle } from './testing/buildVrma'
import { quatAngle } from './math'

const deg = (r: number) => (r * 180) / Math.PI

describe('evaluate', () => {
  const keys: RotationKey[] = [
    { frame: 0, q: axisAngle([0, 1, 0], 0), interp: 'linear' },
    { frame: 10, q: axisAngle([0, 1, 0], Math.PI / 2), interp: 'linear' },
    { frame: 20, q: axisAngle([0, 1, 0], Math.PI / 2), interp: 'step' },
    { frame: 30, q: axisAngle([1, 0, 0], Math.PI / 3), interp: 'linear' },
  ]

  it('回転はキー間を球面線形補間する(中点で角度が半分)', () => {
    const q = evaluateRotation(keys, 5)!
    expect(deg(quatAngle(q, 0, axisAngle([0, 1, 0], Math.PI / 4), 0))).toBeLessThan(1e-4)
    // 小数フレームも補間する
    const q2 = evaluateRotation(keys, 2.5)!
    expect(deg(quatAngle(q2, 0, axisAngle([0, 1, 0], Math.PI / 8), 0))).toBeLessThan(1e-4)
  })

  it('キー上ではキーの値、範囲外は端のキーを保持する', () => {
    expect(evaluateRotation(keys, 10)).toEqual(keys[1].q)
    expect(evaluateRotation(keys, -5)).toEqual(keys[0].q)
    expect(evaluateRotation(keys, 99)).toEqual(keys[3].q)
  })

  it('step は次のキーまで値を保持する', () => {
    expect(evaluateRotation(keys, 29.9)).toEqual(keys[2].q)
  })

  it('最短経路で補間する(符号が逆のクォータニオンでも遠回りしない)', () => {
    const a = axisAngle([0, 0, 1], 0.2)
    const b = axisAngle([0, 0, 1], 0.4).map((v) => -v) as [number, number, number, number]
    const q = evaluateRotation(
      [
        { frame: 0, q: a, interp: 'linear' },
        { frame: 2, q: b, interp: 'linear' },
      ],
      1,
    )!
    expect(deg(quatAngle(q, 0, axisAngle([0, 0, 1], 0.3), 0))).toBeLessThan(1e-4)
  })

  it('位置と表情は線形補間する', () => {
    const p = evaluatePosition(
      [
        { frame: 0, p: [0, 1, 0], interp: 'linear' },
        { frame: 4, p: [4, 1, -2], interp: 'linear' },
      ],
      1,
    )
    expect(p).toEqual([1, 1, -0.5])
    const v = evaluateScalar(
      [
        { frame: 10, v: 0, interp: 'linear' },
        { frame: 20, v: 1, interp: 'linear' },
      ],
      17,
    )
    expect(v).toBeCloseTo(0.7)
  })

  it('evaluate はドキュメントの全トラックを返す', () => {
    const doc: MotionDocument = {
      name: 't',
      fps: 30,
      frameCount: 31,
      tracks: { hips: keys, head: [] },
      hipsPosition: [{ frame: 0, p: [0, 1, 0], interp: 'linear' }],
      expressions: { happy: [{ frame: 0, v: 0.3, interp: 'linear' }] },
      restHipsHeight: 1,
      tolerance: DEFAULT_TOLERANCE,
      bakedSource: null,
    }
    const pose = evaluate(doc, 10)
    expect(Object.keys(pose.rotations)).toEqual(['hips'])
    expect(pose.hipsPosition).toEqual([0, 1, 0])
    expect(pose.expressions).toEqual({ happy: 0.3 })
  })
})
