/**
 * 高德地图 JS API 统一加载封装。
 * - 通过 @amap/amap-jsapi-loader 加载主 JS API 2.0。
 * - 额外加载地铁图 JS API（注入全局 Subway 构造器）。
 * - 支持服务端安全密钥（VITE_AMAP_SECURITY_CODE -> window._AMapSecurityConfig）。
 */

export interface AMapNamespace {
  Map: new (container: string | HTMLElement, opts: Record<string, unknown>) => AMapMap
  Geocoder: new (opts?: Record<string, unknown>) => {
    getAddress(
      lnglat: unknown,
      cb: (status: string, result: any) => void,
    ): void
    getLocation(
      address: string,
      cb: (status: string, result: any) => void,
    ): void
  }
  ArrivalRange: new () => {
    search(
      lnglat: unknown,
      time: number,
      cb: (status: string, result: any) => void,
      opts?: Record<string, unknown>,
    ): void
  }
  Scale: new (opts?: Record<string, unknown>) => unknown
  ToolBar?: new (opts?: Record<string, unknown>) => unknown
  PlaceSearch: new (opts?: Record<string, unknown>) => any
  AutoComplete: new (opts?: Record<string, unknown>) => any
  Marker: new (opts: Record<string, unknown>) => any
  PolyEditor?: new (a: any, b?: any) => any
  [key: string]: any
}

interface AMapMap {
  setCenter(c: [number, number] | unknown): void
  setZoom(z: number): void
  setCity(city?: string): void
  add(overlays: unknown[] | unknown): void
  remove(overlays: unknown[] | unknown): void
  clearMap(): void
  clear(): void
  setFitView(overlays?: unknown[] | unknown, immediately?: boolean, avoid?: number[]): void
  getCenter(): { lng: number; lat: number } | [number, number]
  getZoom(): number
  addControl(ctrl: unknown): void
  on(event: string, cb: (e: any) => void): void
  off(event: string, cb: (e: any) => void): void
  destroy(): void
  getContainer(): HTMLElement
}

const KEY = (import.meta.env.VITE_AMAP_KEY || '').trim()
const SECURITY_CODE = (import.meta.env.VITE_AMAP_SECURITY_CODE || '').trim()

/** 是否配置了真实 Key */
export function hasKey(): boolean {
  return Boolean(KEY)
}

let amapPromise: Promise<AMapNamespace> | null = null

async function applySecurityConfig(): Promise<void> {
  if (SECURITY_CODE) {
    ;(window as any)._AMapSecurityConfig = {
      securityJsCode: SECURITY_CODE,
    }
  }
}

/** 加载主 JS API。调用方需确保 hasKey() 为真。 */
export async function loadAMap(): Promise<AMapNamespace> {
  if (amapPromise) return amapPromise

  await applySecurityConfig()

  amapPromise = import('@amap/amap-jsapi-loader').then((mod: any) => {
    // @amap/amap-jsapi-loader 实际是 UMD/CJS 包，在浏览器借 Vite 裸加载时会挂载到
    // window.AMapLoader 而非 ESM default。兼容多种导出形态。
    const loader = [mod?.default, mod?.AMapLoader, mod, (window as any).AMapLoader].find(
      (c) => c && typeof c.load === 'function',
    )
    if (!loader) {
      throw new Error('AMapLoader 未加载成功，请检查 @amap/amap-jsapi-loader 依赖')
    }
    return loader.load({
      key: KEY,
      version: '2.0',
      plugins: [
        'AMap.ArrivalRange',
        'AMap.Geocoder',
        'AMap.Scale',
        'AMap.ToolBar',
        'AMap.PlaceSearch',
        'AMap.AutoComplete',
      ],
    }) as Promise<AMapNamespace>
  })

  return amapPromise
}

let subwayPromise: Promise<void> | null = null

/** 动态加载地铁图 JS API（注入全局 Subway）。需真实 Key。 */
export async function loadSubway(): Promise<void> {
  if (subwayPromise) return subwayPromise
  subwayPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Subway) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/subway?v=1.0&key=${KEY}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('地铁图 JS API 加载失败'))
    document.head.appendChild(script)
  })
  return subwayPromise
}
