/**
 * 地铁网络时间模型：
 * 由各线路站点顺序构建图，估计相邻站间行驶时间，用 Dijkstra 计算从一个站点
 * 到全网各站的最小换乘时间，从而得到「地铁站至地铁站」的时间覆盖。
 * 相比高德 ArrivalRange 的仅地铁等时圈（偏保守、含步行、不含城际线），
 * 本模型更贴近地铁网络实际可达情况，且不受 60 分钟限制（最多 180 分钟）。
 */
import type { NormalizedStation } from './subway'

export interface MetroStop {
  id: string
  name: string
  lng: number
  lat: number
}

export interface MetroLine {
  name: string
  color: string
  stops: MetroStop[]
}

export interface MetroData {
  adcode: string
  city?: string
  stations: NormalizedStation[]
  lines: MetroLine[]
}

export interface MetroNode {
  key: string
  name: string
  lng: number
  lat: number
  lineNames: string[]
}

export interface MetroEdge {
  from: string
  to: string
  line: string
  minutes: number
}

export interface MetroGraph {
  nodes: Map<string, MetroNode>
  neighbors: Map<string, MetroEdge[]>
  edges: MetroEdge[]
}

// —— 估计参数 ——
const AVG_SPEED_KMH = 32 // 含停站的均速
const MIN_SEGMENT_MIN = 2 // 相邻站最小行驶分钟
const TRANSFER_MIN = 3 // 换乘（换线）分钟

/** 站 key：名称+坐标（保证跨线路去重） */
export function stationKey(name: string, lng: number, lat: number): string {
  return `${name}|${lng.toFixed(5)}|${lat.toFixed(5)}`
}

