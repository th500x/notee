# 快速部署参考卡 🚀

## ✅ GitHub同步状态
- **状态**: ✅ 已完成
- **仓库**: https://github.com/th500x/notee
- **最新提交**: 182c0f0

---

## 📦 服务器部署命令（复制粘贴即可）

### 1️⃣ 拉取代码
```bash
cd /www/wwwroot/notee && git pull origin main
```

### 2️⃣ 构建02项目
```bash
cd /www/wwwroot/notee/02-tale-historical && npm install && npm run build
```

### 3️⃣ 构建05项目
```bash
cd /www/wwwroot/notee/05-san-storm && npm install && npm run build
```

### 4️⃣ 更新Nginx配置
在nginx配置文件中添加（或使用宝塔面板）：

```nginx
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
```

### 5️⃣ 重载Nginx
```bash
nginx -t && nginx -s reload
```

---

## 🌐 验证地址

部署完成后访问：
- ✅ 主页: http://47.113.185.170/
- ✅ 02项目: http://47.113.185.170/02-tale-historical/
- ✅ 05项目: http://47.113.185.170/05-san-storm/

---

## 📝 完整文档

详细信息请查看：
- **部署指南**: DEPLOYMENT_GUIDE.md
- **同步总结**: SYNC_SUMMARY_2026-02-10.md
- **Nginx配置**: nginx-updated.conf

---

**准备时间**: 2026-02-10 上午  
**预计部署时间**: 5-10分钟  
**状态**: 🟢 准备就绪
