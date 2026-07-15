#!/bin/bash

# 自动化部署脚本 - 解决所有Git同步问题
# 使用方法: sudo ./auto-deploy.sh

set -e  # 遇到错误立即退出

echo "=== 自动化部署脚本 ==="
echo "GitHub仓库: https://github.com/th500x/website-news.git"
echo "网站目录: /www/wwwroot/website-news"
echo ""

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用sudo运行此脚本: sudo ./auto-deploy.sh"
    exit 1
fi

# 设置变量
WEBSITE_DIR="/www/wwwroot/website-news"
GITHUB_REPO="https://github.com/th500x/website-news.git"
BACKUP_DIR="/www/wwwroot/website-news-backup-$(date +%Y%m%d-%H%M%S)"

echo "📁 进入网站目录..."
cd $WEBSITE_DIR

echo "💾 备份当前文件..."
cp -r . $BACKUP_DIR
echo "✅ 备份完成: $BACKUP_DIR"

echo "🔧 配置Git..."
# 设置Git配置（避免权限问题）
git config --global --add safe.directory $WEBSITE_DIR
git config user.name "Server Deploy"
git config user.email "deploy@server.local"

# 检查是否已经是Git仓库
if [ ! -d ".git" ]; then
    echo "🆕 初始化Git仓库..."
    git init
    git remote add origin $GITHUB_REPO
else
    echo "📡 检查远程仓库配置..."
    # 确保远程仓库配置正确
    git remote set-url origin $GITHUB_REPO
fi

echo "🔄 强制同步GitHub代码..."
# 获取最新代码
git fetch origin main

# 强制重置到远程版本（解决冲突）
git reset --hard origin/main

# 确保在main分支
git checkout -B main origin/main

echo "🔐 设置文件权限..."
# 设置正确的文件权限
chown -R www:www $WEBSITE_DIR
chmod -R 755 $WEBSITE_DIR
# JSON文件设置为可读写
chmod 644 $WEBSITE_DIR/*.json 2>/dev/null || true

echo "📦 检查后端依赖..."
if [ -f "backend/package.json" ]; then
    cd backend
    # 检查node_modules是否存在且完整
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        echo "📥 安装后端依赖..."
        npm install
    fi
    cd ..
fi

echo "🔄 重启后端服务..."
# 检查PM2进程是否存在
if pm2 describe news-calendar-backend > /dev/null 2>&1; then
    pm2 restart news-calendar-backend
else
    echo "🆕 启动新的后端进程..."
    cd backend
    pm2 start server.js --name news-calendar-backend
    cd ..
fi

echo "💾 保存PM2配置..."
pm2 save

echo "🧪 测试服务..."
sleep 3
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务正常"
else
    echo "⚠️  后端服务可能有问题，请检查日志: pm2 logs news-calendar-backend"
fi

echo "📊 检查部署结果..."
echo "Git状态:"
git status --porcelain

echo "PM2状态:"
pm2 status

echo "文件权限:"
ls -la *.json 2>/dev/null || echo "没有找到JSON文件"

echo ""
echo "🎉 部署完成！"
echo "🌐 网站地址: http://47.113.185.170"
echo "📋 备份位置: $BACKUP_DIR"
echo "📝 查看日志: pm2 logs news-calendar-backend"
echo ""
echo "如果遇到问题，可以恢复备份:"
echo "sudo rm -rf $WEBSITE_DIR"
echo "sudo mv $BACKUP_DIR $WEBSITE_DIR"