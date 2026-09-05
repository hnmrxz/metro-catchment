import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base：GitHub Pages 项目子路径（如 /metro-catchment/）通过环境变量注入；
// 本地开发默认 '/'。
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  plugins: [vue()],
  base,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  // 让 Vite 预打包 amap-jsapi-loader（CJS→ESM），避免动态 import 时默认导出缺失
  optimizeDeps: {
    include: ['@amap/amap-jsapi-loader'],
  },
})
