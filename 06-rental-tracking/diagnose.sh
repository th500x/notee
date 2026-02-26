#!/bin/bash

echo "========================================"
echo "租赁追踪系统 - 诊断脚本"
echo "========================================"
echo ""

echo "1. 当前目录:"
pwd
echo ""

echo "2. 检查 package.json 是否存在:"
if [ -f "package.json" ]; then
    echo "✓ package.json 存在"
else
    echo "✗ package.json 不存在"
    echo "错误: 请在 06-rental-tracking 目录下运行此脚本"
    exit 1
fi
echo ""

echo "3. package.json 内容:"
cat package.json
echo ""

echo "4. 检查 scripts 部分:"
cat package.json | grep -A 10 "scripts"
echo ""

echo "5. 检查 node_modules 是否存在:"
if [ -d "node_modules" ]; then
    echo "✓ node_modules 存在"
    echo "  已安装的包数量: $(ls node_modules | wc -l)"
else
    echo "✗ node_modules 不存在"
    echo "  需要运行: npm install"
fi
echo ""

echo "6. Node 和 npm 版本:"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""

echo "========================================"
echo "诊断完成"
echo "========================================"