function haversineKm(ax: number, ay: number, bx: number, by: number): number {
  const R = 6371
  const dLat = ((by - ay) * Math.PI) / 180 // 纬度差
  const dLng = ((bx - ax) * Math.PI) / 180 // 经度差
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((ay * Math.PI) / 180) * Math.cos((by * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 依据线路站点顺序构建图（相邻站连边，双向）。 */
export function buildMetroGraph(lines: MetroLine[]): MetroGraph {
  const nodes = new Map<string, MetroNode>()
  const neighbors = new Map<string, MetroEdge[]>()
  const edges: MetroEdge[] = []

  const ensureNode = (s: MetroStop, lineName: string): MetroNode => {
    const key = stationKey(s.name, s.lng, s.lat)
    let n = nodes.get(key)
    if (!n) {
      n = { key, name: s.name, lng: s.lng, lat: s.lat, lineNames: [] }
      nodes.set(key, n)
      neighbors.set(key, [])
    }
    if (lineName && !n.lineNames.includes(lineName)) n.lineNames.push(lineName)
    return n
  }

  for (const line of lines) {
    const stops = line.stops
    if (stops.length < 2) continue
    for (let i = 0; i < stops.length - 1; i++) {
      const a = ensureNode(stops[i], line.name)
      const b = ensureNode(stops[i + 1], line.name)
      const km = haversineKm(a.lng, a.lat, b.lng, b.lat)
      const minutes = Math.max(MIN_SEGMENT_MIN, (km / AVG_SPEED_KMH) * 60)
      if (minutes <= 0) continue
      neighbors.get(a.key)!.push({ from: a.key, to: b.key, line: line.name, minutes })
      neighbors.get(b.key)!.push({ from: b.key, to: a.key, line: line.name, minutes })
      edges.push({ from: a.key, to: b.key, line: line.name, minutes })
    }
  }
  return { nodes, neighbors, edges }
}

/**
 * Dijkstra：从起点站到各站的最小时间（考虑换线惩罚）。
 * 状态 = (站点, 当前线路)。换线时额外加 TRANSFER_MIN。
 */
export function stationTravelTimes(
  graph: MetroGraph,
  startKey: string,
): Map<string, number> {
  const startNode = graph.nodes.get(startKey)
  if (!startNode) return new Map()

  const best = new Map<string, number>() // "key|line" -> minutes
  const bestStation = new Map<string, number>() // key -> minutes
  const pq: Array<{ key: string; line: string; minutes: number }> = []

  const push = (key: string, line: string, minutes: number) => {
    const sid = `${key}|${line}`
    if (minutes < (best.get(sid) ?? Infinity)) {
      best.set(sid, minutes)
      pq.push({ key, line, minutes })
      pq.sort((x, y) => x.minutes - y.minutes) // 小顶堆（数据规模小，线性排序够用）
    }
  }

  for (const line of startNode.lineNames) push(startKey, line, 0)

  while (pq.length) {
    const cur = pq.shift()!
    if (cur.minutes > (best.get(`${cur.key}|${cur.line}`) ?? Infinity)) continue
    const prevBest = bestStation.get(cur.key)
    if (prevBest === undefined || cur.minutes < prevBest) bestStation.set(cur.key, cur.minutes)

    const edges = graph.neighbors.get(cur.key) || []
    for (const e of edges) {
      const penalty = e.line === cur.line ? 0 : TRANSFER_MIN
      push(e.to, e.line, cur.minutes + penalty + e.minutes)
    }
  }
  return bestStation
}

/** 找距离某经纬度最近的地铁站。 */
export function nearestStation(
  stations: NormalizedStation[],
  lng: number,
  lat: number,
): NormalizedStation | null {
  let best: NormalizedStation | null = null
  let bestKm = Infinity
  for (const s of stations) {
    const km = haversineKm(lng, lat, s.lng, s.lat)
    if (km < bestKm) {
      bestKm = km
      best = s
    }
  }
  return best
}

export interface MetroCoverage {
  /** 起点站 key */
  startKey: string
  /** 起点站 */
  startStation: NormalizedStation | null
  /** 在时间预算内可达的站点（按时间升序） */
  reachableStations: Array<{ station: NormalizedStation; minutes: number }>
  /** 可达的线路区段（用于渲染网络覆盖） */
  edges: Array<{ from: [number, number]; to: [number, number]; line: string }>
}

/** 计算从某点（就近站点）出发，time 分钟内可达的地铁网络覆盖。 */
export function computeMetroCoverage(
  stations: NormalizedStation[],
  lines: MetroLine[],
  point: [number, number],
  time: number,
): MetroCoverage | null {
  const start = nearestStation(stations, point[0], point[1])
  if (!start) return null
  const startKey = stationKey(start.name, start.lng, start.lat)

  const graph = buildMetroGraph(lines)
  const times = stationTravelTimes(graph, startKey)
  if (!times.size) return null

  const reachable = Array.from(times.entries())
    .filter(([, m]) => m <= time)
    .map(([key, m]) => {
      const node = graph.nodes.get(key)!
      const st = stations.find((s) => stationKey(s.name, s.lng, s.lat) === key)
      return { station: st ?? ({ key, name: node.name, lng: node.lng, lat: node.lat, lineNames: node.lineNames } as any), minutes: m }
    })
    .sort((a, b) => a.minutes - b.minutes)

  // 可达区段：两端都可在预算内到达的相邻段
  const edgeSet = new Set<string>()
  const edges: MetroCoverage['edges'] = []
  for (const e of graph.edges) {
    const ta = times.get(e.from)
    const tb = times.get(e.to)
    if (ta !== undefined && tb !== undefined && ta <= time && tb <= time) {
      const a = graph.nodes.get(e.from)!
      const b = graph.nodes.get(e.to)!
      const id = a.key + '|' + b.key
      if (!edgeSet.has(id) && !edgeSet.has(b.key + '|' + a.key)) {
        edgeSet.add(id)
        edges.push({ from: [a.lng, a.lat], to: [b.lng, b.lat], line: e.line })
      }
    }
  }

  return { startKey, startStation: start, reachableStations: reachable, edges }
}

/** 读取某城市的地铁数据（含 station 与 lines）。 */
export async function fetchMetroData(adcode: string): Promise<MetroData> {
  const res = await fetch(`/data/subway/stations-${adcode}.json`)
  if (!res.ok) throw new Error(`地铁数据加载失败 (${res.status})`)
  const data = await res.json()
  const stations: NormalizedStation[] = (data.stations || [])
    .filter((s: any) => s.name && Number.isFinite(s.lng) && Number.isFinite(s.lat))
    .map((s: any) => ({
      id: String(s.id ?? `${adcode}:${s.name}`),
      name: String(s.name ?? ''),
      lng: Number(s.lng),
      lat: Number(s.lat),
      lineNames: Array.isArray(s.lineNames) ? s.lineNames : [],
    }))
  const lines: MetroLine[] = (data.lines || []).map((l: any) => ({
    name: String(l.name ?? ''),
    color: String(l.color ?? ''),
    stops: (l.stops || []).map((s: any) => ({
      id: String(s.id ?? ''),
      name: String(s.name ?? ''),
      lng: Number(s.lng),
      lat: Number(s.lat),
    })),
  }))
  return { adcode, stations, lines }
}
