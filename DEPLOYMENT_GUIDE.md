# 全局认证系统部署指南

## 🚀 快速部署（5分钟）

### 步骤1：配置后端（3001端口）

```bash
# 1. 进入后端目录
cd backend

# 2. 安装新依赖
npm install

# 3. 生成密码哈希
node scripts/generate-password-hash.js "notee.vip.2026"

# 输出示例：
# GLOBAL_PASSWORD_HASH=$2b$10$TTVNhiZ5SIcuQuq2POxb3OeLbwwhPckij3simGde7Q0ISGW1FK8.e
# JWT_SECRET=9d32e81d7918a009d0e94fdab625bf85a1575bbcc59d237217b0b2daaeb6be5b

# 4. 编辑.env文件
nano .env
# 或
vim .env

# 添加以下内容：
# GLOBAL_PASSWORD_HASH=$2b$10$TTVNhiZ5SIcuQuq2POxb3OeLbwwhPckij3simGde7Q0ISGW1FK8.e
# JWT_SECRET=9d32e81d7918a009d0e94fdab625bf85a1575bbcc59d237217b0b2daaeb6be5b

# 5. 重启后端服务
pm2 restart notee-backend
```

### 步骤2：配置前端（02项目）

```bash
# 1. 进入02项目目录
cd 02-tale-historical

# 2. 创建.env文件（如果不存在）
cp .env.example .env

# 3. 编辑.env文件
nano .env

# 生产环境配置：
# VITE_AUTH_API_URL=https://notee.vip/api/auth

# 或开发环境：
# VITE_AUTH_API_URL=http://localhost:3001/api/auth

# 4. 重新构建
npm run build

# 5. 重启前端服务（如果使用PM2）
pm2 restart tale-historical
```

### 步骤3：验证部署

```bash
# 1. 检查后端健康状态
curl http://localhost:3001/api/health

# 应该看到：
# {
#   "status": "ok",
#   "service": "notee-backend",
#   "features": ["guestbook", "auth"]
# }

# 2. 测试登录API
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"notee.vip.2026","project":"tale-historical"}'

# 应该返回Token：
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": 604800
# }
```

### 步骤4：前端测试

1. 打开浏览器访问：https://notee.vip/02
2. 点击"游戏文本"或"个人私密"分类
3. 输入密码：`notee.vip.2026`
4. 应该成功解锁所有分类
5. 刷新页面，分类应该保持解锁状态

---

## ⚠️ 注意事项

### 安全提示

1. **不要提交.env文件到Git**
   ```bash
   # 确保.env在.gitignore中
   echo ".env" >> .gitignore
   ```

2. **使用强密码**
   - 定期更换密码
   - 使用复杂密码组合
   - 不要在多个地方使用相同密码

3. **保护JWT_SECRET**
   - 使用随机生成的密钥
   - 定期轮换密钥
   - 不要在代码中硬编码

### 常见问题

#### Q1: 登录失败，提示"网络错误"

**原因**: 前端无法连接到后端API

**解决**:
```bash
# 1. 检查后端是否运行
pm2 list

# 2. 检查端口是否正确
netstat -ano | findstr :3001

# 3. 检查防火墙规则
# Windows: 控制面板 → 防火墙 → 高级设置
# Linux: sudo ufw status

# 4. 检查.env配置
cat 02-tale-historical/.env
```

#### Q2: 密码正确但验证失败

**原因**: 密码哈希不匹配

**解决**:
```bash
# 1. 重新生成密码哈希
cd backend
node scripts/generate-password-hash.js "notee.vip.2026"

# 2. 更新.env文件
# 3. 重启后端
pm2 restart notee-backend
```

#### Q3: Token过期后无法自动刷新

**原因**: Token刷新逻辑未实现或失败

**解决**:
- 当前版本需要手动重新登录
- 未来版本会添加自动刷新功能

---

## 📊 部署检查清单

### 后端（3001端口）

- [ ] npm install 完成
- [ ] .env文件已创建
- [ ] GLOBAL_PASSWORD_HASH已配置
- [ ] JWT_SECRET已配置
- [ ] 后端服务已重启
- [ ] 健康检查返回正常
- [ ] 登录API测试通过

### 前端（02项目）

- [ ] .env文件已创建
- [ ] VITE_AUTH_API_URL已配置
- [ ] npm run build 完成
- [ ] 前端服务已重启
- [ ] 浏览器测试登录成功
- [ ] 刷新页面状态保持

### 生产环境

- [ ] HTTPS已配置
- [ ] CORS已正确配置
- [ ] 防火墙规则已设置
- [ ] PM2自动重启已配置
- [ ] 日志监控已设置

---

## 🔄 回滚方案

如果部署出现问题，可以快速回滚：

```bash
# 1. 回滚Git提交
git revert HEAD
git push origin main

# 2. 恢复旧版本
git checkout 546f4f7  # 上一个稳定版本

# 3. 重新部署
npm install
npm run build
pm2 restart all
```

---

## 📞 支持

如有问题，请查看：
- [实施文档](./02-tale-historical/docs/GLOBAL_AUTH_IMPLEMENTATION.md)
- [API文档](./02-tale-historical/docs/GLOBAL_AUTH_IMPLEMENTATION.md#-api文档)

---

**部署日期**: 2026-03-03  
**版本**: v1.0.0  
**状态**: ✅ 就绪
