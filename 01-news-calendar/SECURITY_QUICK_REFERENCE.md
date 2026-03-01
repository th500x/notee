# 🔒 安全配置快速参考

**版本**: v1.1  
**更新日期**: 2026-03-01

---

## 🎯 限流配置

### 全局限流

| 环境 | 时间窗口 | 最大请求数 |
|------|----------|------------|
| 开发环境 | 15分钟 | 1000次 |
| 生产环境 | 15分钟 | 100次 |

### Emoji限流

| 环境 | 时间窗口 | 最大请求数 |
|------|----------|------------|
| 开发环境 | 1分钟 | 100次 |
| 生产环境 | 1分钟 | 10次 |

**修改位置**: `backend/server.js`

```javascript
// 调整全局限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,  // 修改这里
})

// 调整Emoji限流
const emojiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 10 : 100,  // 修改这里
})
```

---

## 🌐 CORS白名单

**允许的域名**:
- `https://notee.vip`
- `https://www.notee.vip`
- `http://notee.vip`
- `http://www.notee.vip`
- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://47.113.185.170`

**修改位置**: `backend/server.js`

```javascript
const allowedOrigins = [
  'https://notee.vip',
  // 添加新域名...
]
```

---

## ✅ 有效Emoji列表

**允许的Emoji**:
- 🍺 (干杯)
- 👍 (点赞)
- 👎 (点踩)

**修改位置**: `backend/routes/emoji.js`

```javascript
const validEmojis = ['🍺', '👍', '👎']
```

---

## 📅 日期验证规则

**格式**: `YYYY-MM-DD`

**范围**: 2026年全年

**示例**:
- ✅ `2026-01-01`
- ✅ `2026-12-31`
- ❌ `2025-12-31` (年份不对)
- ❌ `2026-13-01` (月份无效)
- ❌ `20260101` (格式错误)

**修改位置**: `backend/routes/news.js`

---

## 🔐 安全头部

**Helmet配置**:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://notee.vip", "http://localhost:*"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}))
```

**修改位置**: `backend/server.js`

---

## 🛡️ 输入验证规则

### NewsId

- 类型: 字符串
- 最大长度: 200字符
- 禁止字符: `..`, `/`, `\`

### 日期

- 格式: `YYYY-MM-DD`
- 年份: 2026
- 月份: 01-12
- 日期: 01-31（根据月份）

### Emoji

- 白名单: `['🍺', '👍', '👎']`

---

## 🚨 常见错误代码

| 状态码 | 错误信息 | 原因 |
|--------|----------|------|
| 400 | 无效的新闻ID格式 | NewsId包含非法字符 |
| 400 | 无效的日期格式 | 日期格式不是YYYY-MM-DD |
| 400 | 无效的emoji | Emoji不在白名单中 |
| 403 | 访问被拒绝 | CORS检查失败 |
| 404 | 接口不存在 | 请求的API端点不存在 |
| 429 | 请求过于频繁 | 触发限流 |
| 500 | 服务器内部错误 | 服务器异常 |

---

## 📊 监控指标

### 关键指标

1. **限流触发率**
   - 正常: < 1%
   - 警告: 1-5%
   - 异常: > 5%

2. **安全攻击尝试**
   - 正常: < 10次/天
   - 警告: 10-50次/天
   - 异常: > 50次/天

3. **错误率**
   - 正常: < 1%
   - 警告: 1-5%
   - 异常: > 5%

4. **响应时间**
   - 优秀: < 100ms
   - 良好: 100-500ms
   - 需优化: > 500ms

---

## 🔧 快速命令

### 启动服务

```bash
# 开发环境（默认）
npm run dev

# 生产环境
# Windows PowerShell
$env:NODE_ENV="production"
npm start

# Linux/Mac
NODE_ENV=production npm start

# 使用PM2（推荐）
pm2 start ecosystem.config.cjs
```

### 测试安全

```bash
# 测试健康检查
curl http://localhost:3002/api/health

# 测试安全头部
curl -I http://localhost:3002/api/health

# 测试限流
for i in {1..15}; do curl http://localhost:3002/api/news; done
```

### 查看日志

```bash
# 实时查看日志
pm2 logs news-calendar-backend

# 查看错误日志
pm2 logs news-calendar-backend --err
```

---

## 📞 紧急联系

### 安全事件响应

1. **发现安全漏洞**
   - 立即停止服务
   - 评估影响范围
   - 修复漏洞
   - 重新部署

2. **遭受攻击**
   - 启用IP黑名单
   - 收紧限流配置
   - 分析攻击日志
   - 联系安全团队

3. **数据泄露**
   - 立即停止服务
   - 评估泄露范围
   - 通知受影响用户
   - 修复漏洞并加强防护

---

## 📚 相关文档

- [SECURITY_IMPROVEMENTS.md](./docs/SECURITY_IMPROVEMENTS.md) - 详细改进说明
- [SECURITY_TEST.md](./docs/SECURITY_TEST.md) - 测试指南
- [SECURITY_UPGRADE_SUMMARY.md](./SECURITY_UPGRADE_SUMMARY.md) - 升级总结
- [README.md](./docs/README.md) - 项目文档

---

**快速参考版本**: v1.0  
**最后更新**: 2026-03-01  
**维护者**: Kiro AI Assistant
