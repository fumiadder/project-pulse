#!/bin/bash
set -e
echo "=== Project Pulse 更新部署 $(date) ==="

REPO_DIR="/opt/project-pulse-repo"
DEPLOY_DIR="/opt/project-pulse"
DB_DIR="$DEPLOY_DIR/db"
DB_PATH="$DB_DIR/project-pulse.db"

# 1. 拉取最新代码
echo "[1/7] 拉取最新代码..."
cd "$REPO_DIR" && git pull origin main

# 2. 安装前端依赖
echo "[2/7] 安装前端依赖..."
cd "$REPO_DIR" && npm install --silent 2>/dev/null

# 3. 构建前端
echo "[3/7] 构建前端..."
cd "$REPO_DIR" && npm run build

# 4. 复制前端产物
echo "[4/7] 复制 dist..."
rm -rf "$DEPLOY_DIR/dist"
cp -r "$REPO_DIR/dist" "$DEPLOY_DIR/dist"

# 5. 复制 API（代码可以安全删除，数据库在独立目录）
echo "[5/7] 复制 api..."
rm -rf "$DEPLOY_DIR/api"
mkdir -p "$DEPLOY_DIR/api"
for f in "$REPO_DIR"/deploy/api/*; do
  [ -f "$f" ] && cp "$f" "$DEPLOY_DIR/api/"
done

# 6. 确保数据库目录存在
echo "[6/7] 检查数据库..."
mkdir -p "$DB_DIR"

# 7. 安装 API 依赖 + 重启服务
echo "[7/7] 重启服务..."
cd "$DEPLOY_DIR/api"
npm install --production --silent 2>/dev/null

# 停掉旧进程
kill $(lsof -t -i:3080) 2>/dev/null 2>&1 || true
sleep 1

# 启动新进程（通过 DB_PATH 环境变量指定数据库）
DB_PATH="$DB_PATH" nohup node server.js > /var/log/pp-api.log 2>&1 &
sleep 3

# 验证
HEALTH=$(curl -s http://localhost:3080/api/health 2>&1)
echo "=== 完成! API: $HEALTH ==="
echo "=== 数据库: $DB_PATH ==="
