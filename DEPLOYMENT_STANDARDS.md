# 部署标准与编码规范

**版本**: v1.3  
**更新时间**: 2026-02-11  
**适用范围**: 真三风云项目及所有子路径部署的React项目

---

## 📋 目录

1. [Git同步规范](#git同步规范)（⚠️ 重要！必读！）
2. [Nginx配置规范](#nginx配置规范)（⚠️ 重要！必读！）
3. [文件编码规范](#文件编码规范)（⚠️ 重要！）
4. [配置规范](#配置规范)
5. [编码规范](#编码规范)
6. [数据加载规范](#数据加载规范)
7. [部署检查清单](#部署检查清单)

---

## ⚠️ Git同步规范（重要！必读！）

### 🚨 关键教训：必须完整同步所有修改到GitHub

#### 问题案例（2026-02-11）
在修复04-coin-index项目时，周一（2月9日）的修复从未提交到git，导致：
1. 本地有最新代码，但GitHub没有
2. 后续修改时从GitHub拉取，覆盖了本地的修复
3. 模拟演练和年终总结功能丢失
4. 需要重新修复相同的问题

#### ✅ 正确的同步流程

**当用户要求"全部同步到GitHub"时，必须执行以下步骤：**

```bash
# 1. 检查所有项目的状态
cd /path/to/notee
git status

# 2. 查看所有修改的文件
git diff --name-only

# 3. 添加所有修改
git add -A

# 4. 再次确认状态
git status

# 5. 提交（使用清晰的提交信息）
git commit -m "feat: 描述所有修改的内容"

# 6. 推送到GitHub
git push origin main

# 7. 验证推送成功
git log -1
```

#### ⚠️ 关键原则

1. **永远不要假设某个项目已经同步**
   - 即使刚刚修改过，也要检查 `git status`
   - 不要依赖记忆，因为AI不记得上次同步时间

2. **用户说"全部同步"就是全部同步**
   - 检查根目录和所有子目录
   - 使用 `git add -A` 而不是 `git add .`
   - 确保没有遗漏任何文件

3. **提交前必须验证**
   - 运行 `git status` 确认所有修改都已暂存
   - 运行 `git diff --cached` 查看即将提交的内容
   - 确认提交信息准确描述了所有修改

4. **推送后必须验证**
   - 检查 `git log` 确认提交成功
   - 如果可能，在GitHub网页上验证文件已更新

#### 📋 完整同步检查清单

使用此清单确保完整同步：

- [ ] 运行 `git status` 检查工作区状态
- [ ] 运行 `git diff --name-only` 查看所有修改的文件
- [ ] 运行 `git add -A` 添加所有修改
- [ ] 运行 `git status` 再次确认（应该显示 "Changes to be committed"）
- [ ] 运行 `git commit -m "..."` 提交修改
- [ ] 运行 `git push origin main` 推送到GitHub
- [ ] 运行 `git log -1` 验证最新提交
- [ ] 运行 `git status` 最终确认（应该显示 "nothing to commit, working tree clean"）

#### 🔍 常见遗漏场景

| 场景 | 问题 | 解决方案 |
|------|------|---------|
| 只修改了一个项目 | 以为只需要同步这个项目 | 使用 `git add -A` 同步所有修改 |
| 修改了多个文件 | 只添加了部分文件 | 检查 `git status` 确保所有文件都已添加 |
| 本地测试通过 | 以为已经同步了 | 推送前运行 `git log` 确认提交存在 |
| 修改了配置文件 | 忘记提交配置文件 | 使用 `git diff --name-only` 查看所有修改 |

#### 💡 最佳实践

1. **每次修改后立即同步**
   - 不要积累多个修改再一起同步
   - 每个功能完成后立即提交

2. **使用清晰的提交信息**
   - 格式：`类型: 简短描述`
   - 类型：feat（新功能）、fix（修复）、refactor（重构）、docs（文档）
   - 示例：`feat: 04项目添加利率指标和修复个人评级颜色`

3. **定期验证GitHub状态**
   - 在GitHub网页上查看最新提交时间
   - 确认关键文件的修改已经同步

4. **遇到冲突立即解决**
   - 不要忽略 `git pull` 的冲突提示
   - 手动解决冲突后再推送

---

## ⚠️ Nginx配置规范（重要！必读！）

### 🚨 关键错误：全局静态资源规则导致404

#### 问题描述
在nginx配置中添加全局的静态资源缓存规则会导致子项目的JS/CSS文件返回404，页面显示空白。

#### ❌ 错误配置（会导致空白页）
```nginx
server {
    listen 443 ssl;
    server_name notee.vip;
    root /www/wwwroot/notee;
    
    # 子项目配置
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }
    
    # ❌ 错误：这个规则会拦截所有.js/.css文件
    # 导致子项目的assets/index.js返回404
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

#### 为什么会出错？
1. nginx按照配置顺序匹配location
2. 正则表达式location（`~*`）的优先级高于前缀location
3. 当访问 `/02-tale-historical/assets/index.js` 时：
   - 先匹配到 `~* \.(js|...)$` 规则
   - 这个规则没有指定root或alias
   - 导致nginx在错误的路径查找文件
   - 返回404错误

#### ✅ 正确配置方案

**方案1：删除全局静态资源规则（推荐）**
```nginx
server {
    listen 443 ssl;
    server_name notee.vip;
    root /www/wwwroot/notee;
    
    # 主页
    location = / {
        try_files /index.html =404;
    }
    
    # 子项目配置
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
    
    # ✅ 不添加全局静态资源规则
    # 让每个location自己处理静态文件
}
```

**方案2：在每个location内部添加缓存（如果需要）**
```nginx
location /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
    
    # ✅ 在location内部添加缓存头
    location ~ \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**方案3：使用^~前缀提高优先级**
```nginx
# 使用^~确保子项目location优先匹配
location ^~ /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

# 全局静态资源规则放在最后
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Nginx Location匹配优先级

理解优先级可以避免配置错误：

```
1. = 精确匹配（最高优先级）
   location = /path

2. ^~ 前缀匹配（高优先级，匹配后不再检查正则）
   location ^~ /path/

3. ~ 和 ~* 正则匹配（按配置顺序）
   location ~ \.js$
   location ~* \.(js|css)$

4. 普通前缀匹配（最低优先级）
   location /path/
```

### 诊断步骤

当子项目显示空白页时：

**步骤1：检查浏览器控制台**
- 按F12打开开发者工具
- 查看Console标签是否有错误
- 查看Network标签，找到404的请求

**步骤2：测试文件访问**
```bash
# 测试index.html（应该返回200）
curl -I https://notee.vip/02-tale-historical/

# 测试JS文件（应该返回200，如果返回404就是nginx配置问题）
curl -I https://notee.vip/02-tale-historical/assets/index-xxx.js
```

**步骤3：检查nginx配置**
```bash
# 查看配置
cat /www/server/panel/vhost/nginx/your-site.conf

# 查找全局静态资源规则
grep -n "location.*\.(js|css" /www/server/panel/vhost/nginx/your-site.conf
```

**步骤4：修复配置**
```bash
# 编辑配置
nano /www/server/panel/vhost/nginx/your-site.conf

# 删除或注释掉全局静态资源规则
# location ~* \.(js|css|...)$ { ... }

# 测试配置
nginx -t

# 重载nginx
nginx -s reload
```

### 经验教训总结

| 问题 | 原因 | 解决方案 | 预防措施 |
|------|------|---------|---------|
| 子项目空白页 | 全局静态资源规则拦截 | 删除全局规则 | 不添加全局正则location |
| JS/CSS返回404 | location优先级问题 | 使用^~提高优先级 | 理解nginx匹配顺序 |
| 部分文件404 | alias路径配置错误 | 检查alias末尾斜杠 | 统一使用末尾斜杠 |

### 标准Nginx配置模板

```nginx
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name notee.vip www.notee.vip;
    return 301 https://notee.vip$request_uri;
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    server_name notee.vip www.notee.vip;
    
    root /www/wwwroot/notee;
    index index.html;
    
    # SSL证书
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # 主页
    location = / {
        try_files /index.html =404;
    }
    
    # 子项目（使用^~确保优先匹配）
    location ^~ /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }
    
    location ^~ /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }
    
    location ^~ /05-san-storm/ {
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
    
    # ⚠️ 不要添加全局静态资源规则！
    # ❌ location ~* \.(js|css|...)$ { ... }
}
```

### 关键要点

1. ✅ **不要添加全局静态资源正则规则**
2. ✅ **使用^~前缀提高子项目location优先级**
3. ✅ **location和alias路径末尾统一加斜杠**
4. ✅ **每次修改后测试：nginx -t && nginx -s reload**
5. ✅ **遇到空白页先检查JS/CSS是否404**

---

---

## ⚠️ 文件编码规范（重要！必读！）

### 强制要求

**所有文本文件必须使用UTF-8编码（无BOM）**

#### 为什么重要？
- ❌ 错误的编码会导致中文乱码
- ❌ 乱码文件无法正常编辑和查看
- ❌ 会影响git提交和团队协作
- ❌ 修复乱码非常耗时且容易出错

#### 适用文件类型
以下文件类型必须严格遵守UTF-8编码：
- ✅ Markdown文档（.md）
- ✅ JavaScript/JSX文件（.js, .jsx）
- ✅ JSON数据文件（.json）
- ✅ CSV数据文件（.csv）
- ✅ 配置文件（.config.js, .json）

### 创建新文件的正确方式

#### 方法1：使用Kiro AI的fsWrite工具（推荐）
```javascript
// fsWrite会自动使用UTF-8编码
fsWrite({
  path: "05-san-storm/docs/new-file.md",
  text: "# 标题\n\n内容..."
});
```

#### 方法2：使用VS Code
- 右下角选择"UTF-8"
- 确保没有BOM（Byte Order Mark）
- 保存文件

#### 方法3：使用PowerShell（Windows）
```powershell
# 正确方式：使用.NET方法（无BOM）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

# 或者明确指定UTF8
$content | Set-Content -Path "file.md" -Encoding UTF8
```

### 修改现有文件的正确方式

#### ❌ 错误方式（会导致乱码）
```powershell
# 不要这样做！
Set-Content -Path "file.md" -Value $content  # 默认编码可能不是UTF-8
Get-Content "file.md" | Set-Content "file.md"  # 可能改变编码
```

#### ✅ 正确方式
```powershell
# 方式1：明确指定UTF-8
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
Set-Content -Path "file.md" -Value $content -Encoding UTF8

# 方式2：使用.NET方法（推荐，无BOM）
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path "file.md"), $content, $utf8NoBom)
```

### 检测和修复乱码文件

#### 如何识别乱码
```bash
# 正常文本
玩家系统文档

# 乱码文本（如果看到这样的字符，说明文件已乱码）
鐜╁绯荤粺鏂囨。
```

#### 修复步骤

**步骤1：从git恢复（最佳方案）**
```bash
git checkout HEAD -- path/to/file.md
```

**步骤2：如果git中也是乱码，删除并重新创建**
```bash
# 1. 删除乱码文件
rm path/to/file.md

# 2. 使用Kiro AI的fsWrite重新创建
# 3. 确保内容正确且使用UTF-8编码
```

**步骤3：使用Python转换编码（备用方案）**
```python
# 尝试多种编码读取
encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030']
for enc in encodings:
    try:
        with open(file, 'r', encoding=enc) as f:
            content = f.read()
        # 检查是否包含中文
        if '系统' in content or '文档' in content:
            # 写回UTF-8
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ 成功用 {enc} 读取并转换为UTF-8")
            break
    except:
        continue
```

### Git提交前检查清单

#### 必须检查
- [ ] 文件在编辑器中显示正常（无乱码）
- [ ] 中文字符显示正确
- [ ] `git diff`显示正常
- [ ] 文件大小合理（乱码文件通常会变大）

#### Git配置（确保使用UTF-8）
```bash
git config --global core.quotepath false
git config --global gui.encoding utf-8
git config --global i18n.commit.encoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### 常见错误和解决方案

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| 中文显示为乱码 | 编码不是UTF-8 | 从git恢复或重新创建 |
| PowerShell显示乱码 | 终端编码问题 | 使用`chcp 65001`切换到UTF-8 |
| git diff显示乱码 | git配置问题 | 配置git使用UTF-8 |
| 文件无法读取 | 编码混乱 | 删除并重新创建 |
| 保存后变乱码 | 编辑器编码设置错误 | 检查编辑器设置 |

### VS Code配置（推荐）

```json
// settings.json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n"
}
```

### 预防措施

1. **始终使用UTF-8**
   - 创建文件时明确指定UTF-8
   - 修改文件时保持UTF-8编码
   - 不要使用记事本等简单编辑器

2. **定期检查**
   - 每次提交前检查文件编码
   - 发现乱码立即修复
   - 不要提交乱码文件

3. **团队协作**
   - 统一使用支持UTF-8的编辑器
   - 配置编辑器默认使用UTF-8
   - 发现问题及时通知团队

---

## 配置规范

### 1. Vite配置标准

**文件**: `vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // ✅ 必须：子路径部署的base配置
  base: '/05-san-storm/',
  
  // ✅ 推荐：路径别名配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  
  // ✅ 必须：构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // 统一资源目录名称
    sourcemap: false,     // 生产环境禁用sourcemap
  },
});
```

**关键规则**：
- ✅ `base` 必须以 `/` 开头和结尾
- ✅ `assetsDir` 统一使用 `assets`
- ✅ `outDir` 统一使用 `dist`

### 2. React Router配置

**文件**: `src/App.jsx`

```javascript
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    // ✅ 必须：basename与vite.config.js的base保持一致
    <Router basename="/05-san-storm">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
}
```

### 3. 数据路径配置

**文件**: `src/utils/constants.js`

```javascript
// ✅ 必须：使用BASE_URL动态构建路径
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
  CHARACTERS: `${BASE_PATH}data/shared/characters.json`,
};
```

---

## 编码规范

### 1. 数据加载规范

#### ✅ 正确方式：使用统一的dataLoader

```javascript
import { loadSharedData } from '@/utils/dataLoader';

// 正确
useEffect(() => {
  loadSharedData('troops')
    .then(data => setTroops(data.troops || []))
    .catch(err => setError(err.message));
}, []);
```

#### ❌ 错误方式：直接使用fetch

```javascript
// 错误：硬编码路径
useEffect(() => {
  fetch('/data/shared/troops.json')
    .then(res => res.json())
    .then(data => setTroops(data.troops));
}, []);
```

### 2. 组件规范

```javascript
/**
 * 组件名称
 * @param {Object} props - 组件属性
 */
export function ComponentName({ name }) {
  return <div>{name}</div>;
}

// ✅ 必须：PropTypes验证
ComponentName.propTypes = {
  name: PropTypes.string.isRequired,
};
```

---

## 数据加载规范

### 统一的数据加载流程

```
用户请求 → Hook → dataLoader → constants.DATA_PATHS → fetch → 返回数据
```

### 关键规则

1. ✅ 所有数据加载必须使用 `dataLoader`
2. ✅ 统一错误处理
3. ✅ 统一路径管理
4. ❌ 不要直接使用 `fetch`
5. ❌ 不要硬编码数据路径

---

## 部署检查清单

### 本地检查
- [ ] vite.config.js配置了base路径
- [ ] Router配置了basename
- [ ] 所有数据加载使用dataLoader
- [ ] 所有文件使用UTF-8编码（⚠️ 重要）
- [ ] 本地构建成功：`npm run build`

### 服务器检查
- [ ] 代码已同步：`git pull`
- [ ] 构建成功：`npm run build`
- [ ] dist目录完整
- [ ] nginx配置正确（⚠️ 检查是否有全局静态资源规则）
- [ ] 所有文件编码正确（无乱码）

### Nginx配置检查（⚠️ 重要）
- [ ] 没有全局静态资源正则规则（`location ~* \.(js|css|...)`）
- [ ] 子项目location使用^~前缀
- [ ] location和alias路径末尾有斜杠
- [ ] try_files的fallback路径正确
- [ ] nginx -t 测试通过
- [ ] nginx -s reload 重载成功

### 功能测试
- [ ] 主页能访问
- [ ] 导航链接正常
- [ ] 子项目页面不是空白（⚠️ 重要）
- [ ] 浏览器Network标签无404错误（⚠️ 重要）
- [ ] JS/CSS文件正常加载
- [ ] 数据加载正常
- [ ] 浏览器控制台无错误
- [ ] 中文显示正常（无乱码）

---

## 总结

### 核心原则

1. **Nginx配置**：不要添加全局静态资源正则规则⚠️
2. **文件编码**：始终使用UTF-8（无BOM）⚠️
3. **配置一致性**：vite base、Router basename、数据路径保持一致
4. **统一工具**：使用 dataLoader 统一处理数据加载
5. **避免硬编码**：使用 BASE_URL 动态构建路径

### 最佳实践

1. ✅ 使用^~前缀提高location优先级
2. ✅ 使用路径别名（`@/`）
3. ✅ 统一数据加载方法
4. ✅ 添加完整的类型检查
5. ✅ 编写清晰的注释
6. ✅ 遵循组件规范
7. ✅ 确保文件编码正确

### 避免的错误

1. ❌ 添加全局静态资源正则规则（导致空白页）⚠️
2. ❌ 使用错误的文件编码（导致乱码）
3. ❌ 硬编码绝对路径
4. ❌ 直接使用 fetch
5. ❌ 混用不同的数据加载方法
6. ❌ 忽略 PropTypes 验证
7. ❌ 缺少错误处理

---

**文档版本**: v1.2  
**创建日期**: 2026-02-10  
**最后更新**: 2026-02-11  
**维护者**: Kiro AI Assistant  
**适用项目**: 真三风云 (05-san-storm)

**重要更新**：
- v1.2 (2026-02-11): 添加Nginx配置规范，记录全局静态资源规则导致空白页的问题
