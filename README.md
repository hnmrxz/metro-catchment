# 🚇 地铁可达圈（等时圈）Web 应用

基于 **高德地图 JS API 2.0** 的出行等时圈分析工具：点击地图或搜索选取起点，系统自动计算在设定的时间内，通过 **地铁 / 公交 / 地铁+公交** 能够到达的区域（i.e. 可达圈 / 等时圈），并在地图上以彩色多边形渲染。支持多起点对比与交集高亮。

- **默认城市**：杭州（可切换北京 / 上海 / 广州 / 深圳）
- **默认出行方式**：地铁 + 公交（`SUBWAY,BUS`）
- **默认出行时间**：30 分钟（1–60 分钟可调）
- **可同时对比起点**：最多 3 个

## ✨ 功能

| 模块 | 说明 |
|------|------|
| 地图展示 | 高德实时地图，默认中心杭州主城区 |
| 点位拾取 | 点击地图取点 + 逆地理编码 / 搜索地址·地铁站·POI |
| 可达圈计算 | `AMap.ArrivalRange`，按策略计算等时圈 |
| 可视化 | 多边形渲染，不同起点不同颜色，自动视野适配 |
| 出行方式 | 地铁 / 公交 / 地铁+公交（默认） |
| 时间设置 | 滑块调节 1–60 分钟 |
| 多起点对比 | 最多 3 个起点，可叠加交集(turf)高亮 |
| 演示模式 | 未配置 Key 时用模拟等时圈预览全流程 |

## 🛠 技术栈

- **框架**：Vue 3（Composition API） + Vite + TypeScript
- **状态**：Pinia
- **地图**：高德地图 JS API 2.0（`@amap/amap-jsapi-loader`）+ 地铁图 JS API 1.0
- **几何**：turf.js（交集 / 并集计算）

> 注：`AMap.ArrivalRange` 出行耗时最大支持 **60 分钟**，超时会报错；该接口存在 QPS 限制，本项目按顺序串行调用以降低频率。

## 🚀 快速开始

### 1. 配置高德 Key

复制 `.env.example` 为 `.env`，填入你申请的 **「Web端(JS API)」** 类型 Key：

```bash
cp .env.example .env
```

```bash
# .env
VITE_AMAP_KEY=你的高德Web端JS API Key
# 若在控制台开启了「服务端安全密钥」，请一并填入
VITE_AMAP_SECURITY_CODE=你的安全密钥
```

> Key 申请：[高德开放平台](https://lbs.amap.com/) → 控制台 → 应用管理 → 创建应用 → 选择「Web端(JS API)」。

### 2. 安装依赖

```bash
pnpm install
# 或 npm install
```

### 3. 本地开发

```bash
pnpm dev
```

打开 `http://localhost:5173`。

### 4. 生产构建

```bash
pnpm build
pnpm preview
```

> `pnpm build` 会先执行 `vue-tsc -b` 做类型检查。

### 无 Key 预览（演示模式）

若 `.env` 的 `VITE_AMAP_KEY` 为空，应用自动进入 **演示模式**：使用本地生成的模拟等时圈多边形展示全部 UI 与交互，方便在接入真实 Key 前预览。填入 Key 后即自动使用真实地图。

### 深链接 / 快速演示

支持通过 URL 参数自动添加起点并计算，便于分享与演示：

```
# 添加一个起点并自动计算
http://localhost:5173/?point=120.15,30.25&run=1

# 多个起点 + 显示交集
http://localhost:5173/?point=120.13,30.25&point=120.17,30.24&run=1&intersect=1
```

- `point=lng,lat`：添加起点（可重复传入）。
- `run=1`：自动执行「查询可达圈」。
- `intersect=1`：自动开启多起点交集高亮。

> 注：高德的 `VITE_AMAP_KEY` 等环境变量，**运行环境（进程环境变量）优先于 `.env` 文件**。若终端已有同名变量，会覆盖 `.env` 中的配置。

## 📁 目录结构

```
metro-catchment/
├─ .env.example            # 配置模板
├─ .npmrc                  # registry / 网络设置
├─ index.html
├─ vite.config.ts
├─ tsconfig*.json
├─ docs/
│  ├─ DEPLOY.md            # 部署文档
│  └─ USER_GUIDE.md        # 用户使用说明
└─ src/
   ├─ main.ts / App.vue
   ├─ config.ts            # 默认城市/策略/颜色等
   ├─ types.ts             # 类型定义
   ├─ engine.ts            # 真实地图与演示画布渲染
   ├─ amap/
   │  ├─ loader.ts         # AMapLoader 封装 + 地铁图加载
   │  ├─ arrival.ts        # ArrivalRange 封装
   │  ├─ subway.ts         # 地铁线路/站点获取与检索
   │  └─ mockIsochrone.ts  # 演示等时圈生成器
   ├─ composables/
   │  └─ useArrival.ts     # 可达圈计算协调
   ├─ stores/
   │  └─ useAppStore.ts    # Pinia 状态
   ├─ utils/
   │  └─ isochroneGeometry.ts  # turf 交集/并集
   ├─ styles/global.css
   └─ components/
      ├─ MapView.vue       # 地图 + 覆盖物渲染
      ├─ ControlPanel.vue  # 搜索/方式/时间/起点列表
      └─ Legend.vue        # 图例
```

## ⚠️ 注意事项

- 高德地图 **Key 请勿提交到代码仓库**（已在 `.gitignore` 中忽略 `.env`）。
- 地铁图 JS API 目前为 **Beta** 版本，站点数据结构可能随官方更新变化，本项目已做防御式归一化。
- 若地铁图不显示，请检查 `adcode` 是否正确（见 `src/config.ts` 的 `CITIES`）。
- 移动端适配已内置（面板可收起），如需地铁图示意等额外功能可启用 `src/amap/subway.ts` 的扩展。

## 📚 参考资料

- 高德开放平台：https://lbs.amap.com/
- JS API 2.0 文档：https://developer.amap.com/api/javascript-api/
- 地铁图 JS API 文档：https://developer.amap.com/api/subway-api/subway-summary/
- 可达圈（等时圈）接口：https://lbs.amap.com/api/me-api/documents/other/other/isochrone
