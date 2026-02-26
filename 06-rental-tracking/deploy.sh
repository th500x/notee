#!/bin/bash

echo "========================================"
echo "租赁追踪系统 - 服务器部署脚本"
echo "========================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在 06-rental-tracking 目录下运行此脚本"
    exit 1
fi

# 1. 安装依赖
echo "[1/3] 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败"
    exit 1
fi
echo "✓ 依赖安装完成"
echo ""

# 2. 构建项目
echo "[2/3] 构建项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "错误: 项目构建失败"
    exit 1
fi
echo "✓ 项目构建完成"
echo ""

# 3. 显示构建结果
echo "[3/3] 构建结果:"
if [ -d "dist" ]; then
    echo "✓ dist 目录已生成"
    echo "  文件列表:"
    ls -lh dist/
else
    echo "✗ dist 目录未生成"
    exit 1
fi
echo ""

echo "========================================"
echo "部署完成！"
echo "========================================"
echo ""
echo "下一步："
echo "1. 配置 Nginx 指向 dist 目录"
echo "2. 启动后端服务: cd ../backend && npm start"
echo ""
