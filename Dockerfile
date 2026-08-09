# ─── P4：前端镜像（nginx 静态服务）────────────────────────────
# 阶段1：构建
FROM node:20-alpine AS builder
WORKDIR /app

# 单独装依赖，利用层缓存
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 源码 + 构建
COPY . .
RUN npm run build:nocheck

# 阶段2：运行时（nginx 静态资源）
FROM nginx:1.27-alpine

# 自定义 nginx 配置
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# 静态资源
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]