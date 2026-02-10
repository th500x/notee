# Notee 共享后端服务

**版本**: v1.0.0  
**端口**: 3002  
**功能**: 留言板API

---

## 📋 功能说明

### 留言板功能

- ✅ 提交留言（支持模块选择）
- ✅ 获取留言列表（支持模块筛选）
- ✅ 字符限制（50字以内）
- ✅ 不良词汇过滤
- ✅ IP地址记录
- ✅ 时间戳记录
- ✅ 删除留言（管理员功能）

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd shared-backend
npm install
```

### 2. 启动服务

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

### 3. 验证服务

访问健康检查接口：
```
http://localhost:3002/api/health
```

---

## 📡 API接口

### 基础URL

```
http://localhost:3002/api/guestbook
```

### 1. 获取模块列表

**GET** `/modules`

**响应示例**:
```json
{
  "modules": [
    { "id": "01-news-calendar", "name": "新聞筆記" },
    { "id": "02-tale-historical", "name": "佚事雜錄" },
    { "id": "04-coin-index", "name": "幣圈指數" },
    { "id": "05-san-storm", "name": "真三風雲" },
    { "id": "general", "name": "綜合留言" }
  ]
}
```

### 2. 获取留言列表

**GET** `/messages?module=xxx&limit=20`

**查询参数**:
- `module`: 模块ID（可选，默认all）
- `limit`: 返回数量（可选，默认20）

**响应示例**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "1707552000000",
      "module": "01-news-calendar",
      "content": "这个功能很棒！",
      "ip": "192.168.1.1",
      "timestamp": "2026-02-10T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 3. 提交留言

**POST** `/messages`

**请求体**:
```json
{
  "module": "01-news-calendar",
  "content": "这是一条留言"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "留言提交成功",
  "data": {
    "id": "1707552000000",
    "timestamp": "2026-02-10T12:00:00.000Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "留言内容不能超过50个字符"
}
```

### 4. 删除留言（管理员）

**DELETE** `/messages/:id`

**请求体**:
```json
{
  "password": "admin123"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "留言已删除"
}
```

---

## 🛡️ 安全特性

### 1. 内容过滤

自动过滤以下不良词汇：
- 垃圾、傻逼、操、妈的、草泥马
- fuck、shit、damn、bitch

可在 `guestbook.js` 中的 `BLOCKED_WORDS` 数组添加更多词汇。

### 2. 字符限制

- 最大长度：50个字符
- 自动去除首尾空格
- 空内容拒绝提交

### 3. IP记录

- 自动记录留言者IP
- 支持代理服务器（x-forwarded-for）
- 前端显示时部分隐藏（192.168.***.***）

### 4. 管理员功能

删除留言需要管理员密码：
- 默认密码：`admin123`
- 可通过环境变量 `ADMIN_PASSWORD` 设置

---

## 📁 数据存储

### 存储位置

```
shared-backend/data/guestbook.json
```

### 数据结构

```json
{
  "messages": [
    {
      "id": "1707552000000",
      "module": "01-news-calendar",
      "content": "这是一条留言",
      "ip": "192.168.1.1",
      "timestamp": "2026-02-10T12:00:00.000Z"
    }
  ]
}
```

### 备份建议

定期备份 `data/guestbook.json` 文件：

```bash
# 手动备份
cp data/guestbook.json data/guestbook.backup.json

# 定时备份（crontab）
0 0 * * * cp /path/to/shared-backend/data/guestbook.json /path/to/backup/guestbook-$(date +\%Y\%m\%d).json
```

---

## 🔧 配置

### 环境变量

创建 `.env` 文件：

```env
PORT=3002
ADMIN_PASSWORD=your_secure_password
```

### 修改不良词汇列表

编辑 `guestbook.js`:

```javascript
const BLOCKED_WORDS = [
  '垃圾', '傻逼', '操', '妈的', '草泥马',
  'fuck', 'shit', 'damn', 'bitch',
  // 添加更多词汇
  '你的词汇'
];
```

### 修改字符限制

编辑 `guestbook.js`:

```javascript
function validateMessage(content) {
  if (content.length > 50) {  // 修改这里的数字
    return { valid: false, error: '留言内容不能超过50个字符' };
  }
  // ...
}
```

---

## 🚀 部署

### 使用PM2部署

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name "notee-shared-backend"

# 查看状态
pm2 status

# 查看日志
pm2 logs notee-shared-backend

# 重启服务
pm2 restart notee-shared-backend

# 停止服务
pm2 stop notee-shared-backend
```

### Nginx反向代理

```nginx
# 添加到主站配置
location /api/guestbook/ {
    proxy_pass http://127.0.0.1:3002/api/guestbook/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 📝 开发规范

### 代码风格

- 使用CommonJS模块（require/module.exports）
- 添加JSDoc注释
- 统一错误处理
- 返回标准JSON格式

### API响应格式

**成功响应**:
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## 🐛 故障排除

### 问题1: 端口被占用

```bash
# 查找占用3002端口的进程
lsof -i :3002

# 或使用netstat
netstat -ano | findstr :3002

# 杀死进程
kill -9 <PID>
```

### 问题2: 数据文件权限错误

```bash
# 修改权限
chmod 755 data/
chmod 644 data/guestbook.json
```

### 问题3: CORS错误

确保后端CORS配置正确：

```javascript
app.use(cors({
  origin: '*',  // 生产环境应该指定具体域名
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
```

---

## 📊 监控

### 日志

使用PM2查看日志：

```bash
pm2 logs notee-shared-backend --lines 100
```

### 性能监控

```bash
pm2 monit
```

---

## 🔄 更新日志

### v1.0.0 (2026-02-10)

- ✅ 初始版本
- ✅ 留言板基础功能
- ✅ 不良词汇过滤
- ✅ IP记录
- ✅ 管理员删除功能

---

**维护者**: Kiro AI Assistant  
**创建时间**: 2026-02-10  
**文档版本**: v1.0.0

