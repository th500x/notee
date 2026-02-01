#!/bin/bash

# Deploy Notee Homepage Script
echo "🚀 开始部署 Notee 主页..."

# 从 GitHub 拉取最新代码
echo "📥 从 GitHub 拉取最新代码..."
git pull origin main

# 重新构建 news-calendar（如果有修改）
echo "🔨 重新构建 news-calendar..."
cd news-calendar
npm run build
cd ..

# 更新 nginx 配置 (宝塔面板)
echo "⚙️  更新 Nginx 配置..."
sudo cp nginx.conf /www/server/panel/vhost/nginx/notee.vip.conf

# 测试 nginx 配置
echo "🔍 测试 Nginx 配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    # 重新加载 nginx
    echo "🔄 重新加载 Nginx..."
    sudo nginx -s reload
    echo "✅ Notee 主页部署成功！"
    echo "🌐 访问 http://47.113.185.170 查看更新"
else
    echo "❌ Nginx 配置测试失败，请检查配置文件"
    exit 1
fi