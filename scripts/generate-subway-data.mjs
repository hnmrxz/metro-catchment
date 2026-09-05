// 生成各城市地铁站点数据，写入 public/data/subway/stations-<adcode>.json
// 运行：node scripts/generate-subway-data.mjs
// 说明：高德地铁数据源 https://map.amap.com/service/subway?&srhdata=<adcode>_drw_<en>.json
//       该端点在浏览器端受 CORS 限制，这里在 Node 侧抓取并落盘为同源静态数据。
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const cities = [
  ['1100', 'beijing'], ['1200', 'tianjin'], ['3100', 'shanghai'], ['5000', 'chongqing'],
  ['1301', 'shijiazhuang'], ['1401', 'taiyuan'], ['1501', 'huhehaote'],
  ['2101', 'shenyang'], ['2102', 'dalian'], ['2201', 'changchun'], ['2301', 'haerbin'],
  ['3201', 'nanjing'], ['3202', 'wuxi'], ['3203', 'xuzhou'], ['3204', 'changzhou'],
  ['3205', 'suzhou'], ['3206', 'nantong'],
  ['3301', 'hangzhou'], ['3302', 'ningbo'], ['3303', 'wenzhou'], ['3306', 'shaoxing'],
  ['3307', 'jinhua'], ['3310', 'taizhou'],
  ['3401', 'hefei'], ['3402', 'wuhu'], ['3501', 'fuzhou'], ['3502', 'xiamen'], ['3601', 'nanchang'],
  ['3701', 'jinan'], ['3702', 'qingdao'], ['4101', 'zhengzhou'], ['4103', 'luoyang'],
  ['4201', 'wuhan'], ['4301', 'changsha'],
  ['4401', 'guangzhou'], ['4403', 'shenzhen'], ['4406', 'foshan'], ['4419', 'dongguan'],
  ['4501', 'nanning'], ['5101', 'chengdu'], ['5201', 'guiyang'], ['5301', 'kunming'],
  ['6101', 'xian'], ['6201', 'lanzhou'], ['6501', 'wulumuqi'],
]

const OUT = new URL('../public/data/subway/', import.meta.url)

function normalize(data, adcode) {
  const lines = Array.isArray(data?.l) ? data.l : []
  const map = new Map()
  for (const line of lines) {
    const lineName = String(line?.kn ?? '').trim()
    const sts = Array.isArray(line?.st) ? line.st : []
    for (const st of sts) {
      const name = String(st?.n ?? '').trim()
      const sl = String(st?.sl ?? '')
      const parts = sl.split(',')
      const lng = Number(parts[0])
      const lat = Number(parts[1])
      if (!name || !Number.isFinite(lng) || !Number.isFinite(lat)) continue
      const key = `${name}|${lng}|${lat}`
      const exist = map.get(key)
      if (exist) {
        if (lineName && !exist.lineNames.includes(lineName)) exist.lineNames.push(lineName)
      } else {
        map.set(key, {
          id: String(st?.poiid ?? `${adcode}:${name}`),
          name,
          lng,
          lat,
          lineNames: lineName ? [lineName] : [],
        })
      }
    }
  }
  return Array.from(map.values())
}

async function fetchCity(adcode, en) {
  const url = `https://map.amap.com/service/subway?&srhdata=${adcode}_drw_${en}.json`
  const r = await fetch(url, { headers: { Referer: 'http://map.amap.com/' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${en}`)
  const data = await r.json()
  return normalize(data, adcode)
}

let ok = 0
let fail = []
async function run() {
  await mkdir(OUT, { recursive: true })
  const limit = 6
  let i = 0
  async function worker() {
    while (i < cities.length) {
      const idx = i++
      const [adcode, en] = cities[idx]
      try {
        const stations = await fetchCity(adcode, en)
        const file = new URL(`stations-${adcode}.json`, OUT)
        await writeFile(file, JSON.stringify({ adcode, count: stations.length, stations }))
        console.log(`OK ${adcode} ${en} -> ${stations.length} stations`)
        ok++
      } catch (e) {
        console.log(`FAIL ${adcode} ${en} -> ${e.message}`)
        fail.push(`${adcode}:${en}`)
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()))
  console.log(`\nDone. ok=${ok} fail=${fail.length} ${fail.join(',')}`)
}
run()
