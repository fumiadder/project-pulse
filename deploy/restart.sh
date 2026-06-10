#!/bin/bash
set -e
echo "=== Project Pulse 更新部署 $(date) ==="

REPO_DIR="/opt/project-pulse-repo"
DEPLOY_DIR="/opt/project-pulse"

# 1. 拉取最新代码
echo "[1/5] 拉取最新代码..."
cd "$REPO_DIR" && git pull origin main

# 2. 构建前端
echo "[2/5] 构建前端..."
cd "$REPO_DIR" && npm run build

# 3. 复制前端产物
echo "[3/5] 复制 dist..."
rm -rf "$DEPLOY_DIR/dist"
cp -r "$REPO_DIR/dist" "$DEPLOY_DIR/dist"

# 4. 复制 API
echo "[4/5] 复制 api..."
rm -rf "$DEPLOY_DIR/api"
mkdir -p "$DEPLOY_DIR/api"
# 复制 server.js, package.json, Dockerfile, migrate.js 等（跳过嵌套的 api 子目录）
for f in "$REPO_DIR"/deploy/api/*; do
  [ -f "$f" ] && cp "$f" "$DEPLOY_DIR/api/"
done

# 5. 重启服务
echo "[5/5] 重启服务..."
cd "$DEPLOY_DIR/api"
npm install --production --silent 2>/dev/null

# 停掉旧进程
kill $(lsof -t -i:3080) 2>/dev/null 2>&1 || true
sleep 1

# 启动新进程
nohup node server.js > /var/log/pp-api.log 2>&1 &
sleep 3

# 验证
HEALTH=$(curl -s http://localhost:3080/api/health 2>&1)
echo "=== 完成! API: $HEALTH ==="
