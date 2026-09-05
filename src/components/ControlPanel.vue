<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import { POLICY_OPTIONS, TIME_MIN, TIME_MAX, MAX_POINTS, RESULT_COLORS } from '@/config'
import { runtime } from '@/engine'
import { computeAll } from '@/composables/useArrival'
import type { PlaceCandidate } from '@/types'

const store = useAppStore()

function colorFor(id: string): string {
  const i = store.points.findIndex((p) => p.id === id)
  return RESULT_COLORS[(i < 0 ? 0 : i) % RESULT_COLORS.length]
}

const keyword = ref('')
const suggestions = ref<PlaceCandidate[]>([])
const showSug = ref(false)
let debounceTimer: number | undefined
let activeIndex = ref(-1)

const policyLabel = computed(
  () => POLICY_OPTIONS.find((p) => p.value === store.currentPolicy)?.label || store.currentPolicy,
)

function onKeywordChange(): void {
  showSug.value = keyword.value.trim().length > 0
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => runSearch(), 240)
}

async function runSearch(): Promise<void> {
  const kw = keyword.value.trim()
  if (!kw) {
    suggestions.value = []
    return
  }
  const local = await store.searchStationsLocal(kw)
  const merged: PlaceCandidate[] = [...local]

  if (store.mode === 'real' && runtime.AMap) {
    try {
      const AMap = runtime.AMap
      const placeSearch = new AMap.PlaceSearch({ city: store.city.adcode, pageSize: 8, citylimit: true })
      const pois = await new Promise<PlaceCandidate[]>((resolve) => {
        placeSearch.search(kw, (status: string, result: any) => {
          if (status === 'complete' && result?.poiList?.pois) {
            resolve(
              result.poiList.pois.map((p: any) => ({
                name: p.name,
                lnglat: [+p.location.lng, +p.location.lat],
                address: p.address,
                type: 'poi' as const,
              })),
            )
          } else {
            resolve([])
          }
        })
      })
      merged.push(...pois)
    } catch {
      /* 忽略搜索失败 */
    }
  }

  // 去重（按名称+坐标）
  const seen = new Set<string>()
  suggestions.value = merged.filter((s) => {
    const key = `${s.name}|${s.lnglat[0].toFixed(5)},${s.lnglat[1].toFixed(5)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  activeIndex.value = -1
}

function selectCandidate(c: PlaceCandidate): void {
  // 选中后把名称回填到输入框，便于用户确认或继续修改
  keyword.value = c.name
  suggestions.value = []
  showSug.value = false
  store.addPoint(c.name, c.lnglat, c.type === 'station')
}

function onEnter(): void {
  if (activeIndex.value >= 0 && suggestions.value[activeIndex.value]) {
    selectCandidate(suggestions.value[activeIndex.value])
  } else if (suggestions.value.length === 1) {
    selectCandidate(suggestions.value[0])
  }
}

function onArrow(step: number): void {
  if (!suggestions.value.length) return
  activeIndex.value =
    (activeIndex.value + step + suggestions.value.length) % suggestions.value.length
}

function hideSug(): void {
  window.setTimeout(() => {
    showSug.value = false
  }, 150)
}

function typeLabel(t?: string): string {
  if (t === 'station') return '地铁站'
  if (t === 'poi') return '地点'
  return '地址'
}

onMounted(() => {
  if (store.mode === 'real') void store.loadStations()
})

onBeforeUnmount(() => window.clearTimeout(debounceTimer))
</script>

<template>
  <aside class="panel">
    <!-- 起点搜索 -->
    <section class="block">
      <h3 class="block-title">起点</h3>
      <div class="search-box">
        <div class="search-input-wrap">
          <input
            v-model="keyword"
            class="search-input"
            placeholder="输入地址 / 地铁站点 / POI"
            @input="onKeywordChange"
            @focus="showSug = keyword.trim().length > 0"
            @blur="hideSug"
            @keydown.enter.prevent="onEnter"
            @keydown.up.prevent="onArrow(-1)"
            @keydown.down.prevent="onArrow(1)"
          />
          <span v-if="keyword" class="clear-x" @mousedown.prevent="keyword = ''; suggestions = []; showSug = false">✕</span>
        </div>
        <button class="btn btn-primary search-btn" @click="onKeywordChange">搜索</button>
        <!-- 下拉联想 -->
        <ul v-if="showSug && suggestions.length" class="sug-list">
          <li
            v-for="(s, i) in suggestions"
            :key="i"
            :class="['sug-item', { active: i === activeIndex }]"
            @mousedown.prevent="selectCandidate(s)"
          >
            <span class="sug-type">{{ typeLabel(s.type) }}</span>
            <span class="sug-name">{{ s.name }}</span>
            <span v-if="s.address" class="sug-addr">{{ s.address }}</span>
          </li>
        </ul>
        <div v-else-if="showSug && keyword" class="sug-empty">未找到匹配结果</div>
      </div>
      <p class="hint">也可直接点击地图拾取起点</p>
    </section>

    <!-- 出行方式 -->
    <section class="block">
      <h3 class="block-title">出行方式</h3>
      <div class="policy-group">
        <label
          v-for="p in POLICY_OPTIONS"
          :key="p.value"
          class="policy"
          :class="{ active: store.currentPolicy === p.value }"
        >
          <input
            type="radio"
            name="policy"
            :value="p.value"
            v-model="store.currentPolicy"
            hidden
          />
          <span class="radio-dot"></span>
          <span class="policy-text">
            <strong>{{ p.label }}</strong>
            <em>{{ p.desc }}</em>
          </span>
        </label>
      </div>
      <p class="policy-note" :class="{ warn: store.currentPolicy === 'SUBWAY' }">
        {{ store.currentPolicy === 'SUBWAY'
          ? '仅地铁模式的等时圈偏保守：只计步行+地铁，且地铁图数据可能不含部分郊区/城际线路，结果常明显偏小。建议使用「地铁+公交」获得更完整覆盖。'
          : '地铁+公交 覆盖最广；仅公交 仅按公交线路计算。' }}
      </p>
    </section>

    <!-- 出行时间 -->
    <section class="block">
      <div class="block-title-row">
        <h3 class="block-title">出行时间</h3>
        <span class="time-value">{{ store.currentTime }} 分钟</span>
      </div>
      <input
        type="range"
        class="time-slider"
        :min="TIME_MIN"
        :max="TIME_MAX"
        step="1"
        v-model.number="store.currentTime"
      />
      <div class="slider-scale">
        <span>{{ TIME_MIN }} 分</span>
        <span>60 分</span>
      </div>
    </section>

    <!-- 查询 -->
    <section class="block">
      <button
        class="btn btn-primary block-btn"
        :disabled="store.computing"
        @click="computeAll"
      >
        <span v-if="store.computing" class="spinner"></span>
        {{ store.computing ? '计算中…' : '查询可达圈' }}
      </button>
      <button class="btn block-btn" @click="store.clearAll">清空</button>
    </section>

    <!-- 已选起点 -->
    <section class="block">
      <div class="block-title-row">
        <h3 class="block-title">已选起点（{{ store.points.length }}/{{ MAX_POINTS }}）</h3>
      </div>
      <ul v-if="store.points.length" class="point-list">
        <li
          v-for="(p, i) in store.points"
          :key="p.id"
          :class="['point-item', { active: store.selectedPointId === p.id }]"
          @click="store.selectPoint(p.id)"
        >
          <span class="point-badge" :style="{ background: colorFor(p.id) }">{{ i + 1 }}</span>
          <span class="point-name" :title="p.name">{{ p.name }}</span>
          <span v-if="p.fromStation" class="station-tag">地铁站</span>
          <button class="point-del" title="删除" @click.stop="store.removePoint(p.id)">✕</button>
        </li>
      </ul>
      <p v-else class="hint">暂无起点，可搜索或点击地图添加</p>
    </section>

    <!-- 多起点交集 -->
    <section class="block" v-if="store.points.length >= 2">
      <label class="toggle-row">
        <input type="checkbox" v-model="store.showIntersection" />
        <span>显示多起点可达圈交集（黄色）</span>
      </label>
    </section>
  </aside>
</template>

<style scoped>
/* 面板已由全局布局控制，此处仅剪贴内部样式 */
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.block-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.3px;
}
.block-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.time-value {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}
.search-box {
  position: relative;
}
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d3dae4;
  border-radius: 9px;
  padding: 9px 30px 9px 11px;
  font-size: 14px;
  background: #fff;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: #2563eb;
}
.clear-x {
  position: absolute;
  right: 8px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 13px;
  padding: 2px;
}
.sug-list {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
  max-height: 260px;
  overflow: auto;
  padding: 4px;
}
.sug-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 9px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
}
.sug-item:hover,
.sug-item.active {
  background: #eff6ff;
}
.sug-type {
  flex: none;
  font-size: 11px;
  color: #2563eb;
  background: #eff6ff;
  border-radius: 5px;
  padding: 2px 6px;
}
.sug-name {
  color: #0f172a;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sug-addr {
  margin-left: auto;
  color: #94a3b8;
  font-size: 11px;
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sug-empty {
  padding: 10px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}
.policy-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.policy {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #dde3ec;
  border-radius: 10px;
  padding: 9px 11px;
  cursor: pointer;
  transition: 0.15s;
}
.policy.active {
  border-color: #2563eb;
  background: #eff6ff;
}
.radio-dot {
  flex: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  position: relative;
}
.policy.active .radio-dot {
  border-color: #2563eb;
}
.policy.active .radio-dot::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: #2563eb;
}
.policy-text {
  display: flex;
  flex-direction: column;
}
.policy-text strong {
  font-size: 13.5px;
  color: #0f172a;
}
.policy-text em {
  font-style: normal;
  font-size: 11.5px;
  color: #64748b;
}
.policy-note {
  margin: 2px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
}
.policy-note.warn {
  color: #b45309;
  background: #fef3c7;
}
.time-slider {
  width: 100%;
  accent-color: #2563eb;
  cursor: pointer;
}
.slider-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}
.btn {
  border: none;
  border-radius: 9px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s;
}
.btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn:not(.btn-primary) {
  background: #eef2f7;
  color: #334155;
}
.btn:not(.btn-primary):hover {
  background: #e2e8f0;
}
.block-btn {
  width: 100%;
}
.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.hint {
  margin: 0;
  font-size: 11.5px;
  color: #94a3b8;
}
.point-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.point-item {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 8px 9px;
  cursor: pointer;
  background: #fff;
}
.point-item.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}
.point-badge {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.point-name {
  flex: 1;
  font-size: 13px;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.station-tag {
  flex: none;
  font-size: 10px;
  color: #7c3aed;
  background: #f3e8ff;
  border-radius: 5px;
  padding: 2px 5px;
}
.point-del {
  flex: none;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 13px;
  padding: 3px 4px;
  border-radius: 5px;
}
.point-del:hover {
  color: #ef4444;
  background: #fee2e2;
}
.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
}
.toggle-row input {
  accent-color: #2563eb;
  width: 16px;
  height: 16px;
}
</style>
