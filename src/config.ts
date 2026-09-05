/**
 * 全局静态配置：默认城市、中心点、可调配参数等。
 * 可通过 .env 的 VITE_* 或运行时环境覆盖部分默认值。
 */

import { CHINA_METRO_CITIES, type MetroCity } from './data/chinaMetroCities'

export interface CityMeta extends MetroCity {}

/** 中国所有已开通轨道交通的城市数据集（按省份分组、拼音排序由下方 helper 处理）。 */
export const CITIES: CityMeta[] = CHINA_METRO_CITIES

/** 默认城市（杭州） */
export const DEFAULT_CITY: CityMeta =
  CITIES.find((c) => c.adcode === '3301') || CITIES[0]

/** 将城市按省份分组，省份按拼音排序、省内城市按拼音排序。 */
export function groupCitiesByProvince(cities: CityMeta[] = CITIES): Array<{
  province: string
  provinceEn: string
  cities: CityMeta[]
}> {
  const map = new Map<string, CityMeta[]>()
  for (const c of cities) {
    const arr = map.get(c.province) || []
    arr.push(c)
    map.set(c.province, arr)
  }
  return Array.from(map.entries())
    .map(([province, list]) => ({
      province,
      provinceEn: (list[0]?.provinceEn ?? province).toLowerCase(),
      cities: list.sort((a, b) => a.en.localeCompare(b.en)),
    }))
    .sort((a, b) => a.provinceEn.localeCompare(b.provinceEn))
}

/** 出行方式策略 */
export type Policy = 'SUBWAY' | 'BUS' | 'SUBWAY,BUS'

export const POLICY_OPTIONS: Array<{ value: Policy; label: string; desc: string }> = [
  { value: 'SUBWAY', label: '地铁', desc: '仅地铁出行' },
  { value: 'BUS', label: '公交', desc: '仅公交出行' },
  { value: 'SUBWAY,BUS', label: '地铁+公交', desc: '地铁与公交换乘（默认）' },
]

/** 可达圈时间范围（分钟）。纯地铁网络覆盖最长 180；高德等时圈上限 60。 */
export const TIME_MIN = 1
export const TIME_MAX = 180
export const DEFAULT_TIME = 30

/** 最大同时对比起点数 */
export const MAX_POINTS = 3

/** 可选 / 默认的等时圈颜色（按起点索引取色） */
export const RESULT_COLORS = [
  '#0096FF',
  '#FF7A00',
  '#00C48C',
  '#E64980',
  '#9C36B5',
  '#F59F00',
]

/** 可达圈多边形默认样式 */
export const POLYGON_FILL_OPACITY = 0.22
export const POLYGON_STROKE_WEIGHT = 2
export const POLYGON_STROKE_OPACITY = 0.85
