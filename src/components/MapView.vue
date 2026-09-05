<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import { loadAMap } from '@/amap/loader'
import { runtime, drawRealResults, drawRealPoints, drawDemo, buildRealMetroOverlays } from '@/engine'
import { POLYGON_FILL_OPACITY, POLYGON_STROKE_OPACITY } from '@/config'

const store = useAppStore()

const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

// 覆盖物注册表（非响应式）
const polygonMap = new Map<string, any[]>()
const markerMap = new Map<string, any>()
const metroOverlayMap = new Map<string, any[]>()
let intersectionOverlays: any[] = []
let initError = ''
let mapClickHandler: ((e: any) => void) | null = null

const isDemo = () => store.mode === 'demo'

function pickAt(lnglat: [number, number], name?: string): void {
  if (!store.canAddPoint && store.points.length >= 3) return
  if (name) {
    store.addPoint(name, lnglat)
    return
  }
  // 真实模式：逆地理编码获取地址；演示模式：直接命名
  if (runtime.mode === 'real' && runtime.AMap) {
    const geocoder = new runtime.AMap.Geocoder()
    geocoder.getAddress(lnglat, (status: string, result: any) => {
      let label = `(${lnglat[0].toFixed(4)}, ${lnglat[1].toFixed(4)})`
      if (status === 'complete' && result?.regeocode?.formattedAddress) {
        label = result.regeocode.formattedAddress
      }
      store.addPoint(label, lnglat)
    })
  } else {
    store.addPoint(`(点击拾取 ${lnglat[0].toFixed(3)}, ${lnglat[1].toFixed(3)})`, lnglat)
  }
}

/** 供外部（搜索结果）直接添加起点 */
function addCandidate(name: string, lnglat: [number, number]): void {
  store.addPoint(name, lnglat)
}

function initRealMap(): void {
  loadAMap()
    .then((AMap) => {
      runtime.mode = 'real'
      runtime.AMap = AMap
      const map = new AMap.Map(container.value!, {
        zoom: store.city.zoom,
        center: store.city.center,
        viewMode: '2D',
        resizeEnable: true,
      })
      runtime.map = map
      map.addControl(new AMap.Scale())
      if (AMap.ToolBar) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.addControl(new (AMap.ToolBar as any)())
      }
      mapClickHandler = (e: any) => {
        pickAt([e.lnglat.getLng(), e.lnglat.getLat()])
      }
      map.on('click', mapClickHandler)
      fullRedraw()
      void store.loadStations()
    })
    .catch((err: any) => {
      initError = err?.message || '高德地图加载失败'
      // 回退到演示模式
      runtime.mode = 'demo'
      store.mode = 'demo'
      nextTick(() => setupDemoCanvas())
    })
}

function setupDemoCanvas(): void {
  const cv = canvas.value
  if (!cv) return
  runtime.mode = 'demo'
  store.mode = 'demo'
  cv.addEventListener('click', onDemoClick)
  fullRedraw()
}

function onDemoClick(e: MouseEvent): void {
  const cv = canvas.value
  if (!cv) return
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (!w || !h) return
  const relX = e.offsetX / w - 0.5
  const relY = e.offsetY / h - 0.5
  const lng = store.city.center[0] + relX * 0.14
  const lat = store.city.center[1] - relY * 0.11
  pickAt([+lng.toFixed(4), +lat.toFixed(4)])
}

function clearRealOverlays(): void {
  const map = runtime.map
  if (!map) return
  for (const [, arr] of polygonMap) if (arr.length && map.remove) map.remove(arr)
  polygonMap.clear()
  for (const [, m] of markerMap) if (m && typeof m.setMap === 'function') m.setMap(null)
  markerMap.clear()
  for (const [, arr] of metroOverlayMap) if (arr.length && map.remove) map.remove(arr)
  metroOverlayMap.clear()
  if (intersectionOverlays.length && map.remove) map.remove(intersectionOverlays)
  intersectionOverlays = []
}

// 绘制「纯地铁」模式的地铁网络覆盖（可达区段 + 站点）
function drawMetroReal(): void {
  const map = runtime.map
  const AMap = runtime.AMap
  if (!map || !AMap) return
  for (const [, arr] of metroOverlayMap) if (arr.length && map.remove) map.remove(arr)
  metroOverlayMap.clear()
  for (const r of store.results) {
    if (!r.metroCoverage) continue
    const overlays = buildRealMetroOverlays(AMap, r.metroCoverage, r.color)
    if (overlays.length) map.add(overlays)
    metroOverlayMap.set(r.point.id, overlays)
  }
}

