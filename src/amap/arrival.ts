/**
 * 可达圈（等时圈）计算服务，封装 AMap.ArrivalRange。
 *
 * 注意：该插件返回结构较特殊——
 *  - 回调 status 可能为 'complete' / 'no_data' / 'error' 等；即便为 'no_data'，
 *    result.bounds 中仍可能带有有效多边形，因此只要存在有效 bounds 就视为成功。
 *  - result.bounds 的每一项是一个「多边形」，形如 GeoJSON Polygon：[[外环], [洞...]...]，
 *    其中外环为 [[lng,lat], ...]。这里取外环作为渲染路径。
 */
import type { AMapNamespace } from './loader'

export interface ArrivalSearchOptions {
  policy: string
  time: number
}

export interface ArrivalSearchOutcome {
  status: 'complete' | 'empty' | 'error'
  message?: string
  bounds: Array<Array<[number, number]>>
}

/** 将单个坐标归一化为 [lng, lat]（兼容数组或 {lng,lat} 对象）。 */
function toCoord(p: any): [number, number] | null {
  if (Array.isArray(p)) {
    const lng = Number(p[0])
    const lat = Number(p[1])
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
  }
  if (p && typeof p === 'object') {
    const lng = Number(p.lng ?? p[0])
    const lat = Number(p.lat ?? p[1])
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
  }
  return null
}

/** 归一化一条闭合环（由若干坐标点组成）。 */
function normalizeRing(ring: any): Array<[number, number]> {
  if (!Array.isArray(ring)) return []
  const out: Array<[number, number]> = []
  for (const p of ring) {
    const c = toCoord(p)
    if (c) out.push(c)
  }
  return out
}

/**
 * 把一个 bounds 元素（一个多边形）归一化为若干条路径。
 * 兼容两种形态：
 *  - 多边形：[[外环], [洞...]...]
 *  - 直接为一条环：[[lng,lat], ...]
 */
function normalizePolygon(poly: any): Array<Array<[number, number]>> {
  if (!Array.isArray(poly)) return []
  const first = poly[0]
  const isGeoPolygon = Array.isArray(first) && Array.isArray(first[0])
  const rings = isGeoPolygon ? poly : [poly]
  const out: Array<Array<[number, number]>> = []
  for (const ring of rings) {
    const r = normalizeRing(ring)
    if (r.length >= 3) out.push(r)
  }
  // 若为 GeoJSON 多边形，取外环即可（洞不作为独立区域渲染）
  return out
}

function normalizeBounds(bounds: any): Array<Array<[number, number]>> {
  if (!Array.isArray(bounds)) return []
  const out: Array<Array<[number, number]>> = []
  for (const poly of bounds) {
    out.push(...normalizePolygon(poly))
  }
  return out
}

/**
 * 计算从起点出发，在 time 分钟内以 policy 策略可到达的范围。
 */
export function searchArrivalRange(
  AMap: AMapNamespace,
  lnglat: [number, number],
  opts: ArrivalSearchOptions,
): Promise<ArrivalSearchOutcome> {
  return new Promise((resolve) => {
    try {
      const arrival = new AMap.ArrivalRange()
      arrival.search(
        [lnglat[0], lnglat[1]],
        opts.time,
        (status: string, result: any) => {
          // 只要返回了有效多边形，就认为成功（状态可能为 'no_data' 等，但 bounds 仍有效）
          const bounds = normalizeBounds(result?.bounds)
          if (bounds.length) {
            resolve({ status: 'complete', bounds })
            return
          }
          if (status === 'error' || result?.info === 'FAILED') {
            resolve({ status: 'error', message: '可达圈计算查询失败', bounds: [] })
            return
          }
          // 无有效多边形：空结果
          resolve({ status: 'empty', message: '起点附近暂无可达数据', bounds: [] })
        },
        { policy: opts.policy },
      )
    } catch (e: any) {
      resolve({ status: 'error', message: e?.message || '可达圈计算调用异常', bounds: [] })
    }
  })
}
