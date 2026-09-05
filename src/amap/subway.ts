/**
 * 地铁站点检索与类型。
 * 站点/线路数据读取见 metroGraph.ts（fetchMetroData）。这里只保留检索与类型。
 */
import type { PlaceCandidate } from '../types'

export interface NormalizedStation {
  id: string
  name: string
  lng: number
  lat: number
  lineNames: string[]
  /** 所属城市名（跨城市检索时用于区分） */
  city?: string
  /** 所属城市 adcode（用于取线路图） */
  cityAdcode?: string
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
