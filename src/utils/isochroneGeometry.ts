/**
 * 等时圈几何计算（turf）：多个可达圈交集、并集，用于多起点对比。
 */
import * as turf from '@turf/turf'

type Ring = Array<[number, number]>

function toFeatureCollection(ringsList: Ring[][]): { type: string; features: any[] } | null {
  const features: any[] = []
  for (const rings of ringsList) {
    for (const ring of rings) {
      if (ring.length < 3) continue
      try {
        // 需要闭合环（首点 == 末点）
        const closed = ring[0][0] === ring[ring.length - 1][0]
          && ring[0][1] === ring[ring.length - 1][1]
          ? ring
          : [...ring, ring[0]]
        features.push(turf.polygon([closed]))
      } catch {
        /* ignore malformed ring */
      }
    }
  }
  return features.length ? { type: 'FeatureCollection', features } : null
}

/** 计算所有多边形（按起点分组）的总交集；无交集返回空数组。 */
export function intersectRings(ringsList: Ring[][]): Ring[] {
  const fc = toFeatureCollection(ringsList)
  if (!fc) return []
  try {
    const inter = (turf as any).intersect(turf.featureCollection(fc.features)) as any
    if (!inter) return []
    if (inter.geometry?.type === 'Polygon') {
      return (inter.geometry.coordinates as any[]).map((c: any) =>
        c.map((p: number[]) => [p[0], p[1]] as [number, number]),
      )
    }
    if (inter.geometry?.type === 'MultiPolygon') {
      return (inter.geometry.coordinates as any[]).flatMap((poly: any[]) =>
        poly.map((c: any) => c.map((p: number[]) => [p[0], p[1]] as [number, number])),
      )
    }
    return []
  } catch {
    return []
  }
}

/** 计算所有多边形的总并集。 */
export function unionRings(ringsList: Ring[][]): Ring[] {
  const fc = toFeatureCollection(ringsList)
  if (!fc) return []
  try {
    const u = (turf as any).union(turf.featureCollection(fc.features)) as any
    if (!u) return []
    if (u.geometry?.type === 'Polygon') {
      return (u.geometry.coordinates as any[]).map((c: any) =>
        c.map((p: number[]) => [p[0], p[1]] as [number, number]),
      )
    }
    if (u.geometry?.type === 'MultiPolygon') {
      return (u.geometry.coordinates as any[]).flatMap((poly: any[]) =>
        poly.map((c: any) => c.map((p: number[]) => [p[0], p[1]] as [number, number])),
      )
    }
    return []
  } catch {
    return []
  }
}
