# 部署指南 - 02和05项目

**日期**: 2026-02-10  
**服务器**: http://47.113.185.170/

---

## ✅ 已完成 - GitHub同步

1. ✅ 修复05-san-storm的vite配置，添加base路径
2. ✅ 构建02-tale-historical项目（dist目录已生成）
3. ✅ 构建05-san-storm项目（dist目录已生成）
4. ✅ 提交所有更改到Git
5. ✅ 推送到GitHub: https://github.com/th500x/notee

**提交信息**: feat: 添加02-tale-historical和05-san-storm项目

---

## 📋 服务器端部署步骤

### 1. 从GitHub拉取最新代码

```bash
cd /www/wwwroot/notee
git pull origin main
```

### 2. 安装依赖并构建02项目

```bash
cd /www/wwwroot/notee/02-tale-historical
npm install
npm run build
```

**预期结果**: 生成 `dist/` 目录，包含构建后的文件

### 3. 安装依赖并构建05项目

```bash
cd /www/wwwroot/notee/05-san-storm
npm install
npm run build
```

**预期结果**: 生成 `dist/` 目录，包含构建后的文件

### 4. 更新Nginx配置

编辑nginx配置文件（通常在 `/etc/nginx/sites-available/` 或宝塔面板中）：

```nginx
server {
    listen 80;
    server_name 47.113.185.170;
    root /www/wwwroot/notee;
    index index.html;

    # 主页
    location = / {
        try_files /index.html =404;
    }

    # 01-news-calendar - 使用alias指向dist目录
    location /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }

    # 02-tale-historical - 使用alias指向dist目录
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }

    # 05-san-storm - 使用alias指向dist目录
    location /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. 测试并重载Nginx

```bash
# 测试配置
nginx -t

# 重载配置
nginx -s reload
# 或者
systemctl reload nginx
```

---

## 🌐 访问地址

部署完成后，可以通过以下地址访问：

- **主页**: http://47.113.185.170/
- **01-新闻日历**: http://47.113.185.170/01-news-calendar/
- **02-历史故事**: http://47.113.185.170/02-tale-historical/
- **05-真三风云**: http://47.113.185.170/05-san-storm/

---

## 📁 项目结构

```
/www/wwwroot/notee/
├── index.html                          # 主页
├── 01-news-calendar/
│   └── dist/                          # 构建输出
├── 02-tale-historical/
│   ├── src/                           # 源代码
│   ├── dist/                          # 构建输出（需要构建）
│   ├── package.json
│   └── vite.config.js                 # base: '/02-tale-historical/'
├── 05-san-storm/
│   ├── src/                           # 源代码
│   ├── dist/                          # 构建输出（需要构建）
│   ├── package.json
│   └── vite.config.js                 # base: '/05-san-storm/'
└── nginx-updated.conf                 # 更新后的nginx配置
```

---

## 🔍 验证清单

部署完成后，请验证以下内容：

### 主页验证
- [ ] 访问 http://47.113.185.170/ 能看到主页
- [ ] 主页上的项目链接都能正常点击

### 02-tale-historical验证
- [ ] 访问 http://47.113.185.170/02-tale-historical/ 能看到书架
- [ ] 能够选择并阅读书籍
- [ ] 章节导航正常工作
- [ ] 图片资源正常加载

### 05-san-storm验证
- [ ] 访问 http://47.113.185.170/05-san-storm/ 能看到游戏主页
- [ ] 各个子页面（服务器、势力、官职、角色等）都能正常访问
- [ ] 数据正常加载（服务器列表、势力列表、角色列表等）
- [ ] 卡牌样式正常显示

### 静态资源验证
- [ ] CSS样式正常加载
- [ ] JavaScript正常执行
- [ ] 图片正常显示
- [ ] 字体正常加载

---

## 🐛 常见问题

### 问题1: 404错误
**原因**: nginx配置中的路径不正确  
**解决**: 确保alias路径指向正确的dist目录

### 问题2: 页面空白
**原因**: vite的base路径配置不正确  
**解决**: 检查vite.config.js中的base配置是否与nginx location匹配

### 问题3: 资源加载失败
**原因**: 静态资源路径不正确  
**解决**: 确保vite的base路径配置正确，资源会自动使用正确的前缀

### 问题4: 刷新页面404
**原因**: SPA路由问题  
**解决**: nginx配置中的try_files已经处理，确保配置正确

---

## 📝 注意事项

1. **构建顺序**: 必须先构建项目（npm run build），再更新nginx配置
2. **路径一致性**: vite.config.js的base路径必须与nginx location路径一致
3. **dist目录**: 不要将dist目录提交到git（已在.gitignore中）
4. **缓存清理**: 如果更新后看不到变化，清除浏览器缓存
5. **权限检查**: 确保nginx有权限读取dist目录中的文件

---

## 🚀 快速部署脚本

可以创建一个自动化部署脚本：

```bash
#!/bin/bash
# deploy-02-05.sh

echo "🚀 开始部署02和05项目..."

# 拉取最新代码
cd /www/wwwroot/notee
git pull origin main

# 构建02项目
echo "📦 构建02-tale-historical..."
cd /www/wwwroot/notee/02-tale-historical
npm install
npm run build

# 构建05项目
echo "📦 构建05-san-storm..."
cd /www/wwwroot/notee/05-san-storm
npm install
npm run build

# 重载nginx
echo "🔄 重载nginx..."
nginx -s reload

echo "✅ 部署完成！"
echo "访问地址："
echo "  - 主页: http://47.113.185.170/"
echo "  - 02项目: http://47.113.185.170/02-tale-historical/"
echo "  - 05项目: http://47.113.185.170/05-san-storm/"
```

---

**最后更新**: 2026-02-10  
**状态**: ✅ GitHub同步完成，等待服务器部署
