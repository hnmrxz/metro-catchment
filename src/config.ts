/**
 * 全局静态配置：默认城市、中心点、可调配参数等。
 * 可通过 .env 的 VITE_* 或运行时环境覆盖部分默认值。
 */

export interface CityMeta {
  adcode: string
  name: string
  /** 地图默认中心 */
  center: [number, number]
  /** 默认缩放级别 */
  zoom: number
}

/** 支持的地铁图城市（adcode 参考）。更多城市可通过 subway.getCityList() 动态获取。 */
export const CITIES: CityMeta[] = [
  { adcode: '3301', name: '杭州', center: [120.15, 30.28], zoom: 12 },
  { adcode: '1100', name: '北京', center: [116.397, 39.904], zoom: 11 },
  { adcode: '3100', name: '上海', center: [121.473, 31.23], zoom: 11 },
  { adcode: '4401', name: '广州', center: [113.264, 23.129], zoom: 11 },
  { adcode: '4403', name: '深圳', center: [114.057, 22.543], zoom: 11 },
]

/** 默认城市 */
export const DEFAULT_CITY: CityMeta = CITIES[0]

/** 出行方式策略 */
export type Policy = 'SUBWAY' | 'BUS' | 'SUBWAY,BUS'

export const POLICY_OPTIONS: Array<{ value: Policy; label: string; desc: string }> = [
  { value: 'SUBWAY', label: '地铁', desc: '仅地铁出行' },
  { value: 'BUS', label: '公交', desc: '仅公交出行' },
  { value: 'SUBWAY,BUS', label: '地铁+公交', desc: '地铁与公交换乘（默认）' },
]

/** 可达圈时间范围（分钟） */
export const TIME_MIN = 1
export const TIME_MAX = 60
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
