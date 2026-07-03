#!/bin/bash

# 首次部署 / 强制同步 notee monorepo 中的 01-news-calendar
# 使用方法: sudo ./auto-deploy.sh

set -e

NOTEE_DIR="/www/wwwroot/notee"
APP_DIR="/www/wwwroot/notee/01-news-calendar"
GITHUB_REPO="https://github.com/th500x/notee.git"
BACKUP_DIR="/www/wwwroot/notee-backup-$(date +%Y%m%d-%H%M%S)"

echo "=== 01-news-calendar 自动化部署 ==="
echo "Monorepo: $NOTEE_DIR"
echo "GitHub: $GITHUB_REPO"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 sudo 运行: sudo ./auto-deploy.sh"
    exit 1
fi

if [ -d "$NOTEE_DIR" ]; then
    echo "💾 备份 $NOTEE_DIR → $BACKUP_DIR"
    cp -a "$NOTEE_DIR" "$BACKUP_DIR"
fi

mkdir -p "$NOTEE_DIR"
cd "$NOTEE_DIR"

git config --global --add safe.directory "$NOTEE_DIR" 2>/dev/null || true

if [ ! -d ".git" ]; then
    echo "🆕 克隆仓库..."
    git clone "$GITHUB_REPO" .
else
    git remote set-url origin "$GITHUB_REPO"
fi

echo "🔄 同步 origin/main..."
git fetch origin main
git reset --hard origin/main
git checkout -B main origin/main

echo "📦 安装依赖..."
cd "$APP_DIR"
npm install
cd "$APP_DIR/backend"
npm install

echo "🏗️  构建前端..."
cd "$APP_DIR"
npm run build

chown -R www:www "$NOTEE_DIR"
chmod -R 755 "$NOTEE_DIR"
chmod 644 "$APP_DIR/public/"*.json 2>/dev/null || true

echo "🔄 PM2..."
if pm2 describe news-calendar-backend > /dev/null 2>&1; then
    pm2 restart news-calendar-backend
else
    pm2 start "$APP_DIR/ecosystem.config.cjs"
fi
pm2 save

sleep 2
if curl -sf http://localhost:3002/api/health > /dev/null; then
    echo "✅ 健康检查通过 (port 3002)"
else
    echo "⚠️  健康检查失败，请查看: pm2 logs news-calendar-backend"
fi

echo ""
echo "🎉 部署完成"
echo "📋 备份: $BACKUP_DIR"
