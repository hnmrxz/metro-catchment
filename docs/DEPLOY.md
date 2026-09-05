# 部署文档

本文说明如何将「地铁可达圈」应用构建并部署到静态站点托管（也可用于私有服务器 / Docker）。

## 一、构建前准备

1. 在高德开放平台申请 **「Web端(JS API)」** Key。
2. 如需对 Web 请求加签，同时获取 **服务端安全密钥**（`securityJsCode`）。
3. 在项目根目录确认 `.env` 存在（该文件不参与版本控制）。

```bash
# .env
VITE_AMAP_KEY=你的Key
VITE_AMAP_SECURITY_CODE=你的安全密钥   # 可选
```

## 二、构建产物

```bash
pnpm install
pnpm build      # 生成 dist/
pnpm preview    # 本地预览 dist/
```

构建成功后会生成 `dist/`，包含 `index.html`、打包后的 JS/CSS 等静态资源。

> `VITE_AMAP_KEY` 等在构建时写入静态产物，因此不同环境需重新构建。

## 三、部署到静态托管

### Nginx（推荐）

```nginx
server {
  listen 80;
  server_name metro.example.com;

  root /var/www/metro-catchment/dist;
  index index.html;

  # SPA 路由回退（若使用 hash 路由可省略）
  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
```

### 其它静态托管

- **Vercel**：构建命令 `pnpm build`，输出目录 `dist`。
- **Netlify**：构建命令 `pnpm build`，发布目录 `dist`。
- **GitHub Pages**：构建后把 `dist/` 内容作为站点根目录。

### Docker

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## 四、关键配置说明

| 环境变量 | 说明 | 是否必填 |
|----------|------|---------|
| `VITE_AMAP_KEY` | 高德 Web 端 JS API Key | 必填（留空则为演示模式） |
| `VITE_AMAP_SECURITY_CODE` | 服务端安全密钥 | 选填 |

## 五、上线检查清单

- [ ] `.env` 已配置真实 Key，且未提交到 Git。
- [ ] 确认 Key 平台类型为「Web端(JS API)」，且在控制台开启了域名白名单（如启用）。
- [ ] 确认默认城市中心点正确（`src/config.ts`）。
- [ ] 站点使用 HTTPS（高德插件在当前环境通常建议 HTTPS）。
- [ ] 验证：添加起点 → 查询 → 多边形渲染 → 多起点交集。
