# 部署经验总结 - 2026年2月10日

**项目**: Notee多项目部署  
**服务器**: 47.113.185.170  
**部署项目**: 02-tale-historical, 05-san-storm

---

## 📋 目录

1. [部署流程](#部署流程)
2. [遇到的问题与解决方案](#遇到的问题与解决方案)
3. [关键经验教训](#关键经验教训)
4. [标准部署检查清单](#标准部署检查清单)
5. [Nginx配置要点](#nginx配置要点)
6. [Vite配置要点](#vite配置要点)
7. [React Router配置要点](#react-router配置要点)

---

## 部署流程

### 1. 本地准备

```bash
# 1.1 确保vite.config.js配置正确
# - base: '/项目名/'
# - build.outDir: 'dist'
# - build.assetsDir: 'assets'

# 1.2 确保React Router配置正确（如果使用）
# - <Router basename="/项目名">

# 1.3 确保数据加载路径使用BASE_URL
# - 使用 import.meta.env.BASE_URL
# - 统一使用dataLoader而不是直接fetch

# 1.4 本地构建测试
npm run build

# 1.5 提交到GitHub
git add .
git commit -m "描述"
git push origin main
```

### 2. 服务器部署

```bash
# 2.1 拉取最新代码
cd /www/wwwroot/notee
git pull origin main

# 2.2 安装依赖（首次部署）
cd /www/wwwroot/notee/项目名
npm install

# 2.3 构建项目
NODE_ENV=production npm run build

# 2.4 验证构建结果
ls -la dist/
ls -la dist/assets/
ls -la dist/data/  # 如果有数据文件

# 2.5 测试nginx配置
nginx -t

# 2.6 重载nginx（如果配置有变化）
nginx -s reload
```

---

## 遇到的问题与解决方案

### 问题1: 页面显示空白

**症状**: 
- 访问页面显示空白
- 浏览器控制台无错误
- Network标签显示index.html加载成功

**原因**: 
Nginx配置中有一个全局的静态资源缓存规则，但没有指定root/alias，导致.js和.css文件返回404：

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**解决方案**: 
删除或注释掉这个全局规则，让各个项目的location规则处理静态资源。

**教训**: 
- ⚠️ 全局正则location规则会覆盖具体的location规则
- ⚠️ 静态资源规则必须指定正确的root或alias
- ✅ 优先使用具体的location规则，避免全局正则规则

---

### 问题2: public目录未同步到服务器

**症状**: 
- 服务器上没有public目录
- 构建后dist目录缺少data文件夹
- 数据加载返回404

**原因**: 
.gitignore中忽略了public目录：

```gitignore
public
!01-news-calendar/public
```

**解决方案**: 
在.gitignore中添加例外规则：

```gitignore
public
!01-news-calendar/public
!02-tale-historical/public
!05-san-storm/public
```

然后强制添加：

```bash
git add -f 05-san-storm/public/
git commit -m "fix: 添加05项目的public目录到版本控制"
git push origin main
```

**教训**: 
- ⚠️ 检查.gitignore，确保必要的文件不被忽略
- ⚠️ Vite会自动将public目录复制到dist，但前提是public目录存在
- ✅ 使用`git ls-files`检查文件是否被跟踪

---

### 问题3: React Router路由跳转到根路径

**症状**: 
- 访问 http://47.113.185.170/05-san-storm/ 正常
- 点击导航链接跳转到 http://47.113.185.170/

**原因**: 
BrowserRouter没有配置basename：

```jsx
<Router>  // ❌ 错误
```

**解决方案**: 
添加basename配置：

```jsx
<Router basename="/05-san-storm">  // ✅ 正确
```

**教训**: 
- ⚠️ 部署到子路径时，Router必须配置basename
- ✅ basename应该与vite.config.js中的base保持一致

---

### 问题4: 数据加载路径404

**症状**: 
- 页面加载成功
- 数据加载失败，返回404
- 错误信息：`HTTP error! status: 404`

**原因**: 
数据加载使用了硬编码的绝对路径：

```javascript
fetch('/data/shared/troops.json')  // ❌ 错误
```

在部署到子路径时，实际请求的是：
- `http://47.113.185.170/data/shared/troops.json` ❌
- 而不是 `http://47.113.185.170/05-san-storm/data/shared/troops.json` ✅

**解决方案**: 
使用BASE_URL构建路径：

```javascript
// constants.js
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
};

// 使用dataLoader统一加载
import { loadSharedData } from '@/utils/dataLoader';
loadSharedData('troops');
```

**教训**: 
- ⚠️ 永远不要使用硬编码的绝对路径
- ⚠️ 统一使用dataLoader，不要直接使用fetch
- ✅ 使用`import.meta.env.BASE_URL`获取base路径
- ✅ 所有数据加载方法必须统一

---

### 问题5: 部分页面正常，部分页面失败

**症状**: 
- 服务器选择页面：✅ 正常
- 势力系统页面：✅ 正常
- 生涯设定页面：❌ 看不到卡片
- 部队系统页面：❌ 加载失败

**原因**: 
不同页面使用了不同的数据加载方法：
- 正常的页面：使用dataLoader（统一处理BASE_URL）
- 失败的页面：直接使用fetch（硬编码路径）

**解决方案**: 
统一所有页面使用dataLoader：

```javascript
// ❌ 错误方式
fetch('/data/shared/troops.json')

// ✅ 正确方式
import { loadSharedData } from '@/utils/dataLoader';
loadSharedData('troops');
```

**教训**: 
- ⚠️ 项目中必须统一数据加载方法
- ⚠️ 不要混用fetch和dataLoader
- ✅ 创建统一的dataLoader工具
- ✅ 所有数据加载都通过dataLoader

---

## 关键经验教训

### 1. 配置一致性原则

**三个配置必须保持一致**：

```javascript
// vite.config.js
export default defineConfig({
  base: '/05-san-storm/',  // ← 这里
});

// App.jsx
<Router basename="/05-san-storm">  // ← 这里

// constants.js
const BASE_PATH = import.meta.env.BASE_URL;  // ← 自动获取
```

### 2. 路径处理原则

**永远不要使用硬编码的绝对路径**：

```javascript
// ❌ 错误
fetch('/data/shared/troops.json')
<img src="/assets/logo.png" />

// ✅ 正确
const BASE_PATH = import.meta.env.BASE_URL;
fetch(`${BASE_PATH}data/shared/troops.json`)
<img src={`${BASE_PATH}assets/logo.png`} />
```

### 3. 统一工具原则

**创建统一的工具函数，避免重复代码**：

```javascript
// utils/dataLoader.js
export async function loadSharedData(resource) {
  const path = DATA_PATHS[resource.toUpperCase()];
  const response = await fetch(path);
  return response.json();
}

// 所有地方统一使用
import { loadSharedData } from '@/utils/dataLoader';
const data = await loadSharedData('troops');
```

### 4. Nginx配置原则

**避免全局正则规则覆盖具体规则**：

```nginx
# ❌ 错误：全局规则没有指定root
location ~* \.(js|css)$ {
    expires 1y;
}

# ✅ 正确：在具体location中处理
location /05-san-storm/ {
    alias /www/wwwroot/notee/05-san-storm/dist/;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

### 5. 调试方法原则

**从能工作的项目倒推问题**：

1. 对比能工作的项目（01）和不能工作的项目（02、05）
2. 检查配置差异
3. 检查文件结构差异
4. 检查nginx日志
5. 使用curl测试具体文件

**不要反复尝试无效的方法**！

---

## 标准部署检查清单

### 本地检查

- [ ] vite.config.js配置了正确的base路径
- [ ] vite.config.js配置了build.assetsDir: 'assets'
- [ ] Router配置了正确的basename（如果使用）
- [ ] 所有数据加载使用统一的dataLoader
- [ ] 没有硬编码的绝对路径
- [ ] public目录在git版本控制中
- [ ] 本地构建成功：`npm run build`
- [ ] 检查dist目录结构完整

### 服务器检查

- [ ] 代码已同步：`git pull origin main`
- [ ] 依赖已安装：`npm install`
- [ ] 构建成功：`npm run build`
- [ ] dist目录存在且完整
- [ ] dist/assets目录存在
- [ ] dist/data目录存在（如果需要）
- [ ] nginx配置正确
- [ ] nginx配置测试通过：`nginx -t`
- [ ] nginx已重载：`nginx -s reload`

### 功能测试

- [ ] 主页能访问
- [ ] 所有导航链接正常
- [ ] 数据加载正常
- [ ] 图片资源加载正常
- [ ] 浏览器控制台无错误
- [ ] Network标签无404错误

---

## Nginx配置要点

### 标准配置模板

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

    # 项目1
    location /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }

    # 项目2
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }

    # 项目3
    location /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }

    # ⚠️ 不要添加全局静态资源规则！
    # location ~* \.(js|css|...)$ { ... }  # ❌ 会导致404
}
```

### 配置规则

1. **location路径末尾的斜杠**：
   - `location /project/` 和 `alias /path/to/dist/` 都要有斜杠
   - 保持一致性

2. **try_files指令**：
   - 第一个参数：`$uri` - 尝试直接访问文件
   - 第二个参数：`$uri/` - 尝试作为目录访问
   - 第三个参数：`/project/index.html` - 回退到index.html（SPA必需）

3. **避免全局正则规则**：
   - 不要使用 `location ~* \.(js|css)$` 这样的全局规则
   - 让每个项目的location自己处理静态资源

---

## Vite配置要点

### 标准配置模板

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/项目名/',  // ← 关键：子路径部署
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // ← 关键：统一资源目录
    sourcemap: false,
  },
});
```

### 配置规则

1. **base路径**：
   - 必须以 `/` 开头和结尾
   - 例如：`/05-san-storm/`

2. **assetsDir**：
   - 建议使用 `assets`
   - 与01项目保持一致

3. **public目录**：
   - Vite会自动将public目录复制到dist
   - 确保public目录在git版本控制中

---

## React Router配置要点

### 标准配置模板

```jsx
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    <Router basename="/项目名">  {/* ← 关键：与vite base一致 */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
}
```

### 配置规则

1. **basename**：
   - 必须与vite.config.js中的base一致
   - 例如：`basename="/05-san-storm"`

2. **路由路径**：
   - 使用相对路径：`path="/about"`
   - 不要使用绝对路径：`path="/05-san-storm/about"` ❌

3. **Link组件**：
   - 使用相对路径：`<Link to="/about">`
   - Router会自动加上basename

---

## 数据加载最佳实践

### 创建统一的dataLoader

```javascript
// src/utils/constants.js
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  CHARACTERS: `${BASE_PATH}data/shared/characters.json`,
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
  FACTIONS: (season) => `${BASE_PATH}data/seasons/${season}/factions.json`,
};

// src/utils/dataLoader.js
export async function loadSharedData(resource) {
  const path = DATA_PATHS[resource.toUpperCase()];
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function loadSeasonData(season, resource) {
  const path = DATA_PATHS[resource.toUpperCase()](season);
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
```

### 使用dataLoader

```javascript
// ❌ 错误方式
useEffect(() => {
  fetch('/data/shared/troops.json')
    .then(res => res.json())
    .then(data => setTroops(data));
}, []);

// ✅ 正确方式
import { loadSharedData } from '@/utils/dataLoader';

useEffect(() => {
  loadSharedData('troops')
    .then(data => setTroops(data))
    .catch(err => setError(err.message));
}, []);
```

---

## 快速诊断命令

### 服务器端

```bash
# 检查文件是否存在
ls -la /www/wwwroot/notee/项目名/dist/
ls -la /www/wwwroot/notee/项目名/dist/assets/
ls -la /www/wwwroot/notee/项目名/dist/data/

# 测试文件访问
curl -I http://47.113.185.170/项目名/assets/index-xxx.js

# 检查nginx配置
nginx -T | grep -A 10 "location /项目名"

# 查看nginx错误日志
tail -20 /www/server/nginx/logs/error.log

# 测试nginx配置
nginx -t

# 重载nginx
nginx -s reload
```

### 本地端

```bash
# 检查git跟踪的文件
git ls-files 项目名/public/

# 检查构建结果
npm run build
ls -la 项目名/dist/

# 检查未提交的更改
git status

# 查看最近的提交
git log --oneline -5
```

---

## 总结

### 成功部署的关键

1. **配置一致性**：vite base、Router basename、数据路径都要一致
2. **统一工具**：使用dataLoader统一处理数据加载
3. **避免硬编码**：使用BASE_URL动态构建路径
4. **Nginx配置**：避免全局正则规则覆盖
5. **版本控制**：确保public目录被git跟踪

### 调试思路

1. 从能工作的项目倒推
2. 对比配置差异
3. 检查文件结构
4. 使用curl测试具体文件
5. 查看nginx错误日志

### 避免的错误

1. ❌ 反复尝试无效的方法
2. ❌ 使用硬编码的绝对路径
3. ❌ 混用不同的数据加载方法
4. ❌ 忽略.gitignore的影响
5. ❌ 添加全局nginx正则规则

---

**文档创建时间**: 2026-02-10  
**最后更新时间**: 2026-02-10  
**适用项目**: 所有Notee子项目的部署

