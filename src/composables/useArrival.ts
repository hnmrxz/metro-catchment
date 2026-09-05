/**
 * 可达圈计算协调器：
 *  - 真实 Key：调用 AMap.ArrivalRange（QPS 受限，顺序执行）
 *  - 演示模式：使用本地的 mock 等时圈生成器
 * 结果写入 Pinia store，渲染层(response)监听 store.results 刷新覆盖物。
 */
import { searchArrivalRange } from '@/amap/arrival'
import { generateMockIsochrone } from '@/amap/mockIsochrone'
import { runtime, colorForPoint } from '@/engine'
import { useAppStore } from '@/stores/useAppStore'
import type { ArrivalRangeResult, Point } from '@/types'
import type { Policy } from '@/config'

export async function computeForPoint(
  point: Point,
  time: number,
  policy: Policy,
): Promise<ArrivalRangeResult> {
  const store = useAppStore()
  const base: ArrivalRangeResult = {
    point,
    time,
    policy,
    bounds: [],
    color: colorForPoint(store.points, point.id),
    status: 'pending',
  }

  // 纯地铁：使用「地铁网络遍历」的站至站时间覆盖（更贴近地铁实际可达，
  // 且不受高德 60 分钟限制，最长 180 分钟）。
  if (policy === 'SUBWAY') {
    const cover = store.metroCoverageFor(point.lnglat, time)
    if (cover) {
      base.metroCoverage = cover
      base.status = cover.reachable.length ? 'complete' : 'empty'
      if (!cover.reachable.length) base.message = '时间预算内无可达地铁站'
    } else {
      base.status = 'empty'
      base.message = '该点附近暂无地铁数据'
    }
    return base
  }

  // 公交 / 地铁+公交：使用高德等时圈（上限 60 分钟）
  const t = Math.min(time, 60)
  if (runtime.mode === 'real' && runtime.AMap) {
    try {
      const res = await searchArrivalRange(runtime.AMap, point.lnglat, { policy, time: t })
      base.bounds = res.bounds
      base.status = res.status
      base.message = res.message
    } catch (e: any) {
      base.status = 'error'
      base.message = e?.message || '可达圈计算异常'
    }
  } else {
    // 演示模式
    base.bounds = generateMockIsochrone(point.lnglat, t, policy)
    base.status = 'complete'
  }
  if (time > 60) {
    base.message = (base.message ? base.message + '；' : '') + '高德等时圈最多 60 分钟，已按 60 分钟计算'
  }

  return base
}

/** 为当前所有起点计算可达圈（顺序执行）。 */
export async function computeAll(): Promise<void> {
  const store = useAppStore()
  if (!store.points.length) {
    store.setStatus('请先添加起点', 2500)
    return
  }
  store.setComputing(true)
  let ok = 0
  let empty = 0
  let err = 0
  try {
    for (const p of store.points) {
      // 先标记 pending，给出即时反馈
      store.upsertResult({
        point: p,
        time: store.currentTime,
        policy: store.currentPolicy,
        bounds: [],
        color: colorForPoint(store.points, p.id),
        status: 'pending',
      })
      const r = await computeForPoint(p, store.currentTime, store.currentPolicy)
      store.upsertResult(r)
      if (r.status === 'complete') ok++
      else if (r.status === 'empty') empty++
      else err++
    }
  } finally {
    store.setComputing(false)
  }
  store.requestFit()
  const parts = [`${ok} 个成功`]
  if (empty) parts.push(`${empty} 个无结果`)
  if (err) parts.push(`${err} 个失败`)
  store.setStatus(`计算完成：${parts.join('，')}`, 3200)
}
