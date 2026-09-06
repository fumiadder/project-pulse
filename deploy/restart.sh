#!/bin/bash
set -e
echo "=== Project Pulse 更新部署 $(date) ==="

REPO_DIR="/opt/project-pulse-repo"
DEPLOY_DIR="/opt/project-pulse"
DB_DIR="$DEPLOY_DIR/api/data"
DB_PATH="$DB_DIR/project-pulse.db"

# 使用淘宝镜像加速（国内服务器）
NPM_REGISTRY="https://registry.npmmirror.com"
NPM_FLAGS="--registry=$NPM_REGISTRY --fetch-timeout=120000 --fetch-retries=5 --no-audit --no-fund --prefer-offline --loglevel info"

# 0. 确保部署目录存在
mkdir -p "$DEPLOY_DIR"

# 1. 拉取最新代码
echo "[1/8] 拉取最新代码..."
cd "$REPO_DIR"
# 丢弃 npm install 产生的本地修改，避免 git pull 冲突
git checkout -- . 2>/dev/null || true
git clean -fd node_modules 2>/dev/null || true
git pull origin main

# 2. 安装前端依赖
echo "[2/8] 安装前端依赖..."
cd "$REPO_DIR"
# 删除 .env.local（如果存在），避免 VITE_API_BASE 硬编码为 localhost
rm -f .env.local
# 保留 package-lock.json 加速依赖解析，仅清理 node_modules
rm -rf node_modules
# 设置 5 分钟超时，避免无限卡住
timeout 300 npm install $NPM_FLAGS || {
  echo "❌ 安装超时或失败，清理后重试..."
  rm -rf node_modules package-lock.json
  timeout 300 npm install $NPM_FLAGS
}

# 3. 构建前端
echo "[3/8] 构建前端..."
cd "$REPO_DIR" && npm run build

# 4. 复制前端产物
echo "[4/8] 复制 dist..."
rm -rf "$DEPLOY_DIR/dist"
mkdir -p "$DEPLOY_DIR"
cp -r "$REPO_DIR/dist" "$DEPLOY_DIR/dist"

# 5. 复制 API（含 data 子目录，保留数据库）
echo "[5/8] 复制 api..."
rm -rf "$DEPLOY_DIR/api"
cp -r "$REPO_DIR/deploy/api" "$DEPLOY_DIR/api"

# 6. 确保数据库目录存在
echo "[6/8] 检查数据库..."
mkdir -p "$DB_DIR"
if [ ! -f "$DB_PATH" ]; then
  echo "  数据库不存在，将自动创建"
fi

# 7. 安装 API 依赖
echo "[7/8] 安装 API 依赖..."
cd "$DEPLOY_DIR/api"
rm -rf node_modules

# better-sqlite3 是原生模块，需要编译工具，先检查
if ! command -v gcc >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1; then
  echo "  检测到缺少编译工具，尝试安装 build-essential..."
  apt-get update -qq && apt-get install -y -qq build-essential python3 >/dev/null 2>&1 || {
    echo "  ⚠️  无法安装编译工具，请手动执行: apt-get install -y build-essential python3"
  }
fi

timeout 180 npm install --production $NPM_FLAGS || {
  echo "❌ API 安装超时或失败，清理后重试..."
  rm -rf node_modules package-lock.json
  timeout 180 npm install --production $NPM_FLAGS
}

# 验证 better-sqlite3 是否可用
echo "  验证 better-sqlite3..."
node -e "require('better-sqlite3')" 2>&1 && echo "  ✓ better-sqlite3 正常" || {
  echo "  ❌ better-sqlite3 加载失败，尝试重新编译..."
  npm rebuild better-sqlite3 2>&1 || {
    echo "  ❌ 编译失败，请检查是否安装了 build-essential 和 python3"
  }
}

# 8. 重启服务
echo "[8/8] 重启服务..."

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

DB_PATH="$DB_PATH" FEISHU_APP_ID="$FEISHU_APP_ID" FEISHU_APP_SECRET="$FEISHU_APP_SECRET" \
  nohup node server.js > /var/log/pp-api.log 2>&1 &
sleep 3

# 验证
HEALTH=$(curl -s http://localhost:3080/api/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
  echo "=== 完成! API 运行正常 ==="
else
  echo "=== ⚠️  API 可能未启动成功 ==="
  echo "=== 最近 20 行错误日志 ==="
  tail -20 /var/log/pp-api.log 2>/dev/null || echo "  无日志"
fi
echo "=== 数据库: $DB_PATH ==="
