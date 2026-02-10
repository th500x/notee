# Notee项目部署指南

**最后更新**: 2026-02-10  
**服务器**: http://47.113.185.170/  
**适用项目**: 01-news-calendar, 02-tale-historical, 05-san-storm

---

## 📋 快速部署

### 服务器端部署（标准流程）

```bash
# 1. 拉取最新代码
cd /www/wwwroot/notee
git pull origin main

# 2. 构建项目（以05为例）
cd /www/wwwroot/notee/05-san-storm
npm install  # 首次部署需要
npm run build

# 3. 重载nginx（如果配置有变化）
nginx -t && nginx -s reload
```

### 访问地址

- **主页**: http://47.113.185.170/
- **01-新闻日历**: http://47.113.185.170/01-news-calendar/
- **02-历史故事**: http://47.113.185.170/02-tale-historical/
- **05-真三风云**: http://47.113.185.170/05-san-storm/

---

## 🔧 配置要点

### 1. Vite配置（vite.config.js）

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/项目名/',  // ← 关键：子路径部署
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // ← 统一资源目录
  },
});
```

### 2. React Router配置（App.jsx）

```jsx
<Router basename="/项目名">  {/* ← 与vite base一致 */}
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
</Router>
```

### 3. 数据加载配置（constants.js）

```javascript
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
};
```

**三个配置必须保持一致**：vite base、Router basename、数据路径BASE_URL

---

## 🐛 常见问题与解决方案

### 问题1: 页面空白，JS/CSS返回404

**原因**: Nginx全局静态资源规则导致  
**解决**: 删除nginx配置中的全局正则location规则

```nginx
# ❌ 删除这个
location ~* \.(js|css|png|jpg)$ {
    expires 1y;
}
```

### 问题2: 数据加载404

**原因**: 使用硬编码路径 `/data/xxx.json`  
**解决**: 统一使用dataLoader

```javascript
// ❌ 错误
fetch('/data/shared/troops.json')

// ✅ 正确
import { loadSharedData } from '@/utils/dataLoader';
loadSharedData('troops');
```

### 问题3: 路由跳转到根路径

**原因**: Router没有配置basename  
**解决**: 添加basename配置

```jsx
<Router basename="/05-san-storm">
```

### 问题4: public目录未同步

**原因**: .gitignore忽略了public目录  
**解决**: 在.gitignore中添加例外

```gitignore
public
!01-news-calendar/public
!02-tale-historical/public
!05-san-storm/public
```

---

## ✅ 部署检查清单

### 本地检查
- [ ] vite.config.js配置了base路径
- [ ] Router配置了basename
- [ ] 所有数据加载使用dataLoader
- [ ] public目录在git版本控制中
- [ ] 本地构建成功：`npm run build`

### 服务器检查
- [ ] 代码已同步：`git pull`
- [ ] 构建成功：`npm run build`
- [ ] dist目录完整
- [ ] nginx配置正确
- [ ] nginx已重载

### 功能测试
- [ ] 主页能访问
- [ ] 导航链接正常
- [ ] 数据加载正常
- [ ] 浏览器控制台无错误

---

## 📝 Nginx配置模板

```nginx
server {
    listen 80;
    server_name 47.113.185.170;
    root /www/wwwroot/notee;
    index index.html;

    location = / {
        try_files /index.html =404;
    }

    location /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }

    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }

    location /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }

    # 留言板API
    location /api/guestbook {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🚀 自动化部署脚本

```bash
#!/bin/bash
# deploy.sh - 快速部署脚本

PROJECT=$1  # 项目名称，如 05-san-storm

if [ -z "$PROJECT" ]; then
    echo "用法: ./deploy.sh <项目名>"
    exit 1
fi

echo "🚀 开始部署 $PROJECT..."

cd /www/wwwroot/notee
git pull origin main

cd /www/wwwroot/notee/$PROJECT
npm install
npm run build

nginx -s reload

echo "✅ 部署完成！"
echo "访问: http://47.113.185.170/$PROJECT/"
```

---

## 📚 相关文档

- [部署标准与编码规范](05-san-storm/docs/base/97-DEPLOYMENT_STANDARDS.md)
- [留言板系统](shared-backend/README.md)
- [故障排查](TROUBLESHOOTING.md)

---

**维护者**: Kiro AI Assistant  
**创建时间**: 2026-02-10
