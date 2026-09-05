/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 高德地图 JS API Key（Web端），留空则进入演示模式 */
  readonly VITE_AMAP_KEY?: string
  readonly VITE_AMAP_SECURITY_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// 高德地铁图 JS API 注入的全局构造器
interface AMapSubwayConstructor {
  new (
    container: string | HTMLElement,
    options: {
      adcode: string
      theme?: string
      easy?: boolean
    },
  ): AMapSubwayInstance
}

interface AMapSubwayInstance {
  getCityList(cb: (list: Record<string, { cn: string; en: string }>) => void): void
  getLineList(cb: (list: unknown[]) => void): void
  getNearStation(opts: { lnglat: string }, cb: (stationId: string | false) => void): void
  addMarker(name: string, opts?: Record<string, unknown>): void
  addInfoWindow(name: string, opts?: Record<string, unknown>): void
  route(from: string, to: string, opts?: Record<string, unknown>): void
  event: {
    on(type: string, handler: (e: unknown) => void): void
  }
  destroy(): void
}

declare global {
  var Subway: AMapSubwayConstructor | undefined
}
