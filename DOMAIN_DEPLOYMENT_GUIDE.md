# 域名部署指南 - notee.vip

**更新日期**: 2026-02-11  
**域名**: notee.vip  
**SSL证书**: 已申请（商用1年版 + 免费3个月版）

---

## 📋 部署步骤

### 1. 上传SSL证书到服务器

```bash
# 连接到服务器
ssh root@47.113.185.170

# 创建SSL证书目录
mkdir -p /etc/nginx/ssl

# 上传证书文件（在本地执行）
# 商用证书（推荐使用）
scp /path/to/your/certificate.crt root@47.113.185.170:/etc/nginx/ssl/notee.vip.crt
scp /path/to/your/private.key root@47.113.185.170:/etc/nginx/ssl/notee.vip.key

# 或者免费证书
scp /path/to/your/free-certificate.crt root@47.113.185.170:/etc/nginx/ssl/notee.vip-free.crt
scp /path/to/your/free-private.key root@47.113.185.170:/etc/nginx/ssl/notee.vip-free.key

# 设置证书权限
chmod 600 /etc/nginx/ssl/*.key
chmod 644 /etc/nginx/ssl/*.crt
```

---

### 2. 更新Nginx配置

```bash
# 备份当前配置
cp /etc/nginx/sites-available/notee /etc/nginx/sites-available/notee.backup

# 上传新的HTTPS配置
scp nginx-https.conf root@47.113.185.170:/etc/nginx/sites-available/notee

# 编辑配置文件，修改证书路径
nano /etc/nginx/sites-available/notee
```

**修改证书路径**（在nginx配置文件中）：
```nginx
# 如果使用商用证书
ssl_certificate /etc/nginx/ssl/notee.vip.crt;
ssl_certificate_key /etc/nginx/ssl/notee.vip.key;

# 如果使用免费证书
# ssl_certificate /etc/nginx/ssl/notee.vip-free.crt;
# ssl_certificate_key /etc/nginx/ssl/notee.vip-free.key;
```

**测试配置**：
```bash
# 测试nginx配置
nginx -t

# 如果测试通过，重启nginx
systemctl restart nginx

# 检查nginx状态
systemctl status nginx
```

---

### 3. 更新前端代码

前端代码已经更新，现在需要重新构建和部署：

```bash
# 在本地构建01-news-calendar
cd 01-news-calendar
npm run build

# 上传到服务器
scp -r dist/* root@47.113.185.170:/www/wwwroot/notee/01-news-calendar/dist/
```

---

### 4. 重启后端服务

```bash
# 连接到服务器
ssh root@47.113.185.170

# 重启01-news-calendar后端
pm2 restart news-calendar-backend

# 重启shared-backend
pm2 restart shared-backend

# 查看服务状态
pm2 status
pm2 logs
```

---

### 5. 测试域名访问

**测试HTTP重定向**：
```bash
curl -I http://notee.vip
# 应该返回 301 重定向到 https://notee.vip
```

**测试HTTPS访问**：
```bash
curl -I https://notee.vip
# 应该返回 200 OK
```

**测试API**：
```bash
# 测试新闻API
curl https://notee.vip/api/health

# 测试留言板API
curl https://notee.vip/guestbook-api/api/health
```

**浏览器测试**：
1. 访问 `https://notee.vip` - 应该显示主页
2. 访问 `https://notee.vip/01-news-calendar/` - 应该显示新闻日历
3. 访问 `https://notee.vip/02-tale-historical/` - 应该显示历史故事
4. 访问 `https://notee.vip/05-san-storm/` - 应该显示三国风云

---

## 🔧 配置说明

### 前端API配置

