# 调试步骤 - 02和05项目空白页问题

## 🔍 问题诊断

### 步骤1: 检查文件是否存在

在服务器上执行：

```bash
# 检查02项目的dist目录
ls -la /www/wwwroot/notee/02-tale-historical/dist/
ls -la /www/wwwroot/notee/02-tale-historical/dist/assets/

# 检查05项目的dist目录
ls -la /www/wwwroot/notee/05-san-storm/dist/
ls -la /www/wwwroot/notee/05-san-storm/dist/assets/
```

**预期结果**: 应该看到 `index.html` 和 `assets/` 目录

---

### 步骤2: 检查文件权限

```bash
# 检查权限
ls -la /www/wwwroot/notee/02-tale-historical/dist/index.html
ls -la /www/wwwroot/notee/05-san-storm/dist/index.html

# 如果权限不对，修复权限
chmod 644 /www/wwwroot/notee/02-tale-historical/dist/index.html
chmod 644 /www/wwwroot/notee/05-san-storm/dist/index.html
chmod -R 755 /www/wwwroot/notee/02-tale-historical/dist/assets/
chmod -R 755 /www/wwwroot/notee/05-san-storm/dist/assets/
```

---

### 步骤3: 测试直接访问文件

在浏览器中尝试直接访问：

- http://47.113.185.170/02-tale-historical/index.html
- http://47.113.185.170/05-san-storm/index.html

**如果能访问**: 说明文件存在，是nginx配置问题  
**如果不能访问**: 说明文件路径或权限问题

---

### 步骤4: 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 访问 http://47.113.185.170/02-tale-historical/
3. 查看Console标签页，看是否有错误信息
4. 查看Network标签页，看哪些资源加载失败

**常见错误**:
- `404 Not Found` - 文件路径不对
- `MIME type error` - MIME类型配置问题
- `CORS error` - 跨域问题（不太可能）

---

### 步骤5: 检查Nginx错误日志

```bash
# 查看nginx错误日志
tail -f /var/log/nginx/error.log

# 或者宝塔面板的日志位置
tail -f /www/wwwlogs/47.113.185.170.error.log
```

然后刷新页面，看是否有新的错误信息。

---

## 🔧 解决方案

### 方案A: 修复Nginx配置（最可能）

问题可能是nginx的alias配置。尝试以下配置：

```nginx
# 02-tale-historical
location /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    index index.html;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

# 05-san-storm
location /05-san-storm/ {
    alias /www/wwwroot/notee/05-san-storm/dist/;
    index index.html;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

**注意**: 
- alias路径末尾必须有 `/`
- location路径末尾也必须有 `/`
- 两者必须匹配

---

### 方案B: 使用root代替alias

如果方案A不行，尝试这个：

```nginx
server {
    listen 80;
    server_name 47.113.185.170;
    root /www/wwwroot/notee;
    
    # 02-tale-historical
    location /02-tale-historical/ {
        try_files $uri $uri/ /02-tale-historical/dist/index.html;
    }
    
    # 05-san-storm
    location /05-san-storm/ {
        try_files $uri $uri/ /05-san-storm/dist/index.html;
    }
}
```

---

### 方案C: 检查vite构建配置

如果上述方案都不行，可能需要调整vite配置：

**02-tale-historical/vite.config.js**:
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/02-tale-historical/',  // 确保这个路径正确
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
```

**05-san-storm/vite.config.js**:
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/05-san-storm/',  // 确保这个路径正确
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
```

如果修改了配置，需要重新构建：
```bash
cd /www/wwwroot/notee/02-tale-historical && npm run build
cd /www/wwwroot/notee/05-san-storm && npm run build
```

---

## 🎯 快速修复（最可能有效）

### 选项1: 修改Nginx配置

在宝塔面板或nginx配置文件中，将02和05的location改为：

```nginx
location /02-tale-historical {
    alias /www/wwwroot/notee/02-tale-historical/dist;
    index index.html;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

location /05-san-storm {
    alias /www/wwwroot/notee/05-san-storm/dist;
    index index.html;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

**注意变化**:
- location路径**没有**末尾的 `/`
- alias路径**没有**末尾的 `/`

然后重载nginx：
```bash
nginx -t && nginx -s reload
```

---

### 选项2: 使用宝塔面板的反向代理

如果你使用宝塔面板，可以尝试：

1. 进入网站设置
2. 找到"反向代理"或"配置文件"
3. 添加以下配置：

```nginx
location ^~ /02-tale-historical {
    alias /www/wwwroot/notee/02-tale-historical/dist;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

location ^~ /05-san-storm {
    alias /www/wwwroot/notee/05-san-storm/dist;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

---

## 📊 对比01项目（正常工作）

检查01项目的nginx配置，看看有什么不同：

```bash
# 在nginx配置中找到01项目的配置
grep -A 5 "01-news-calendar" /etc/nginx/sites-available/default
# 或者
grep -A 5 "01-news-calendar" /www/server/panel/vhost/nginx/*.conf
```

然后让02和05的配置与01保持一致。

---

## 🆘 如果还是不行

请提供以下信息：

1. **浏览器控制台的错误信息**（F12 -> Console）
2. **Network标签中失败的请求**（F12 -> Network）
3. **Nginx错误日志**（最后几行）
4. **当前的nginx配置**（02和05部分）
5. **文件是否存在**（ls命令的输出）

这样我可以更准确地诊断问题。

---

**最可能的原因**: Nginx的alias配置中，路径末尾的斜杠问题。
**最快的解决方案**: 尝试"快速修复 - 选项1"
