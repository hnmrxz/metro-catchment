/** 应用通用类型定义 */

/** 起点 */
export interface Point {
  id: string
  /** 展示名称 */
  name: string
  /** 经纬度 [lng, lat] */
  lnglat: [number, number]
  /** 是否来自地铁站点 */
  fromStation?: boolean
}

/** 单个等时圈（可达范围）结果 */
export interface ArrivalRangeResult {
  point: Point
  time: number
  policy: string
  /** 多边形路径数组（每个多边形为坐标环） */
  bounds: Array<Array<[number, number]>>
  /** 带样式的颜色 */
  color: string
  /** 状态：complete 成功 / empty 空 / error 失败 */
  status: 'pending' | 'complete' | 'empty' | 'error'
  /** 错误信息（status 为 error 时） */
  message?: string
  /** 覆盖物实例（真实地图时为 AMap.Polygon[]，演示模式为内部句柄），由渲染层维护 */
  overlays?: unknown[]
}

/** 地图拾取或搜索到的候选结果 */
export interface PlaceCandidate {
  name: string
  lnglat: [number, number]
  address?: string
  type?: 'addr' | 'poi' | 'station'
}

/** 演示模式下生成的多边形（用 turf 表示） */
export interface GeoPolyline {
  id: string
  color: string
  name: string
}
