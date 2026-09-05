/**
 * 演示（无 Key）模式使用的等时圈生成器。
 * 根据起点、时间、策略生成风格化的不规则多边形，便于在接入真实 Key 前预览 UI。
 */
import type { Policy } from '@/config'

// 简单 seed 随机（mulberry32），保证同一起点每次生成的形状稳定
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(lng: number, lat: number): number {
  return Math.round(lng * 1e6 + lat * 1e4) & 0xffffffff
}

const DEG_LAT = 111 // km per deg lat

function radiusKmFor(time: number, policy: Policy): number {
  const base = time * 0.45 + 0.4
  switch (policy) {
    case 'SUBWAY':
      return base * 1.0
    case 'BUS':
      return base * 0.62
    case 'SUBWAY,BUS':
      return base * 1.18
    default:
      return base
  }
}

/** 生成一个起点的等时圈多边形（数组，每个为 [lng,lat] 环）。 */
export function generateMockIsochrone(
  center: [number, number],
  time: number,
  policy: Policy,
): Array<Array<[number, number]>> {
  const [lng, lat] = center
  const rng = mulberry32(seedFrom(lng, lat) + Math.round(time) * 7)
  const km = radiusKmFor(time, policy)
  const dLatKm = km / DEG_LAT
  const dLngKm = km / (DEG_LAT * Math.cos((lat * Math.PI) / 180))

  const ringCount = time >= 15 ? 2 : 1
  const bounds: Array<Array<[number, number]>> = []

  for (let r = 0; r < ringCount; r++) {
    const radiusScale = 1 - r * 0.42
    const points = 28
    const ring: Array<[number, number]> = []
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2
      const wobble = 0.72 + rng() * 0.5
      const rr = radiusScale * wobble
      const dy = Math.sin(angle) * rr * dLatKm
      const dx = Math.cos(angle) * rr * dLngKm
      ring.push([lng + dx, lat + dy])
    }
    // 收尾：回到首点前的相邻点（形成闭合路径由 Polygon 处理，这里保留首元素）
    bounds.push(ring)
  }
  return bounds
}
