/**
 * 地铁站点数据：从同源静态数据文件获取（public/data/subway/stations-<adcode>.json）。
 * 数据由 scripts/generate-subway-data.mjs 预生成（源自高德地铁数据），避免依赖不稳定的
 * 地铁图 JS API（Beta 版，且不便于浏览器直接加载）。
 */
import type { PlaceCandidate } from '../types'

export interface NormalizedLine {
  name: string
  color: string
  stations: NormalizedStation[]
}

export interface NormalizedStation {
  id: string
  name: string
  lng: number
  lat: number
  lineNames: string[]
  /** 所属城市名（跨城市检索时用于区分） */
  city?: string
}

/** 从静态数据文件加载某城市所有站点。 */
export async function fetchCityStations(adcode: string, cityName?: string): Promise<NormalizedStation[]> {
  const res = await fetch(`/data/subway/stations-${adcode}.json`)
  if (!res.ok) throw new Error(`地铁数据加载失败 (${res.status})`)
  const data = await res.json()
  const raw = Array.isArray(data?.stations) ? data.stations : []
  return raw
    .map((s: any) => ({
      id: String(s?.id ?? `${adcode}:${s?.name}`),
      name: String(s?.name ?? ''),
      lng: Number(s?.lng),
      lat: Number(s?.lat),
      lineNames: Array.isArray(s?.lineNames) ? (s.lineNames as string[]) : [],
      city: cityName,
    }))
    .filter((s: any) => s.name && Number.isFinite(s.lng) && Number.isFinite(s.lat))
}

/** 在站点列表中按关键词模糊检索（支持站名/拼音/线路）。 */
export function searchStations(
  stations: NormalizedStation[],
  keyword: string,
  limit = 8,
): PlaceCandidate[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  const lower = (s: NormalizedStation) =>
    s.name.toLowerCase().includes(kw) ||
    s.lineNames.some((l) => l.toLowerCase().includes(kw))
  const startsWith = (s: NormalizedStation) => s.name.toLowerCase().startsWith(kw)
  const scored = stations
    .filter((s) => lower(s))
    .sort((a, b) => (startsWith(b) ? 1 : 0) - (startsWith(a) ? 1 : 0))
  return scored.slice(0, limit).map((s) => ({
    name: s.name,
    lnglat: [s.lng, s.lat],
    address: [s.city, ...s.lineNames].filter(Boolean).join(' / ') || undefined,
    type: 'station' as const,
  }))
}

// ----- 兼容旧接口（生成数据后不再用于运行时，仅保留类型描述） -----
export function flattenStations(lines: NormalizedLine[], cityName?: string): NormalizedStation[] {
  const map = new Map<string, NormalizedStation>()
  for (const line of lines) {
    for (const st of line.stations) {
      const key = `${st.name}|${st.lng}|${st.lat}`
      const exist = map.get(key)
      if (exist) {
        if (!exist.lineNames.includes(line.name)) exist.lineNames.push(line.name)
      } else {
        map.set(key, {
          ...st,
          lineNames: [...new Set([...st.lineNames, line.name])],
          city: cityName || st.city,
        })
      }
    }
  }
  return Array.from(map.values())
}
