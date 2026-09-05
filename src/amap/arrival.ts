/**
 * 可达圈（等时圈）计算服务，封装 AMap.ArrivalRange。
 * 将高德返回的多边形路径归一化为 Array<[lng, lat]>。
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

function normalizePath(path: any): Array<[number, number]> {
  if (Array.isArray(path)) {
    return path
      .map((p) => {
        if (Array.isArray(p)) return [Number(p[0]), Number(p[1])] as [number, number]
        if (p && typeof p === 'object') {
          return [Number(p.lng ?? p[0]), Number(p.lat ?? p[1])] as [number, number]
        }
        return null
      })
      .filter(Boolean) as Array<[number, number]>
  }
  return []
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
          if (status === 'complete' && result && Array.isArray(result.bounds)) {
            const bounds = result.bounds
              .map((b: any) => normalizePath(b))
              .filter((b: Array<[number, number]>) => b.length >= 3)
            if (bounds.length === 0) {
              resolve({ status: 'empty', bounds: [] })
            } else {
              resolve({ status: 'complete', bounds })
            }
          } else if (status && status !== 'complete') {
            // 高德在无结果显示 status 为其他值
            resolve({ status: 'empty', bounds: [] })
          } else {
            resolve({ status: 'error', message: '可达圈计算无有效结果', bounds: [] })
          }
        },
        { policy: opts.policy },
      )
    } catch (e: any) {
      resolve({ status: 'error', message: e?.message || '可达圈计算调用异常', bounds: [] })
    }
  })
}
