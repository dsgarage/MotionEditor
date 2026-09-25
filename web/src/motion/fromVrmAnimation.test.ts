/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate'
import { detectFps, fromVrmAnimation } from './fromVrmAnimation'
import { parseVrma } from './loadVrma'
import { quatAngle } from './math'
import { countKeys } from './MotionDocument'
import { ALL_HUMAN_BONES, buildLongVrma, buildVrma, axisAngle } from './testing/buildVrma'

const deg = (r: number) => (r * 180) / Math.PI

function readSample(): ArrayBuffer {
  const path = fileURLToPath(new URL('../../public/samples/test.vrma', import.meta.url))
  const buf = readFileSync(path)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function interpolate(track: THREE.KeyframeTrack, t: number): ArrayLike<number> {
  return (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant().evaluate(t)
}

describe('VRMA → MotionDocument', () => {
  it('同梱サンプル(3 秒・キー 0.5 秒刻み)は 30fps・91 フレームになる', async () => {
    const anim = await parseVrma(readSample())
    expect(anim.duration).toBeCloseTo(3)
    const doc = fromVrmAnimation(anim, { name: 'test' })
    expect(doc.fps).toBe(30)
    expect(doc.frameCount).toBe(91)
    expect(Object.keys(doc.tracks)).toEqual(['rightUpperArm'])
    expect(Object.keys(doc.expressions)).toEqual(['happy'])
    expect(doc.bakedSource?.rotations.rightUpperArm).toHaveLength(91 * 4)
    // 間引き後の評価が元の VRMA トラックと 0.5° 以内で一致する
    const track = anim.humanoidTracks.rotation.get('rightUpperArm')!
    for (let f = 0; f < doc.frameCount; f++) {
      const q = evaluate(doc, f).rotations.rightUpperArm!
      expect(deg(quatAngle(q, 0, interpolate(track, f / 30), 0))).toBeLessThanOrEqual(0.5 + 1e-3)
    }
  })

  it('826 フレーム・30fps の毎フレームベイク VRMA を読み、キーを間引く', async () => {
    const anim = await parseVrma(buildLongVrma(826, 30))
    const doc = fromVrmAnimation(anim, { name: 'long' })
    expect(doc.fps).toBe(30)
    expect(doc.frameCount).toBe(826)
    expect(Object.keys(doc.tracks)).toHaveLength(ALL_HUMAN_BONES.length)
    expect(doc.hipsPosition.length).toBeGreaterThan(1)
    expect(Object.keys(doc.expressions).sort()).toEqual(['blink', 'happy'])
    // 生データより少なく、全フレームのキーより少ない
    const raw = 826 * (ALL_HUMAN_BONES.length + 1 + 2)
    expect(countKeys(doc)).toBeLessThan(raw)
    expect(doc.restHipsHeight).toBeCloseTo(1)
  })

  it('60fps でベイクされた VRMA は 60fps と判定する', async () => {
    const anim = await parseVrma(
      buildVrma({ fps: 60, frameCount: 121, bones: [{ bone: 'head', rotation: (f) => axisAngle([0, 1, 0], f / 60) }] }),
    )
    expect(detectFps(anim)).toBe(60)
    const doc = fromVrmAnimation(anim, { name: 'x' })
    expect(doc.frameCount).toBe(121)
    // 等速回転なので 2 キーまで減る
    expect(doc.tracks.head?.map((k) => k.frame)).toEqual([0, 120])
  })
})