function drawIntersectionReal(): void {
  const map = runtime.map
  const AMap = runtime.AMap
  if (!map || !AMap) return
  if (intersectionOverlays.length && map.remove) map.remove(intersectionOverlays)
  intersectionOverlays = []
  if (!store.showIntersection || !store.intersection.length) return
  for (const ring of store.intersection) {
    const poly = new AMap.Polygon({
      path: ring.map((p) => new AMap.LngLat(p[0], p[1])),
      fillColor: '#facc15',
      fillOpacity: 0.45,
      strokeColor: '#eab308',
      strokeWeight: 3,
      strokeStyle: 'dashed',
      strokeOpacity: 0.9,
      zIndex: 300,
      extData: { kind: 'intersection' },
    })
    intersectionOverlays.push(poly)
  }
  if (intersectionOverlays.length) map.add(intersectionOverlays)
}

function fullRedraw(): void {
  if (runtime.mode === 'real' && runtime.map && runtime.AMap) {
    drawRealResults(runtime.AMap, runtime.map, store.results, polygonMap)
    drawRealPoints(runtime.map, store.points, markerMap, store.selectedPointId)
    drawMetroReal()
    drawIntersectionReal()
  } else if (isDemo() && canvas.value) {
    drawDemo(
      canvas.value,
      store.results,
      store.points,
      store.selectedPointId,
      store.showIntersection ? store.intersection : [],
    )
  }
}

function fitView(): void {
  if (runtime.mode === 'real' && runtime.map && runtime.AMap) {
    const all: any[] = []
    for (const [, arr] of polygonMap) all.push(...arr)
    for (const [, m] of markerMap) all.push(m)
    for (const [, arr] of metroOverlayMap) all.push(...arr)
    if (all.length) runtime.map.setFitView(all, false, [60, 60, 60, 60])
    else runtime.map.setZoom(store.city.zoom)
  }
}

watch(
  () => [store.results, store.points, store.selectedPointId, store.showIntersection],
  () => fullRedraw(),
  { deep: true },
)

watch(
  () => store.fitSignal,
  () => fitView(),
)

watch(
  () => store.clearSignal,
  () => {
    if (runtime.mode === 'real') clearRealOverlays()
    fullRedraw()
  },
)

// 城市切换后重新初始化地图中心
watch(
  () => store.city.adcode,
  () => {
    if (runtime.mode === 'real' && runtime.map) {
      runtime.map.setCenter(store.city.center)
      runtime.map.setZoom(store.city.zoom)
      clearRealOverlays()
    }
    fullRedraw()
  },
)

function onResize(): void {
  if (isDemo()) fullRedraw()
}

onMounted(async () => {
  await nextTick()
  if (hasAmapKey()) {
    initRealMap()
  } else {
    store.mode = 'demo'
    setupDemoCanvas()
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (mapClickHandler && runtime.map?.off) runtime.map.off('click', mapClickHandler)
  runtime.map?.destroy?.()
  runtime.map = null
  runtime.AMap = null
})

defineExpose({ pickAt, addCandidate, fitView })

function hasAmapKey(): boolean {
  return Boolean((import.meta.env.VITE_AMAP_KEY || '').trim())
}
</script>

<template>
  <div class="map-wrap">
    <div ref="container" class="map-container" :class="{ demo: isDemo() }">
      <canvas v-if="isDemo()" ref="canvas" class="demo-canvas"></canvas>
    </div>

    <!-- 顶部状态徽标 -->
    <div class="map-ribbon" :class="{ demo: isDemo() }">
      <template v-if="isDemo()">
        <span class="dot amber"></span> 演示模式 · 未配置高德 Key（在 .env 填入后自动使用真实地图）
      </template>
      <template v-else>
        <span class="dot green"></span> {{ store.city.name }} · 高德实时地图
      </template>
    </div>

    <div v-if="initError" class="map-ribbon warn">
      <span class="dot red"></span> {{ initError }}（已自动切换演示模式）
    </div>

    <!-- 操作提示 -->
    <div class="map-hint">
      {{ isDemo() ? '点击画布拾取起点' : '点击地图拾取起点 · 拖动/滚轮缩放' }}
    </div>

    <!-- 坐标显示 -->
    <div class="map-coords" v-if="!isDemo() && runtime.map"></div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #e8edf3;
}
.map-container.demo {
  background: linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 100%);
}
.demo-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
}
.map-ribbon {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12.5px;
  color: #374151;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(6px);
}
.map-ribbon.warn {
  top: 54px;
  display: flex;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.green {
  background: #22c55e;
}
.dot.amber {
  background: #f59e0b;
}
.dot.red {
  background: #ef4444;
}
.map-hint {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 500;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: #475569;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.map-coords {
  display: none;
}
</style>
