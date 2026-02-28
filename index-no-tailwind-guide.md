# 移除 Tailwind CDN 指南

## 问题
主页使用了 Tailwind CSS CDN，在生产环境会显示警告：
```
cdn.tailwindcss.com should not be used in production
```

## 解决方案

### 方案1：忽略警告（推荐）
- 这只是一个开发建议警告，不影响功能
- 网站仍然正常工作
- 性能影响很小

### 方案2：使用内联样式
需要将所有 Tailwind 类替换为自定义 CSS，工作量较大。

### 方案3：使用 Tailwind CLI（最佳但需要构建）
1. 安装 Tailwind CSS
2. 配置 PostCSS
3. 构建生成最终 CSS 文件

## 建议
由于主页是简单的静态页面，建议保持现状或使用方案3。
