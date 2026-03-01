# MySQL数据库配置指南

## 📋 配置步骤

### 1. 在宝塔面板创建数据库

1. 登录宝塔面板
2. 进入"数据库"菜单
3. 点击"添加数据库"
4. 填写信息：
   - 数据库名：`notee_rental_tracking`
   - 用户名：`notee_rental` （或使用root）
   - 密码：设置一个强密码
   - 访问权限：本地服务器
5. 点击"提交"创建数据库

### 2. 初始化数据库表

方法1：使用宝塔面板的phpMyAdmin
1. 在数据库列表中，点击 `notee_rental_tracking` 数据库的"管理"按钮
2. 进入phpMyAdmin
3. 点击"SQL"标签
4. 复制 `init-database.sql` 文件的内容
5. 粘贴到SQL输入框
6. 点击"执行"

方法2：使用命令行
```bash
cd /www/wwwroot/notee/06-rental-tracking/backend
mysql -u root -p notee_rental_tracking < init-database.sql
```

### 3. 配置环境变量

创建 `.env` 文件：
```bash
cd /www/wwwroot/notee/06-rental-tracking/backend
cp .env.example .env
nano .env
```

修改配置：
```env
PORT=3003
GLOBAL_ADMIN_PASSWORD=notee.vip.2026
DB_HOST=localhost
DB_USER=notee_rental
DB_PASSWORD=你的数据库密码
DB_NAME=notee_rental_tracking
```

### 4. 安装依赖

```bash
cd /www/wwwroot/notee/06-rental-tracking/backend
npm install
```

### 5. 测试连接

```bash
# 启动服务器
node server.js

# 在另一个终端测试
curl http://localhost:3003/health
```

应该返回：
```json
{
  "status": "ok",
  "service": "rental-tracking",
  "database": "connected",
  "timestamp": "..."
}
```

### 6. 使用PM2启动

```bash
cd /www/wwwroot/notee/06-rental-tracking
pm2 stop rental-tracking-backend
pm2 delete rental-tracking-backend
pm2 start ecosystem.config.cjs
pm2 save
```

### 7. 查看日志

```bash
pm2 logs rental-tracking-backend
```

## 🔄 数据迁移（如果有旧数据）

如果之前使用JSON文件存储数据，需要迁移到MySQL：

### 方法1：手动迁移

1. 备份JSON文件：
```bash
cp /www/wwwroot/notee/06-rental-tracking/backend/data/rental-tracking.json ~/rental-tracking-backup.json
```

2. 在前端重新创建项目和数据

### 方法2：使用迁移脚本（待开发）

创建一个迁移脚本来自动导入JSON数据到MySQL。

## ⚠️ 注意事项

1. **备份数据**：在切换到MySQL前，务必备份现有的JSON数据文件
2. **密码安全**：不要在代码中硬编码数据库密码，使用环境变量
3. **权限设置**：确保MySQL用户有足够的权限（SELECT, INSERT, UPDATE, DELETE）
4. **字符集**：使用utf8mb4字符集以支持emoji和特殊字符
5. **JSON字段**：properties和expenses字段使用JSON类型存储，支持复杂数据结构

## 🐛 常见问题

### 问题1：连接失败
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
解决：检查MySQL服务是否启动
```bash
systemctl status mysql
systemctl start mysql
```

### 问题2：密码错误
```
Error: Access denied for user 'notee_rental'@'localhost'
```
解决：检查.env文件中的数据库密码是否正确

### 问题3：数据库不存在
```
Error: Unknown database 'notee_rental_tracking'
```
解决：运行init-database.sql创建数据库

### 问题4：表不存在
```
Error: Table 'notee_rental_tracking.projects' doesn't exist
```
解决：运行init-database.sql创建表

## 📊 数据库结构

### projects表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) | 项目ID（主键） |
| name | VARCHAR(255) | 项目名称 |
| description | TEXT | 项目描述 |
| password | VARCHAR(255) | 项目密码（可为空） |
| visible | BOOLEAN | 是否可见 |
| properties | JSON | 房源数据 |
| expenses | JSON | 开支数据 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### JSON字段结构

**properties字段**：
```json
[
  {
    "id": "property-xxx",
    "name": "房源名称",
    "monthlyRent": 3000,
    "deposit": 3000,
    "tenant": {
      "name": "租客姓名",
      "phone": "2人",
      "startDate": "2024-01-01",
      "endDate": "2025-01-01"
    },
    "records": [
      {
        "date": "2024-01-15",
        "income": 3000,
        "expenses": 0,
        "note": "收租",
        "photos": [
          {
            "id": "photo-xxx",
            "data": "base64...",
            "name": "photo.jpg",
            "size": 12345,
            "uploadedAt": "2024-01-15T10:00:00.000Z"
          }
        ]
      }
    ]
  }
]
```

**expenses字段**：
```json
[
  {
    "id": "expense-xxx",
    "name": "开支类别",
    "records": [
      {
        "date": "2024-01-15",
        "amount": 500,
        "note": "维修费用",
        "photos": []
      }
    ]
  }
]
```

## 🔒 安全建议

1. 使用强密码
2. 定期备份数据库
3. 限制数据库访问权限
4. 使用环境变量存储敏感信息
5. 定期更新依赖包

## 📝 维护命令

```bash
# 备份数据库
mysqldump -u root -p notee_rental_tracking > backup_$(date +%Y%m%d).sql

# 恢复数据库
mysql -u root -p notee_rental_tracking < backup_20240115.sql

# 查看数据库大小
mysql -u root -p -e "SELECT table_schema AS 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.TABLES WHERE table_schema = 'notee_rental_tracking' GROUP BY table_schema;"

# 优化表
mysql -u root -p notee_rental_tracking -e "OPTIMIZE TABLE projects;"
```
