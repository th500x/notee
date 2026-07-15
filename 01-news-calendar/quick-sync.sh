#!/bin/bash

# 日常GitHub同步脚本
# 使用方法: sudo ./quick-sync.sh

echo "=== 快速GitHub同步脚本 ==="
echo "网站目录: /www/wwwroot/website-news"
echo "GitHub仓库: https://github.com/th500x/website-news.git"
echo ""

# 检查权限
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用sudo运行: sudo ./quick-sync.sh"
    exit 1
fi

# 进入网站目录
cd /www/wwwroot/website-news

# 检查是否已经是Git仓库
if [ ! -d ".git" ]; then
    echo "❌ Git仓库未初始化，请先运行: sudo ./auto-deploy.sh"
    exit 1
fi

echo "🔄 从GitHub拉取最新代码..."
git fetch origin main
git reset --hard origin/main

echo "🔐 设置文件权限..."
chown -R www:www /www/wwwroot/website-news
chmod -R 755 /www/wwwroot/website-news
chmod 644 /www/wwwroot/website-news/*.json 2>/dev/null || true

echo "🔄 重启后端服务..."
pm2 restart news-calendar-backend

echo "📊 检查服务状态..."
pm2 status

echo ""
echo "✅ 同步完成！"
echo "🌐 网站地址: http://47.113.185.170"
echo "📊 检查服务状态: pm2 status"