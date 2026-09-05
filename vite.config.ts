import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
