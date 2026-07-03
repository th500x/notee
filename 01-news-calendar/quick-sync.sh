#!/bin/bash

# 日常 GitHub 同步（notee  monorepo · 01-news-calendar）
# 使用方法: sudo ./quick-sync.sh

set -e

NOTEE_DIR="/www/wwwroot/notee"
APP_DIR="/www/wwwroot/notee/01-news-calendar"
GITHUB_REPO="https://github.com/th500x/notee.git"

echo "=== 01-news-calendar 快速同步 ==="
echo "Monorepo: $NOTEE_DIR"
echo "应用目录: $APP_DIR"
echo "GitHub: $GITHUB_REPO"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 sudo 运行: sudo ./quick-sync.sh"
    exit 1
fi

if [ ! -d "$NOTEE_DIR/.git" ]; then
    echo "❌ 未找到 Git 仓库: $NOTEE_DIR"
    echo "   请先运行: sudo ./auto-deploy.sh"
    exit 1
fi

cd "$NOTEE_DIR"

echo "🔄 从 GitHub 拉取 main..."
git fetch origin main
git reset --hard origin/main

echo "🔐 设置权限..."
chown -R www:www "$NOTEE_DIR"
chmod -R 755 "$NOTEE_DIR"
chmod 644 "$APP_DIR/public/"*.json 2>/dev/null || true

echo "🔄 重启 news-calendar-backend..."
if pm2 describe news-calendar-backend > /dev/null 2>&1; then
    pm2 restart news-calendar-backend
else
    cd "$APP_DIR"
    pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "✅ 同步完成"
echo "📊 pm2 status:"
pm2 status news-calendar-backend || true
