/**
 * 运行时常量/上下文：
 *  - mode: 'real'（用真实高德 key）| 'demo'（无 key 演示模式）
 *  - AMap / map: 高德命名空间与地图实例（仅 real 模式存在）
 * 渲染函数同时供真实地图与演示画布使用。
 */
import type { ArrivalRangeResult, MetroCoverageResult, Point } from './types'
import { RESULT_COLORS, POLYGON_FILL_OPACITY, POLYGON_STROKE_WEIGHT, POLYGON_STROKE_OPACITY } from './config'
import type { AMapNamespace } from './amap/loader'

export type MapMode = 'real' | 'demo'

export const runtime: {
  mode: MapMode
  AMap: AMapNamespace | null
  map: any | null
} = {
  mode: 'demo',
  AMap: null,
  map: null,
}

/** 每个起点对应的可见颜色（按起点索引） */
export function colorForPoint(points: Point[], id: string): string {
  const idx = points.findIndex((p) => p.id === id)
  return RESULT_COLORS[(idx < 0 ? 0 : idx) % RESULT_COLORS.length]
}

/** 起点编号（1 起） */
export function pointIndex(points: Point[], id: string): number {
  const idx = points.findIndex((p) => p.id === id)
  return idx < 0 ? 1 : idx + 1
}

/** 真实地图：绘制/刷新可达圈多边形 */
export function drawRealResults(
  AMap: AMapNamespace,
  map: any,
  results: ArrivalRangeResult[],
  overlays: Map<string, any[]>,
): void {
  for (const [, arr] of overlays) {
    if (arr.length && map && map.remove) map.remove(arr)
  }
  overlays.clear()

  for (const r of results) {
    const list: any[] = []
    for (const bound of r.bounds) {
      const polygon = new AMap.Polygon({
        path: bound.map((p) => new AMap.LngLat(p[0], p[1])),
        fillColor: r.color,
        fillOpacity: POLYGON_FILL_OPACITY,
        strokeColor: r.color,
        strokeWeight: POLYGON_STROKE_WEIGHT,
        strokeOpacity: POLYGON_STROKE_OPACITY,
        bubble: true,
        extData: { resultId: r.point.id },
      })
      list.push(polygon)
    }
    if (list.length && map.add) map.add(list)
    overlays.set(r.point.id, list)
  }
}

/** 真实地图：绘制/刷新起点标记 */
export function drawRealPoints(
  map: any,
  points: Point[],
  markers: Map<string, any>,
  selectedId: string | null,
): void {
  for (const [, m] of markers) {
    if (m && typeof m.setMap === 'function') m.setMap(null)
  }
  markers.clear()

  for (const p of points) {
    const color = colorForPoint(points, p.id)
    const marker = new runtime.AMap!.Marker({
      position: [p.lnglat[0], p.lnglat[1]],
      anchor: 'bottom-center',
      content: buildMarkerHtml(p.name, color, p.id === selectedId),
      extData: { pointId: p.id },
      zIndex: 220,
    })
    marker.setMap(map)
    markers.set(p.id, marker)
  }
}

export function buildMarkerHtml(name: string, color: string, active: boolean): string {
  const ring = active ? 'box-shadow:0 0 0 6px rgba(255,122,0,0.25);' : ''
  return `<div style="
      transform:translate(-50%,-100%);
      display:flex;flex-direction:column;align-items:center;
      cursor:pointer;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.28));
    ">
      <div style="
        background:#fff;color:#1f2937;border:2px solid ${color};
        border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;
        white-space:nowrap;${ring}
      ">${name}</div>
      <div style="
        width:16px;height:16px;margin-top:4px;border-radius:50%;
        background:${color};border:3px solid #fff;${ring}
      "></div>
    </div>`
}

/** 真实地图：构建地铁网络覆盖（可达区段折线 + 站点圆点）的覆盖物。 */
export function buildRealMetroOverlays(
  AMap: any,
  coverage: MetroCoverageResult,
  color: string,
): any[] {
  const overlays: any[] = []
  for (const edge of coverage.edges) {
    const pl = new AMap.Polyline({
      path: [
        new AMap.LngLat(edge.from[0], edge.from[1]),
        new AMap.LngLat(edge.to[0], edge.to[1]),
      ],
      strokeColor: color,
      strokeWeight: 4,
      strokeOpacity: 0.92,
      lineJoin: 'round',
      zIndex: 150,
    })
    overlays.push(pl)
  }
  for (const st of coverage.reachable) {
    const mk = new AMap.Marker({
      position: [st.lnglat[0], st.lnglat[1]],
      title: `${st.name} · ${Math.round(st.minutes)} 分钟`,
      content: `<div style="width:8px;height:8px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.35);"></div>`,
      zIndex: 160,
      extData: { kind: 'metro-station' },
    })
    overlays.push(mk)
  }
  return overlays
}

