/**
 * 地铁图 JS API 集成：城市列表、线路列表、站点检索。
 * 地铁图 API 为 Beta 版，返回结构会随版本变化，此处做防御式归一化。
 */
import { loadSubway } from './loader'
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

function pickName(o: any): string {
  return String(o?.n ?? o?.name ?? o?.km ?? '')
}

function pickLngLat(o: any): { lng: number; lat: number } | null {
  const s = o?.sl ?? o?.lnglat ?? o?.xy ?? ''
  if (Array.isArray(s)) return { lng: Number(s[0]), lat: Number(s[1]) }
  if (typeof s === 'string' && s.includes(',')) {
    const [lng, lat] = s.split(',').map(Number)
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat }
  }
  const lng = Number(o?.lng ?? o?.lng2 ?? NaN)
  const lat = Number(o?.lat ?? o?.lat2 ?? NaN)
  if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat }
  return null
}

function normalizeLine(line: any, fallbackName = ''): NormalizedLine {
  const lineName = String(line?.kn ?? line?.name ?? fallbackName ?? '')
  const color = String(line?.cl ?? line?.color ?? '#0096FF')
  const rawStations = Array.isArray(line?.st)
    ? line.st
    : Array.isArray(line?.stations)
      ? line.stations
      : []
  const stations: NormalizedStation[] = []
  for (const st of rawStations) {
    const pos = pickLngLat(st)
    if (!pos) continue
    stations.push({
      id: String(st?.poiid ?? st?.id ?? `s${stations.length}`),
      name: pickName(st),
      lng: pos.lng,
      lat: pos.lat,
      lineNames: [lineName].filter(Boolean),
    })
  }
  return { name: lineName, color, stations }
}

function normalizeLineList(raw: any): NormalizedLine[] {
  // getLineList 返回可能为数组直接，或 { lines, ... }
  const arr = Array.isArray(raw) ? raw : (raw?.lines ?? raw?.l ?? [])
  if (!Array.isArray(arr)) return []
  return arr.map((l, i) => normalizeLine(l, `线路${i + 1}`)).filter((l) => l.stations.length > 0)
}

/** 获取当前城市的所有线路及站点（合并重名站点的线路归属）。 */
export async function fetchLines(adcode: string, cityName?: string): Promise<NormalizedLine[]> {
  await loadSubway()
  const SubwayCtor = (window as any).Subway
  if (!SubwayCtor) throw new Error('Subway 未加载')

  // Subway 构造器需要一个真实容器，这里创建一个隐藏的容器元素
  const holder = document.createElement('div')
  holder.id = '__amap_subway_holder__'
  holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:400px;height:400px;'
  document.body.appendChild(holder)

  let subway: any = null
  try {
    subway = new SubwayCtor(holder, { adcode, theme: 'normal', easy: true })
    const data = await new Promise<any>((resolve, reject) => {
      let done = false
      const timer = setTimeout(() => {
        if (!done) {
          done = true
          reject(new Error('线路数据获取超时'))
        }
      }, 10000)
      try {
        subway.getLineList((list: any) => {
          if (!done) {
            done = true
            clearTimeout(timer)
            resolve(list)
          }
        })
      } catch (e) {
        clearTimeout(timer)
        if (!done) {
          done = true
          reject(e)
        }
      }
    })
    return normalizeLineList(data)
  } finally {
    try {
      subway?.destroy?.()
    } catch {
      /* ignore */
    }
    holder.remove()
  }
}

/** 将线路数据展平为站点 + 所属线路。 */
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

/** 在站点列表中按关键词模糊检索。 */
export function searchStations(
  stations: NormalizedStation[],
  keyword: string,
  limit = 8,
): PlaceCandidate[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  return stations
    .filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.lineNames.some((l) => l.toLowerCase().includes(kw)),
    )
    .slice(0, limit)
    .map((s) => ({
      name: s.name,
      lnglat: [s.lng, s.lat],
      address: s.lineNames.length ? `${s.lineNames.join(' / ')}` : undefined,
      type: 'station' as const,
    }))
}
