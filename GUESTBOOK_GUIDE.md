# 留言板功能使用指南

**创建时间**: 2026-02-10  
**功能**: 主页留言板

---

## 🎯 功能特性

✅ **模块选择** - 可以针对不同项目留言  
✅ **字符限制** - 50字以内，简洁明了  
✅ **内容过滤** - 自动屏蔽不良词汇  
✅ **IP记录** - 记录留言者IP（部分隐藏显示）  
✅ **实时显示** - 提交后立即显示  
✅ **模块筛选** - 可按模块查看留言  
✅ **优雅UI** - Tailwind CSS设计，响应式布局

---

## 🚀 快速启动

### 1. 安装后端依赖

```bash
cd shared-backend
npm install
```

### 2. 启动后端服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

服务将运行在 `http://localhost:3002`

### 3. 访问主页

打开浏览器访问：
```
http://localhost/
```

滚动到页面底部即可看到留言板。

---

## 📝 使用方法

### 提交留言

1. 选择模块（新聞筆記/佚事雜錄/區塊指標/真三風雲/綜合留言）
2. 输入留言内容（最多50字）
3. 点击"提交留言"按钮
4. 提交成功后会显示通知，留言会立即出现在列表中

### 查看留言

- 默认显示所有模块的最新20条留言
- 可以通过下拉菜单筛选特定模块的留言
- 留言按时间倒序排列（最新的在最上面）

### 留言显示信息

每条留言显示：
- 模块标签（蓝色标签）
- 留言内容
- 提交时间
- 留言者IP（部分隐藏，如：192.168.***.***）

---

## 🛡️ 安全特性

### 1. 内容过滤

自动过滤不良词汇，包括但不限于：
- 垃圾、傻逼、操、妈的、草泥马
- fuck、shit、damn、bitch

如果留言包含这些词汇，会提示"留言包含不当内容，请修改后重试"。

### 2. 字符限制

- 最少：1个字符（不能为空）
- 最多：50个字符
- 实时显示字符计数

### 3. IP记录

- 自动记录留言者IP地址
- 前端显示时部分隐藏（保护隐私）
- 后端完整保存（便于管理）

---

## 🔧 服务器部署

### 方法1: 使用PM2（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动服务
cd shared-backend
pm2 start server.js --name "notee-guestbook"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs notee-guestbook
```

### 方法2: 使用systemd

创建服务文件 `/etc/systemd/system/notee-guestbook.service`:

```ini
[Unit]
Description=Notee Guestbook Service
After=network.target

[Service]
Type=simple
User=www
WorkingDirectory=/www/wwwroot/notee/shared-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl start notee-guestbook
sudo systemctl enable notee-guestbook
sudo systemctl status notee-guestbook
```

### Nginx配置

在主站nginx配置中添加：

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

重载nginx：

```bash
nginx -t && nginx -s reload
```

### 更新前端API地址

部署到服务器后，需要修改 `index.html` 中的API地址：

```javascript
// 本地开发
const API_BASE_URL = 'http://localhost:3002/api/guestbook';

// 服务器部署（使用nginx代理）
const API_BASE_URL = '/api/guestbook';
```

---

## 📊 数据管理

### 数据文件位置

```
shared-backend/data/guestbook.json
```

### 查看留言数据

```bash
cat shared-backend/data/guestbook.json
```

### 备份留言数据

```bash
# 手动备份
cp shared-backend/data/guestbook.json shared-backend/data/guestbook.backup.json

# 定时备份（添加到crontab）
0 0 * * * cp /www/wwwroot/notee/shared-backend/data/guestbook.json /www/wwwroot/notee/shared-backend/data/guestbook-$(date +\%Y\%m\%d).json
```

### 清空留言数据

```bash
# 备份后清空
cp shared-backend/data/guestbook.json shared-backend/data/guestbook.backup.json
echo '{"messages":[]}' > shared-backend/data/guestbook.json
```

### 删除单条留言

使用API删除（需要管理员密码）：

```bash
curl -X DELETE http://localhost:3002/api/guestbook/messages/留言ID \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'
```

---

## 🎨 自定义配置

### 修改字符限制

编辑 `shared-backend/guestbook.js`:

```javascript
function validateMessage(content) {
  if (content.length > 50) {  // 修改这里
    return { valid: false, error: '留言内容不能超过50个字符' };
  }
  // ...
}
```

同时修改 `index.html`:

```html
<textarea 
  maxlength="50"  <!-- 修改这里 -->
  ...
></textarea>
<span id="charCount">0</span>/50  <!-- 修改这里 -->
```

### 添加不良词汇

编辑 `shared-backend/guestbook.js`:

```javascript
const BLOCKED_WORDS = [
  '垃圾', '傻逼', '操', '妈的', '草泥马',
  'fuck', 'shit', 'damn', 'bitch',
  // 添加更多词汇
  '你的词汇1',
  '你的词汇2'
];
```

### 修改管理员密码

方法1: 使用环境变量（推荐）

```bash
# 创建.env文件
echo "ADMIN_PASSWORD=your_secure_password" > shared-backend/.env
```

方法2: 修改代码

编辑 `shared-backend/guestbook.js`:

```javascript
if (password !== process.env.ADMIN_PASSWORD && password !== 'admin123') {
  // 修改 'admin123' 为你的密码
}
```

### 修改留言显示数量

编辑 `index.html`:

```javascript
const url = `${API_BASE_URL}/messages?module=${filterModule}&limit=20`;
// 修改 limit=20 为你想要的数量
```

---

## 🐛 故障排除

### 问题1: 提交留言失败

**症状**: 点击提交后显示"网络错误，请稍后重试"

**解决方案**:
1. 检查后端服务是否运行：`pm2 status` 或 `systemctl status notee-guestbook`
2. 检查端口是否被占用：`lsof -i :3002`
3. 查看后端日志：`pm2 logs notee-guestbook`

### 问题2: 留言列表不显示

**症状**: 页面显示"加载中..."或"加载失败"

**解决方案**:
1. 打开浏览器开发者工具（F12）
2. 查看Console标签的错误信息
3. 查看Network标签，检查API请求是否成功
4. 确认API地址配置正确

### 问题3: CORS错误

**症状**: 浏览器控制台显示CORS相关错误

**解决方案**:
1. 确认后端CORS配置正确
2. 如果使用nginx代理，确认代理配置正确
3. 检查API_BASE_URL是否正确

### 问题4: 数据文件权限错误

**症状**: 后端日志显示文件读写错误

**解决方案**:
```bash
# 修改权限
chmod 755 shared-backend/data/
chmod 644 shared-backend/data/guestbook.json

# 修改所有者（如果需要）
chown -R www:www shared-backend/data/
```

---

## 📈 未来扩展

### 可能的功能增强

- [ ] 点赞功能
- [ ] 回复功能
- [ ] 表情符号支持
- [ ] 图片上传
- [ ] 用户昵称
- [ ] 留言审核
- [ ] 敏感词智能检测
- [ ] 留言导出（CSV/Excel）
- [ ] 留言统计分析
- [ ] 邮件通知

---

## 📞 技术支持

如有问题，请查看：
- `shared-backend/README.md` - 后端API详细文档
- `DEPLOYMENT_LESSONS_2026-02-10.md` - 部署经验总结

---

**创建者**: Kiro AI Assistant  
**创建时间**: 2026-02-10  
**版本**: v1.0.0