/* ========================= 演示模式画布 ========================= */

interface DemoShape {
  type: 'point' | 'polygon'
  color: string
  label?: string
  ring?: [number, number][]
  center?: [number, number]
  selected?: boolean
}

/** 演示画布：像素坐标投影（相对中心，按比例缩放） */
export function drawDemo(
  canvas: HTMLCanvasElement,
  results: ArrivalRangeResult[],
  points: Point[],
  selectedId: string | null,
  intersection: Array<Array<[number, number]>> = [],
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 800
  const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 600
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  // 收集所有用于定标的坐标
  const all: Array<[number, number]> = []
  for (const p of points) all.push(p.lnglat)
  for (const r of results) for (const b of r.bounds) all.push(...b)
  for (const b of intersection) all.push(...b)
  if (all.length === 0) {
    drawEmptyHint(ctx, cssW, cssH)
    return
  }

  // 计算 lng/lat 范围并投影到画布（留边距）
  const pad = 60
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of all) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  const spanLng = Math.max(maxLng - minLng, 1e-4)
  const spanLat = Math.max(maxLat - minLat, 1e-4)
  // 拉伸以填满画布
  const sx = (cssW - pad * 2) / spanLng
  const sy = (cssH - pad * 2) / spanLat
  const scale = Math.min(sx, sy)
  const ox = (cssW - spanLng * scale) / 2
  const oy = (cssH - spanLat * scale) / 2
  const px = (lng: number) => ox + (lng - minLng) * scale
  const py = (lat: number) => cssH - (oy + (lat - minLat) * scale)

  // 绘制坐标网格
  const gridStep = Math.max(spanLng, spanLat) / 6
  ctx.strokeStyle = 'rgba(100,116,139,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 6; i++) {
    const gx = ox + (i / 6) * spanLng * scale
    const gy = cssH - (oy + (i / 6) * spanLat * scale)
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, cssH)
    ctx.moveTo(0, gy)
    ctx.lineTo(cssW, gy)
    ctx.stroke()
  }

  // 绘制可达圈多边形
  for (const r of results) {
    for (const bound of r.bounds) {
      if (bound.length < 3) continue
      ctx.beginPath()
      bound.forEach(([lng, lat], i) => {
        const x = px(lng)
        const y = py(lat)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fillStyle = hexToRgba(r.color, 0.28)
      ctx.fill()
      ctx.strokeStyle = r.color
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // 绘制地铁网络覆盖（纯地铁模式：可达区段 + 站点）
  for (const r of results) {
    const cov = r.metroCoverage
    if (!cov) continue
    // 可达区段折线
    ctx.strokeStyle = r.color
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    for (const e of cov.edges) {
      ctx.beginPath()
      ctx.moveTo(px(e.from[0]), py(e.from[1]))
      ctx.lineTo(px(e.to[0]), py(e.to[1]))
      ctx.stroke()
    }
    // 可达站点圆点
    for (const st of cov.reachable) {
      const x = px(st.lnglat[0])
      const y = py(st.lnglat[1])
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = r.color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    // 起点站标注
    if (cov.startLnglat) {
      const x = px(cov.startLnglat[0])
      const y = py(cov.startLnglat[1])
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fillStyle = r.color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }

  // 绘制交集（多起点重叠范围，黄色高亮）
  for (const bound of intersection) {
    if (bound.length < 3) continue
    ctx.beginPath()
    bound.forEach(([lng, lat], i) => {
      const x = px(lng)
      const y = py(lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(250, 204, 21, 0.45)'
    ctx.fill()
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // 绘制起点
  points.forEach((p) => {
    const x = px(p.lnglat[0])
    const y = py(p.lnglat[1])
    const color = colorForPoint(points, p.id)
    const selected = p.id === selectedId
    // 外圈
    ctx.beginPath()
    ctx.arc(x, y, selected ? 16 : 13, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.stroke()
    // 标签
    const label = `${pointIndex(points, p.id)}. ${p.name}`
    ctx.font = '12px system-ui, sans-serif'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(17,24,39,0.9)'
    ctx.beginPath()
    ctx.roundRect(x + 14, y - 26, tw + 14, 22, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(label, x + 21, y - 10)
  })
}

function drawEmptyHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(100,116,139,0.4)'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('点击地图或搜索添加起点后，此处将展示等时圈（演示模式）', w / 2, h / 2)
  ctx.textAlign = 'left'
}

function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