**01-news-calendar/src/services/api.js**：
```javascript
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    // 生产环境（notee.vip）
    if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
      return `${protocol}//${hostname}/api`
    }
    // 本地开发
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001/api`
    }
    // 其他情况
    return `${protocol}//${hostname}:3001/api`
  }
  return 'https://notee.vip/api'
}
```

### 后端CORS配置

**允许的域名**：
- `https://notee.vip`
- `https://www.notee.vip`
- `http://localhost:5173` (本地开发)
- `http://127.0.0.1:5173` (本地开发)

### Nginx反向代理

**API路由**：
- `/api/*` → `http://127.0.0.1:3001/api/*` (新闻日历后端)
- `/guestbook-api/*` → `http://127.0.0.1:3002/*` (留言板后端)

---

## 🔒 SSL证书管理

### 商用证书（1年版）

**优点**：
- 有效期1年，不需要频繁更新
- 更稳定可靠

**更新流程**（每年一次）：
1. 提前1个月申请新证书
2. 上传新证书到服务器
3. 更新nginx配置
4. 重启nginx

### 免费证书（3个月版）

**优点**：
- 免费

**缺点**：
- 每3个月需要更新一次

**更新流程**（每3个月）：
1. 申请新证书
2. 上传到服务器
3. 更新nginx配置
4. 重启nginx

**建议**：使用商用证书作为主证书，免费证书作为备用。

---

## 🚨 故障排查

### 问题1：HTTPS无法访问

**检查**：
```bash
# 检查443端口是否开放
netstat -tlnp | grep 443

# 检查nginx是否监听443
ss -tlnp | grep nginx

# 检查防火墙
ufw status
```

**解决**：
```bash
# 开放443端口
ufw allow 443/tcp

# 重启nginx
systemctl restart nginx
```

### 问题2：证书错误

**检查**：
```bash
# 检查证书文件
ls -la /etc/nginx/ssl/

# 检查证书有效期
openssl x509 -in /etc/nginx/ssl/notee.vip.crt -noout -dates

# 检查证书和私钥是否匹配
openssl x509 -noout -modulus -in /etc/nginx/ssl/notee.vip.crt | openssl md5
openssl rsa -noout -modulus -in /etc/nginx/ssl/notee.vip.key | openssl md5
# 两个MD5值应该相同
```

### 问题3：API请求失败

**检查**：
```bash
# 检查后端服务
pm2 status

# 查看后端日志
pm2 logs news-calendar-backend
pm2 logs shared-backend

# 测试后端直接访问
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3002/api/health
```

### 问题4：CORS错误

**检查浏览器控制台**：
- 查看具体的CORS错误信息
- 检查请求的Origin是否在允许列表中

**解决**：
- 确认后端CORS配置包含了域名
- 重启后端服务

---

## 📝 维护清单

### 每日检查
- [ ] 网站是否正常访问
- [ ] API是否正常响应

### 每周检查
- [ ] 查看nginx日志
- [ ] 查看后端日志
- [ ] 检查服务器资源使用

### 每月检查
- [ ] 检查SSL证书有效期
- [ ] 备份数据库
- [ ] 更新系统安全补丁

### 每季度（如果使用免费证书）
- [ ] 更新SSL证书
- [ ] 测试证书更新流程

### 每年（如果使用商用证书）
- [ ] 续费SSL证书
- [ ] 更新证书文件

---

## 🎯 完成检查清单

部署完成后，请确认以下项目：

- [ ] SSL证书已上传并配置
- [ ] Nginx配置已更新并重启
- [ ] HTTP自动重定向到HTTPS
- [ ] 前端代码已重新构建并部署
- [ ] 后端服务已重启
- [ ] 主页可以通过HTTPS访问
- [ ] 所有子项目可以通过HTTPS访问
- [ ] API可以正常调用
- [ ] 浏览器显示安全锁图标
- [ ] 没有混合内容警告

---

## 📞 联系方式

如有问题，请检查：
1. Nginx错误日志：`/var/log/nginx/error.log`
2. 后端日志：`pm2 logs`
3. 系统日志：`journalctl -xe`

---

**祝部署顺利！** 🎉
