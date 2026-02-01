#!/bin/bash

# Deploy Notee Homepage Script
echo "🚀 开始部署 Notee 主页..."

# 复制主页文件到服务器目录
echo "📁 复制主页文件..."
sudo cp index.html /www/wwwroot/notee/

# 复制更新的 nginx 配置
echo "⚙️  更新 Nginx 配置..."
sudo cp nginx.conf /etc/nginx/sites-available/notee
sudo ln -sf /etc/nginx/sites-available/notee /etc/nginx/sites-enabled/

# 测试 nginx 配置
echo "🔍 测试 Nginx 配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    # 重新加载 nginx
    echo "🔄 重新加载 Nginx..."
    sudo nginx -s reload
    echo "✅ Notee 主页部署成功！"
    echo "🌐 访问 https://notee.vip 查看新主页"
else
    echo "❌ Nginx 配置测试失败，请检查配置文件"
    exit 1
fi