#!/bin/bash
set -e
echo "=== Project Pulse 更新部署 $(date) ==="

REPO_DIR="/opt/project-pulse-repo"
DEPLOY_DIR="/opt/project-pulse"

# 使用淘宝镜像加速（国内服务器）
NPM_REGISTRY="https://registry.npmmirror.com"
NPM_FLAGS="--registry=$NPM_REGISTRY --fetch-timeout=120000 --fetch-retries=5 --no-audit --no-fund --prefer-offline --loglevel info"

# 0. 确保部署目录存在
mkdir -p "$DEPLOY_DIR"

# 1. 拉取最新代码
echo "[1/7] 拉取最新代码..."
cd "$REPO_DIR"
git checkout -- . 2>/dev/null || true
git clean -fd node_modules 2>/dev/null || true
git pull origin main

# 2. 安装前端依赖
echo "[2/7] 安装前端依赖..."
cd "$REPO_DIR"
rm -f .env.local
rm -rf node_modules
timeout 300 npm install $NPM_FLAGS || {
  echo "❌ 安装超时或失败，清理后重试..."
  rm -rf node_modules package-lock.json
  timeout 300 npm install $NPM_FLAGS
}

# 3. 构建前端
echo "[3/7] 构建前端..."
cd "$REPO_DIR" && npm run build

# 4. 复制前端产物
echo "[4/7] 复制 dist..."
rm -rf "$DEPLOY_DIR/dist"
mkdir -p "$DEPLOY_DIR"
cp -r "$REPO_DIR/dist" "$DEPLOY_DIR/dist"

# 5. 复制 API
echo "[5/7] 复制 api..."
rm -rf "$DEPLOY_DIR/api"
cp -r "$REPO_DIR/deploy/api" "$DEPLOY_DIR/api"

# 6. 安装 API 依赖
echo "[6/7] 安装 API 依赖..."
cd "$DEPLOY_DIR/api"
rm -rf node_modules

timeout 180 npm install --production $NPM_FLAGS || {
  echo "❌ API 安装超时或失败，清理后重试..."
  rm -rf node_modules package-lock.json
  timeout 180 npm install --production $NPM_FLAGS
}

echo "  验证 API 依赖..."
node -e "require('express'); require('cors'); require('multer'); require('uuid')" 2>&1 && echo "  ✓ API 依赖正常" || {
  echo "  ❌ API 依赖加载失败"
  exit 1
}

# 7. 重启服务
echo "[7/7] 重启服务..."

# 停掉旧进程
kill $(lsof -t -i:3080) 2>/dev/null 2>&1 || true
sleep 1

# 加载飞书凭证（从 .env 文件读取，如不存在则忽略）
if [ -f "$DEPLOY_DIR/api/.env" ]; then
  set -a
  source "$DEPLOY_DIR/api/.env"
  set +a
fi

# 确保日志目录存在
mkdir -p /var/log

# 启动 API 服务（飞书凭证通过环境变量传入）
FEISHU_APP_ID="${FEISHU_APP_ID:-}" \
FEISHU_APP_SECRET="${FEISHU_APP_SECRET:-}" \
FEISHU_BASE_TOKEN="${FEISHU_BASE_TOKEN:-KKJ4bGWI1aPDeJsfmRrcnmXBntc}" \
  nohup node server.js > /var/log/pp-api.log 2>&1 &
sleep 3

# 验证
HEALTH=$(curl -s http://localhost:3080/api/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
  echo "=== 完成! API 运行正常 ==="
  echo "=== 存储方式: Feishu Base ==="
else
  echo "=== ⚠️  API 可能未启动成功 ==="
  echo "=== 最近 20 行错误日志 ==="
  tail -20 /var/log/pp-api.log 2>/dev/null || echo "  无日志"
fi
