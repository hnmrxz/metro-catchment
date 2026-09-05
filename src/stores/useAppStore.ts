import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  DEFAULT_CITY,
  DEFAULT_TIME,
  MAX_POINTS,
  CITIES,
  type CityMeta,
  type Policy,
} from '@/config'
import { hasKey } from '@/amap/loader'
import { searchStations, type NormalizedStation } from '@/amap/subway'
import { fetchMetroData, computeMetroCoverage, nearestStation, type MetroLine } from '@/amap/metroGraph'
import { intersectRings } from '@/utils/isochroneGeometry'
import type { ArrivalRangeResult, MetroCoverageResult, Point, PlaceCandidate } from '@/types'
import type { MapMode } from '@/engine'

let pointSeq = 0
function nextId(): string {
  pointSeq += 1
  return `pt_${Date.now()}_${pointSeq}`
}

export const useAppStore = defineStore('app', () => {
  const mode = ref<MapMode>(hasKey() ? 'real' : 'demo')

  const city = ref<CityMeta>({ ...DEFAULT_CITY })
  const points = ref<Point[]>([])
  const selectedPointId = ref<string | null>(null)
  const currentTime = ref<number>(DEFAULT_TIME)
  const currentPolicy = ref<Policy>('SUBWAY,BUS')
  const results = ref<ArrivalRangeResult[]>([])
  const computing = ref(false)
  const showIntersection = ref(false)
  const intersection = ref<Array<Array<[number, number]>>>([])
  const fitSignal = ref(0)
  const clearSignal = ref(0)
  const statusMessage = ref('')

  // 地铁站点索引（当前城市 + 全局跨城市检索池）
  const stations = ref<NormalizedStation[]>([])
  const stationsLoading = ref(false)
  const stationPool = ref<NormalizedStation[]>([])
  const stationPoolLoading = ref(false)
  const stationPoolReady = ref(false)
  const poolLoadedCities = new Set<string>()
  // 各城市地铁线路图（用于地铁网络时间覆盖计算）
  const metroLinesCache = new Map<string, MetroLine[]>()

  const selectedPoint = computed(() =>
    points.value.find((p) => p.id === selectedPointId.value) || null,
  )

  const canAddPoint = computed(() => points.value.length < MAX_POINTS)

  function setStatus(msg: string, ms = 0): void {
    statusMessage.value = msg
    if (ms > 0) {
      setTimeout(() => {
        if (statusMessage.value === msg) statusMessage.value = ''
      }, ms)
    }
  }

  function setCity(c: CityMeta): void {
    city.value = { ...c }
    clearAll()
    stations.value = []
    stationPoolReady.value = false
    poolLoadedCities.clear()
    metroLinesCache.clear()
    if (mode.value === 'real') {
      void loadStations()
    }
  }

  function addPoint(name: string, lnglat: [number, number], fromStation = false): Point | null {
    if (!canAddPoint.value) {
      setStatus(`最多同时对比 ${MAX_POINTS} 个起点`, 2500)
      return null
    }
    const pt: Point = { id: nextId(), name, lnglat: [...lnglat] as [number, number], fromStation }
    points.value.push(pt)
    if (selectedPointId.value === null) selectedPointId.value = pt.id
    setStatus(`已添加起点：${name}`, 2000)
    return pt
  }

  function removePoint(id: string): void {
    points.value = points.value.filter((p) => p.id !== id)
    results.value = results.value.filter((r) => r.point.id !== id)
    recomputeIntersection()
    if (selectedPointId.value === id) {
      selectedPointId.value = points.value[0]?.id ?? null
    }
  }

  function selectPoint(id: string): void {
    selectedPointId.value = id
    requestFit()
  }

  function clearAll(): void {
    points.value = []
    results.value = []
    selectedPointId.value = null
    showIntersection.value = false
    intersection.value = []
    clearSignal.value += 1
    setStatus('已清空')
  }

  function removeResult(id: string): void {
    results.value = results.value.filter((r) => r.point.id !== id)
  }

  function upsertResult(r: ArrivalRangeResult): void {
    const idx = results.value.findIndex((x) => x.point.id === r.point.id)
    if (idx >= 0) results.value.splice(idx, 1, r)
    else results.value.push(r)
    recomputeIntersection()
  }

  function requestFit(): void {
    fitSignal.value += 1
  }

  function setComputing(v: boolean): void {
    computing.value = v
  }

  function toggleIntersection(): void {
    showIntersection.value = !showIntersection.value
  }

  /** 依据当前成功结果重新计算交集（多起点对比）。 */
  function recomputeIntersection(): void {
    const complete = results.value
      .filter((r) => r.status === 'complete' && r.bounds.length)
      .map((r) => r.bounds)
    if (complete.length >= 2) {
      intersection.value = intersectRings(complete)
    } else {
      intersection.value = []
    }
  }

  /** 将一批站点合并进全局检索池（按名称+坐标去重）。 */
  function mergeStations(list: NormalizedStation[]): void {
    const keyOf = (s: NormalizedStation) => `${s.name}|${s.lng}|${s.lat}`
    const map = new Map<string, NormalizedStation>()
    for (const s of stationPool.value) map.set(keyOf(s), s)
    for (const s of list) {
      const k = keyOf(s)
      const prev = map.get(k)
      if (prev) {
        const lines = new Set([...prev.lineNames, ...s.lineNames])
        map.set(k, {
          ...prev,
          lineNames: [...lines],
          city: prev.city || s.city,
          cityAdcode: prev.cityAdcode || s.cityAdcode,
        })
      } else {
        map.set(k, s)
      }
    }
    stationPool.value = Array.from(map.values())
  }

  async function loadCityStations(adcode: string, cityName: string): Promise<void> {
    if (poolLoadedCities.has(adcode)) return
    try {
      const data = await fetchMetroData(adcode)
      const tagged = data.stations.map((s) => ({ ...s, city: cityName, cityAdcode: adcode }))
      mergeStations(tagged)
      metroLinesCache.set(adcode, data.lines)
      poolLoadedCities.add(adcode)
    } catch {
      // 单城失败不阻塞其它城市；允许下次重试
      poolLoadedCities.delete(adcode)
    }
  }

  async function loadStations(): Promise<NormalizedStation[]> {
    if (stations.value.length || stationsLoading.value) return stations.value
    stationsLoading.value = true
    setStatus('正在获取地铁站点数据…')
    try {
      const data = await fetchMetroData(city.value.adcode)
      const tagged = data.stations.map((s) => ({
        ...s,
        city: city.value.name,
        cityAdcode: city.value.adcode,
      }))
      stations.value = tagged
      mergeStations(tagged)
      metroLinesCache.set(city.value.adcode, data.lines)
      poolLoadedCities.add(city.value.adcode)
      void ensureStationPool()
      setStatus(`已获取 ${stations.value.length} 个地铁站点`, 2500)
    } catch (e: any) {
      setStatus(`地铁站点获取失败：${e?.message || e}`, 3500)
    } finally {
      stationsLoading.value = false
    }
    return stations.value
  }

  /** 计算从某点出发的地铁站至地铁站时间覆盖（就近站点为起点）。 */
  function metroCoverageFor(
    lnglat: [number, number],
    time: number,
  ): MetroCoverageResult | null {
    const source = stationPool.value.length ? stationPool.value : stations.value
    const nearest = nearestStation(source, lnglat[0], lnglat[1])
    if (!nearest) return null
    const adcode = nearest.cityAdcode || city.value.adcode
    const lines = metroLinesCache.get(adcode)
    if (!lines || !lines.length) return null
    const cover = computeMetroCoverage(source, lines, lnglat, time)
    if (!cover || !cover.startStation) return null
    return {
      startLnglat: [cover.startStation.lng, cover.startStation.lat],
      startName: cover.startStation.name,
      reachable: cover.reachableStations.map((r) => ({
        name: r.station.name,
        lnglat: [r.station.lng, r.station.lat],
        minutes: r.minutes,
      })),
      edges: cover.edges.map((e) => ({ from: e.from, to: e.to })),
    }
  }

  /** 确保跨城市检索池已加载（当前城市 + 各配置城市，逐个加载以避免 Subway 全局冲突）。 */
  async function ensureStationPool(): Promise<void> {
    if (stationPoolReady.value || stationPoolLoading.value) return
    stationPoolLoading.value = true
    try {
      if (!poolLoadedCities.has(city.value.adcode)) {
        await loadCityStations(city.value.adcode, city.value.name)
      }
      for (const c of CITIES) {
        if (c.adcode === city.value.adcode) continue
        await loadCityStations(c.adcode, c.name)
      }
      stationPoolReady.value = true
    } finally {
      stationPoolLoading.value = false
    }
  }

  /** 跨城市站点检索：覆盖本城市与同网络邻近城市（如杭州→海宁/绍兴等）。 */
  async function searchStationsLocal(keyword: string): Promise<PlaceCandidate[]> {
    const kw = keyword.trim()
    if (!kw) return []
    if (!stationPoolReady.value) {
      // 确保检索池就绪后再查，保证跨城市站点可被命中
      await ensureStationPool()
    }
    const pool = stationPool.value.length ? stationPool.value : stations.value
    return searchStations(pool, kw)
  }

  return {
    mode,
    city,
    points,
    selectedPointId,
    selectedPoint,
    canAddPoint,
    currentTime,
    currentPolicy,
    results,
    computing,
    showIntersection,
    intersection,
    fitSignal,
    clearSignal,
    statusMessage,
    stations,
    stationsLoading,
    stationPool,
    stationPoolLoading,
    stationPoolReady,
    setCity,
    addPoint,
    removePoint,
    selectPoint,
    clearAll,
    removeResult,
    upsertResult,
    requestFit,
    setComputing,
    toggleIntersection,
    recomputeIntersection,
    setStatus,
    loadStations,
    ensureStationPool,
    searchStationsLocal,
    metroCoverageFor,
  }
})
