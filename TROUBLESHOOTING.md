# 故障排除 - 02和05项目空白页

## 🎯 最可能的原因

基于01项目能正常工作，而02和05显示空白，最可能的原因是：

### 1. Nginx配置中的路径问题 ⭐⭐⭐⭐⭐

**症状**: 主页能看到卡片，但点击后空白  
**原因**: alias路径或try_files配置不正确

**解决方案**:

确保nginx配置**完全**照抄01项目的模式：

```nginx
# 01项目（正常工作）
location /01-news-calendar/ {
    alias /www/wwwroot/notee/01-news-calendar/dist/;
    try_files $uri $uri/ /01-news-calendar/index.html;
}

# 02项目（照抄01的配置）
location /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

# 05项目（照抄01的配置）
location /05-san-storm/ {
    alias /www/wwwroot/notee/05-san-storm/dist/;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

**关键点**:
- ✅ location路径末尾有 `/`
- ✅ alias路径末尾有 `/`
- ✅ try_files的fallback路径正确

---

### 2. 文件权限问题 ⭐⭐⭐

**症状**: 能访问主页，但子项目空白  
**原因**: nginx没有权限读取dist目录

**解决方案**:

```bash
# 修复权限
chmod -R 755 /www/wwwroot/notee/02-tale-historical/dist/
chmod -R 755 /www/wwwroot/notee/05-san-storm/dist/

# 确保nginx用户可以访问
chown -R www:www /www/wwwroot/notee/02-tale-historical/dist/
chown -R www:www /www/wwwroot/notee/05-san-storm/dist/
```

---

### 3. 构建文件不存在 ⭐⭐

**症状**: 空白页，控制台显示404  
**原因**: dist目录为空或构建失败

**检查**:

```bash
# 检查文件是否存在
ls -la /www/wwwroot/notee/02-tale-historical/dist/
ls -la /www/wwwroot/notee/05-san-storm/dist/

# 应该看到：
# - index.html
# - assets/ 目录
# - assets/index-xxx.js
# - assets/index-xxx.css
```

**如果文件不存在，重新构建**:

```bash
cd /www/wwwroot/notee/02-tale-historical
npm run build

cd /www/wwwroot/notee/05-san-storm
npm run build
```

---

## 🔍 快速诊断

### 步骤1: 浏览器控制台检查

1. 按F12打开开发者工具
2. 访问 http://47.113.185.170/02-tale-historical/
3. 查看Console标签，看是否有错误

**常见错误及解决方案**:

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Failed to load resource: 404` | 文件路径不对 | 检查nginx配置 |
| `Unexpected token '<'` | 返回了HTML而不是JS | nginx配置的fallback有问题 |
| `MIME type error` | 文件类型不对 | 添加MIME类型配置 |
| 空白，无错误 | index.html没有加载 | 检查nginx的try_files |

---

### 步骤2: 直接访问测试

在浏览器中尝试：

1. http://47.113.185.170/02-tale-historical/index.html
2. http://47.113.185.170/05-san-storm/index.html

**如果能访问**: nginx配置问题，修改try_files  
**如果不能访问**: 文件不存在或权限问题

---

### 步骤3: 检查Nginx错误日志

```bash
tail -50 /var/log/nginx/error.log
# 或
tail -50 /www/wwwlogs/47.113.185.170.error.log
```

刷新页面，看是否有新的错误。

---

## ✅ 推荐的修复步骤

### 方案A: 最简单（推荐）⭐⭐⭐⭐⭐

1. **复制01项目的nginx配置**

在nginx配置文件中，找到01项目的配置：

```nginx
location /01-news-calendar/ {
    alias /www/wwwroot/notee/01-news-calendar/dist/;
    try_files $uri $uri/ /01-news-calendar/index.html;
}
```

2. **完全照抄，只改名字**

```nginx
location /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

location /05-san-storm/ {
    alias /www/wwwroot/notee/05-san-storm/dist/;
    try_files $uri $uri/ /05-san-storm/index.html;
}
```

3. **测试并重载**

```bash
nginx -t
nginx -s reload
```

4. **清除浏览器缓存，刷新页面**

---

### 方案B: 如果方案A不行

尝试不带末尾斜杠的配置：

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

---

### 方案C: 使用root代替alias

```nginx
server {
    listen 80;
    server_name 47.113.185.170;
    root /www/wwwroot/notee;
    
    location /02-tale-historical/ {
        try_files $uri $uri/ /02-tale-historical/dist/index.html;
    }
    
    location /05-san-storm/ {
        try_files $uri $uri/ /05-san-storm/dist/index.html;
    }
}
```

---

## 📞 需要更多帮助？

如果上述方案都不行，请提供：

1. **浏览器控制台的完整错误信息**（截图或文字）
2. **Network标签中的请求列表**（特别是失败的请求）
3. **当前的nginx配置**（02和05部分）
4. **文件列表**:
   ```bash
   ls -la /www/wwwroot/notee/02-tale-historical/dist/
   ls -la /www/wwwroot/notee/05-san-storm/dist/
   ```
5. **Nginx错误日志**（最后20行）

---

## 🎯 90%的情况下

问题出在nginx配置的这一行：

```nginx
try_files $uri $uri/ /02-tale-historical/index.html;
```

确保这个fallback路径是正确的！

---

**最快的解决方案**: 使用方案A，完全照抄01项目的配置模式。
