# 留言板功能服务器部署指南

**更新时间**: 2026-02-10  
**功能**: 留言板 + IP地理位置查询

---

## 📦 本次更新内容

✅ 留言板完整功能  
✅ IP地理位置查询（显示城市）  
✅ 不良词汇过滤  
✅ 50字符限制  
✅ 优雅的UI设计

---

## 🚀 服务器部署步骤

### 1. 同步代码

```bash
cd /www/wwwroot/notee
git pull origin main
```

### 2. 安装后端依赖

```bash
cd /www/wwwroot/notee/shared-backend
npm install
```

### 3. 启动后端服务（使用PM2）

```bash
# 启动服务
pm2 start server.js --name "notee-guestbook"

# 查看状态
pm2 status

# 查看日志
pm2 logs notee-guestbook

# 设置开机自启
pm2 save
```

### 4. 配置Nginx代理

编辑nginx配置文件：

```bash
nano /www/server/panel/vhost/nginx/notee.conf
```

在server块中添加：

```nginx
# 留言板API代理
location /api/guestbook/ {
    proxy_pass http://127.0.0.1:3002/api/guestbook/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

测试并重载nginx：

```bash
nginx -t && nginx -s reload
```

### 5. 修改前端API地址

编辑主页文件：

```bash
nano /www/wwwroot/notee/index.html
```

找到这一行：

```javascript
const API_BASE_URL = 'http://localhost:3002/api/guestbook';
```

改为：

```javascript
const API_BASE_URL = '/api/guestbook';
```

保存文件。

### 6. 验证部署

访问主页：

```
http://47.113.185.170/
```

滚动到底部，测试留言板功能：
1. 选择模块
2. 输入留言
3. 提交
4. 查看是否显示城市信息

---

## 🔍 故障排除

### 问题1: 后端服务无法启动

```bash
# 检查端口占用
lsof -i :3002

# 查看PM2日志
pm2 logs notee-guestbook --lines 50

# 重启服务
pm2 restart notee-guestbook
```

### 问题2: 留言提交失败

```bash
# 检查nginx配置
nginx -T | grep -A 10 "location /api/guestbook"

# 检查后端日志
pm2 logs notee-guestbook

# 测试API直接访问
curl http://127.0.0.1:3002/api/health
```

### 问题3: 地理位置不显示

- 确保服务器能访问外网（ip-api.com）
- 查看后端日志是否有错误
- 本地IP会显示"本地访问"，这是正常的

### 问题4: 数据文件权限错误

```bash
# 修改权限
chmod 755 /www/wwwroot/notee/shared-backend/data/
chmod 644 /www/wwwroot/notee/shared-backend/data/guestbook.json

# 修改所有者
chown -R www:www /www/wwwroot/notee/shared-backend/data/
```

---

## 📊 数据管理

### 查看留言数据

```bash
cat /www/wwwroot/notee/shared-backend/data/guestbook.json
```

### 备份留言数据

```bash
# 手动备份
cp /www/wwwroot/notee/shared-backend/data/guestbook.json \
   /www/wwwroot/notee/shared-backend/data/guestbook.backup.json

# 定时备份（添加到crontab）
crontab -e

# 添加这一行（每天凌晨备份）
0 0 * * * cp /www/wwwroot/notee/shared-backend/data/guestbook.json \
  /www/wwwroot/notee/shared-backend/data/guestbook-$(date +\%Y\%m\%d).json
```

---

## 🎯 完整部署命令（一键复制）

```bash
# 1. 同步代码
cd /www/wwwroot/notee && git pull origin main

# 2. 安装依赖
cd shared-backend && npm install

# 3. 启动服务
pm2 start server.js --name "notee-guestbook"
pm2 save

# 4. 查看状态
pm2 status

# 5. 查看日志
pm2 logs notee-guestbook --lines 20
```

**然后手动完成**：
1. 配置nginx代理（添加 location /api/guestbook/）
2. 修改index.html中的API地址
3. 重载nginx：`nginx -t && nginx -s reload`

---

## 📝 Nginx完整配置示例

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

    # 01-news-calendar
    location /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }

    # 02-tale-historical
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }

    # 05-san-storm
    location /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }

    # 留言板API代理（新增）
    location /api/guestbook/ {
        proxy_pass http://127.0.0.1:3002/api/guestbook/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 01项目的API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ✅ 部署检查清单

部署完成后，检查以下项目：

- [ ] 代码已同步到服务器
- [ ] 后端依赖已安装
- [ ] PM2服务已启动并运行正常
- [ ] Nginx配置已添加代理规则
- [ ] Nginx配置测试通过并已重载
- [ ] index.html的API地址已修改
- [ ] 主页能正常访问
- [ ] 留言板能正常显示
- [ ] 能成功提交留言
- [ ] 留言显示城市信息（外网IP）
- [ ] PM2已保存配置（开机自启）

---

## 🔄 后续维护

### 查看服务状态

```bash
pm2 status
pm2 logs notee-guestbook
```

### 重启服务

```bash
pm2 restart notee-guestbook
```

### 停止服务

```bash
pm2 stop notee-guestbook
```

### 删除服务

```bash
pm2 delete notee-guestbook
```

### 更新代码

```bash
cd /www/wwwroot/notee
git pull origin main
pm2 restart notee-guestbook
```

---

## 📞 技术支持

如有问题，请查看：
- `shared-backend/README.md` - 后端API详细文档
- `GUESTBOOK_GUIDE.md` - 留言板使用指南
- `DEPLOYMENT_LESSONS_2026-02-10.md` - 部署经验总结

---

**创建时间**: 2026-02-10  
**维护者**: Kiro AI Assistant

