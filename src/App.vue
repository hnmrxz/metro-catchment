<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ControlPanel from '@/components/ControlPanel.vue'
import MapView from '@/components/MapView.vue'
import Legend from '@/components/Legend.vue'
import { useAppStore } from '@/stores/useAppStore'
import { computeAll } from '@/composables/useArrival'
import { runtime } from '@/engine'
import { CITIES, groupCitiesByProvince } from '@/config'

const store = useAppStore()
const showHelp = ref(false)
const showPanel = ref(true)

const cityLabel = computed(() => store.city.name)
// 所有开通轨道交通的城市，按省份分组、拼音排序
const cityGroups = computed(() => groupCitiesByProvince())

function onCityChange(e: Event): void {
  const adcode = (e.target as HTMLSelectElement).value
  const c = CITIES.find((x) => x.adcode === adcode)
  if (c) store.setCity(c)
}

// 深链接：/?point=<lng>,<lat>(&point=...&run=1&intersect=1)
// 自动添加一个或多个起点并计算（可用于分享 / 快速演示 / 交集预览）
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const pts = params.getAll('point')
  if (!pts.length) return
  let added = false
  for (const p of pts) {
    const [lng, lat] = p.split(',').map(Number)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    store.addPoint(`起点 (${lng.toFixed(4)}, ${lat.toFixed(4)})`, [lng, lat])
    added = true
  }
  if (!added) return
  if (params.get('intersect') === '1') store.toggleIntersection()
  const pol = params.get('policy')
  if (pol && (pol === 'SUBWAY' || pol === 'BUS' || pol === 'SUBWAY,BUS')) {
    store.currentPolicy = pol
  }
  const t = Number(params.get('time'))
  if (Number.isFinite(t) && t >= 1 && t <= 180) store.currentTime = t
  if (params.get('run') === '1') {
    // 真实模式需等待地图与插件就绪；演示模式无需等待
    if (store.mode === 'real') {
      const deadline = Date.now() + 8000
      while ((!runtime.map || !runtime.AMap) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 60))
      }
    }
    await computeAll()
  }
})
</script>

<template>
  <div class="app">
    <!-- 顶部导航 -->
    <header class="topbar">
      <div class="brand">
        <span class="brand-logo">🚇</span>
        <span class="brand-name">地铁可达圈</span>
        <span class="brand-sub">等时圈 · 出行范围分析</span>
      </div>
      <div class="topbar-right">
        <label class="city-picker">
          <span class="city-label">城市</span>
          <select class="city-select" :value="store.city.adcode" @change="onCityChange">
            <optgroup v-for="g in cityGroups" :key="g.province" :label="g.province">
              <option v-for="c in g.cities" :key="c.adcode" :value="c.adcode">
                {{ c.province }} · {{ c.name }}
              </option>
            </optgroup>
          </select>
        </label>
        <button class="icon-btn" title="帮助" @click="showHelp = true">?</button>
      </div>
    </header>

    <!-- 主体 -->
    <div class="body">
      <button
        v-if="!showPanel"
        class="panel-toggle"
        @click="showPanel = true"
      >
        ☰ 面板
      </button>
      <transition name="slide">
        <div v-show="showPanel" class="side">
          <button class="side-close" @click="showPanel = false" title="收起面板">×</button>
          <ControlPanel />
        </div>
      </transition>
      <main class="map-area">
        <MapView ref="mapView" />
        <div class="bottom-bar">
          <Legend />
        </div>
      </main>
    </div>

    <!-- 状态栏 -->
    <footer class="statusbar">
      <span v-if="store.statusMessage" class="status-msg">{{ store.statusMessage }}</span>
      <span v-else class="status-idle">
        点击地图 / 搜索选择起点 → 设置出行方式与时间 → 查询可达圈
      </span>
      <span v-if="store.mode === 'demo'" class="status-demo">演示模式</span>
    </footer>

    <!-- 帮助弹窗 -->
    <transition name="fade">
      <div v-if="showHelp" class="modal-mask" @click.self="showHelp = false">
        <div class="modal">
          <h3>使用说明</h3>
          <ol>
            <li>在地图上<b>点击</b>任意位置，或在左侧搜索地址/地铁站点/POI 添加起点。</li>
            <li>选择<b>出行方式</b>（地铁 / 公交 / 地铁+公交）与<b>出行时间</b>（1–60 分钟）。</li>
            <li>点击<b>查询可达圈</b>，系统将绘制在设定时间内可到达的区域。</li>
            <li>可添加最多 3 个起点进行<b>对比</b>，并开启“多起点交集”高亮重叠区域。</li>
            <li>点击起点列表中的某一项可在图中定位、高亮；✕ 删除该起点。</li>
          </ol>
          <p class="modal-note">
            提示：可达圈接口最大支持 60 分钟。当前为
            {{ store.mode === 'real' ? '真实高德数据' : '演示模式（未配置高德 Key）' }}。
          </p>
          <button class="btn" @click="showHelp = false">知道了</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
  overflow: hidden;
}
.topbar {
  height: 56px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: #0f172a;
  color: #fff;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.brand-logo {
  font-size: 20px;
}
.brand-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.brand-sub {
  font-size: 12px;
  color: #94a3b8;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.city-picker {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 5px 10px;
}
.city-label {
  font-size: 12px;
  color: #cbd5e1;
}
.city-select {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.city-select option {
  color: #0f172a;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}
.side {
  width: 330px;
  flex: none;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  padding: 16px 14px 20px;
  position: relative;
  z-index: 10;
}
.side-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: #eef2f7;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: none;
}
.panel-toggle {
  position: absolute;
  z-index: 1000;
  top: 12px;
  left: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  border-radius: 9px;
  padding: 8px 13px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
}
.map-area {
  flex: 1;
  min-width: 0;
  position: relative;
  background: #e8edf3;
}
.bottom-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 400;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid #e2e8f0;
  backdrop-filter: blur(6px);
}
.statusbar {
  height: 34px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
  color: #475569;
}
.status-msg {
  color: #2563eb;
  font-weight: 500;
}
.status-demo {
  margin-left: auto;
  font-size: 11px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 5px;
  padding: 2px 8px;
}
/* 帮助弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  background: #fff;
  border-radius: 14px;
  max-width: 460px;
  width: 100%;
  padding: 22px 24px;
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.3);
}
.modal h3 {
  margin: 0 0 12px;
  color: #0f172a;
}
.modal ol {
  margin: 0 0 14px;
  padding-left: 20px;
  line-height: 1.8;
  color: #334155;
  font-size: 13.5px;
}
.modal-note {
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 14px;
}
.modal .btn {
  border: none;
  border-radius: 9px;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #2563eb;
  color: #fff;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端 */
@media (max-width: 720px) {
  .side {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    box-shadow: 0 0 40px rgba(15, 23, 42, 0.24);
  }
  .side-close {
    display: block;
  }
  .brand-sub {
    display: none;
  }
  .bottom-bar {
    display: none;
  }
}
</style>
