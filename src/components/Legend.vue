<script setup lang="ts">
import { useAppStore } from '@/stores/useAppStore'
import { RESULT_COLORS, POLICY_OPTIONS } from '@/config'

const store = useAppStore()

const policyLabel = () =>
  POLICY_OPTIONS.find((p) => p.value === store.currentPolicy)?.label || store.currentPolicy

function truncate(s: string, n = 12): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<template>
  <div class="legend" v-if="store.points.length">
    <span class="legend-title">图例</span>
    <span v-for="(p, i) in store.points" :key="p.id" class="legend-item">
      <span class="chip" :style="{ background: RESULT_COLORS[i % RESULT_COLORS.length] }"></span>
      {{ i + 1 }} · 截取 {{ truncate(p.name) }}
    </span>
    <span v-if="store.showIntersection" class="legend-item">
      <span class="chip chip-int"></span> 多起点交集
    </span>
    <span v-if="store.currentPolicy === 'SUBWAY'" class="legend-item">
      <span class="chip chip-metro"></span> 地铁网络覆盖（站至站可达，≤{{ store.currentTime }} 分钟）
    </span>
    <span v-if="store.currentPolicy === 'SUBWAY,BUS'" class="legend-item">
      <span class="chip chip-metro"></span> 综合：等时圈区域（含公交）＋ 地铁网络覆盖
    </span>
    <span class="legend-meta">{{ store.currentTime }} 分钟 · {{ policyLabel() }}</span>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  font-size: 12px;
  color: #475569;
}
.legend-title {
  font-weight: 700;
  color: #0f172a;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-block;
}
.chip-int {
  background: #facc15;
  border: 2px solid #eab308;
}
.chip-metro {
  background: #22c55e;
}
.legend-meta {
  margin-left: auto;
  color: #64748b;
  font-weight: 500;
}
.truncate {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
