# Notee 数据存储策略分析

**版本**: v1.0  
**创建日期**: 2026-03-01  
**维护者**: Kiro AI Assistant

---

## 📋 目录

1. [数据存储方案对比](#数据存储方案对比)
2. [各项目数据特征分析](#各项目数据特征分析)
3. [推荐方案](#推荐方案)
4. [实施优先级](#实施优先级)

---

## 数据存储方案对比

### 方案1: JSON文件存储

**优点**:
- ✅ 简单直接，无需额外服务
- ✅ 易于版本控制（git）
- ✅ 部署简单，无需数据库服务器
- ✅ 适合静态数据
- ✅ 前端可直接读取

**缺点**:
- ❌ 不支持复杂查询
- ❌ 并发写入可能冲突
- ❌ 数据量大时性能差
- ❌ 无法做数据关系管理
- ❌ 无事务支持

**适用场景**:
- 静态内容（不常变化）
- 数据量小（<10MB）
- 只读或极少写入
- 无复杂查询需求

### 方案2: SQLite数据库

**优点**:
- ✅ 轻量级，单文件数据库
- ✅ 支持SQL查询
- ✅ 支持事务
- ✅ 无需独立服务器
- ✅ 适合中小型应用

**缺点**:
- ❌ 并发写入性能有限
- ❌ 不适合高并发场景
- ❌ 需要后端API
- ❌ 前端无法直接访问

**适用场景**:
- 需要查询和统计
- 数据有关系
- 中等数据量（<1GB）
- 低并发写入

### 方案3: MySQL/PostgreSQL数据库

**优点**:
- ✅ 功能强大
- ✅ 支持高并发
- ✅ 支持复杂查询
- ✅ 数据完整性好
- ✅ 适合大型应用

**缺点**:
- ❌ 需要独立服务器
- ❌ 部署复杂
- ❌ 维护成本高
- ❌ 需要后端API

**适用场景**:
- 大量数据
- 高并发访问
- 复杂业务逻辑
- 多用户协作

---

## 各项目数据特征分析

### 01-news-calendar（新闻日历）

#### 数据特征
- **数据类型**: 新闻条目、emoji反应、热门统计
- **数据量**: 中等（每月几百条新闻）
- **更新频率**: 高（用户可添加新闻、点赞）
- **查询需求**: 按日期查询、热门排序、统计
- **并发需求**: 中等（多用户同时访问）
- **数据关系**: 新闻-分类、新闻-反应

#### 当前方案
- ✅ **混合方案**（已实现）
  - 新闻内容：JSON文件（`public/news_202601.json` 等）
  - Emoji反应：SQLite数据库（`backend/news_calendar.db`）

#### 推荐方案
**✅ 保持混合方案，无需改动**

**理由**:
1. 新闻内容是静态的，手动编辑，适合JSON
2. Emoji反应是动态的，用户操作，适合数据库
3. 混合方案充分利用了两种存储的优势
4. 已有后端API，运行良好

**可选优化**:
```javascript
// 如果需要，可以添加索引优化查询
CREATE INDEX idx_reactions_news_id ON emoji_reactions(news_id);
CREATE INDEX idx_reactions_created_at ON emoji_reactions(created_at);

// 添加定期清理旧反应数据的机制（可选）
DELETE FROM emoji_reactions WHERE created_at < date('now', '-1 year');
```

---

### 02-tale-historical（历史故事阅读平台）

#### 数据特征
- **数据类型**: 书籍内容、章节、分类
- **数据量**: 中等（几本书，每本几十章）
- **更新频率**: 极低（内容基本固定）
- **查询需求**: 简单（按书籍ID、章节ID查询）
- **并发需求**: 低（只读）
- **数据关系**: 书籍-章节（简单层级）

#### 当前方案
- ✅ JSON文件 + 直接导入（静态数据）
- 书籍数据在 `src/data/books/`

#### 推荐方案
**✅ 保持JSON文件，无需数据库**

**理由**:
1. 内容完全静态，不需要用户修改
2. 数据量小，适合JSON
3. 前端可直接读取，无需API
4. 易于版本控制和备份
5. 部署简单

**优化建议**:
```javascript
// 1. 优化数据结构，减少嵌套
// 2. 使用懒加载，按需加载章节内容
// 3. 添加数据验证脚本

// 示例：拆分大文件
// 之前：整本书在一个文件
book-02-01-san-nanyang.jsx (大文件)

// 优化后：按章节拆分
books/
├── 02-01-san-nanyang/
│   ├── meta.json          # 书籍元信息
│   ├── chapter-01.json    # 第1章
│   ├── chapter-02.json    # 第2章
│   └── ...
```

---

### 04-coin-index（币指数追踪）

#### 数据特征
- **数据类型**: 周数据、模拟投资记录
- **数据量**: 小（每周一条，一年52条）
- **更新频率**: 低（每周更新一次）
- **查询需求**: 简单（按周查询、年度统计）
- **并发需求**: 低（主要是读取）
- **数据关系**: 简单（周数据独立）

#### 当前方案
- ✅ JSON文件（静态数据）
- 数据在 `public/weeklyData.json`
- 使用脚本收集数据

#### 推荐方案
**✅ 保持JSON文件，但可以考虑轻量级后端**

**理由**:
1. 数据量很小，JSON完全够用
2. 更新频率低，手动或脚本更新即可
3. 无复杂查询需求
4. 前端可直接读取

**可选升级方案**（如果需要用户自定义模拟）:
```javascript
// 如果要支持用户保存自己的模拟投资记录
// 可以使用 localStorage + 可选的后端同步

// 前端：localStorage存储
const saveSimulation = (data) => {
  localStorage.setItem('coin-simulation', JSON.stringify(data));
};

// 可选：后端API同步（跨设备访问）
const syncToServer = async (data) => {
  await fetch('/api/simulations', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};
```

---

### 05-san-storm（三国风云游戏）

#### 数据特征
- **数据类型**: 
  - 静态数据：武将、兵种、技能、地图（大量）
  - 动态数据：玩家数据、游戏状态、战斗记录
- **数据量**: 大（静态数据>10MB，动态数据持续增长）
- **更新频率**: 
  - 静态数据：低（版本更新）
  - 动态数据：高（实时游戏）
- **查询需求**: 复杂（多表关联、统计、排行榜）
- **并发需求**: 高（多玩家在线）
- **数据关系**: 复杂（玩家-武将-部队-战斗等）

#### 当前方案
- ✅ JSON文件（静态数据）
- ❌ 无后端（动态数据未实现）

#### 推荐方案
**✅ 混合方案：JSON + PostgreSQL/MySQL**

**静态数据（JSON文件）**:
```
public/data/
├── shared/              # 跨赛季数据
│   ├── characters.json  # 武将数据
│   ├── troops.json      # 兵种数据
│   └── skills.json      # 技能数据
└── seasons/             # 赛季数据
    └── s1/
        ├── factions.json
        └── events.json
```

**动态数据（数据库）**:
```sql
-- 玩家表
CREATE TABLE players (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  server_id VARCHAR(50),
  faction_id VARCHAR(50),
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 玩家武将表
CREATE TABLE player_characters (
  id VARCHAR(50) PRIMARY KEY,
  player_id VARCHAR(50),
  character_id VARCHAR(50),  -- 引用静态数据
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 战斗记录表
CREATE TABLE battles (
  id VARCHAR(50) PRIMARY KEY,
  attacker_id VARCHAR(50),
  defender_id VARCHAR(50),
  result VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attacker_id) REFERENCES players(id),
  FOREIGN KEY (defender_id) REFERENCES players(id)
);
```

**理由**:
1. 静态数据量大，但不变，适合JSON
2. 动态数据需要频繁读写，必须用数据库
3. 需要复杂查询（排行榜、统计）
4. 高并发场景，需要数据库支持
5. 数据关系复杂，需要关系型数据库

---

### 06-rental-tracking（租赁追踪系统）

#### 数据特征
- **数据类型**: 项目、房源、租客、收支记录
- **数据量**: 中等（几十个项目，每个项目几十条记录）
- **更新频率**: 中等（定期添加收支记录）
- **查询需求**: 中等（统计、筛选、报表）
- **并发需求**: 低（个人或小团队使用）
- **数据关系**: 中等（项目-房源-记录）

#### 当前方案
- ⚠️ 混乱状态
- 有后端API框架
- 数据存储方式不明确

#### 推荐方案
**✅ SQLite数据库（已规划，需实施）**

**数据库结构**:
```sql
-- 项目表
CREATE TABLE projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  password VARCHAR(255),
  visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 房源表
CREATE TABLE properties (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'vacant',
  monthly_rent DECIMAL(10,2),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 租客表
CREATE TABLE tenants (
  id VARCHAR(50) PRIMARY KEY,
  property_id VARCHAR(50),
  name VARCHAR(100),
  phone VARCHAR(20),
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- 收支记录表
CREATE TABLE records (
  id VARCHAR(50) PRIMARY KEY,
  property_id VARCHAR(50),
  date DATE NOT NULL,
  type VARCHAR(20) NOT NULL,  -- 'income' or 'expense'
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(50),
  note TEXT,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

**理由**:
1. 需要统计和报表功能
2. 数据有明确的关系
3. 需要按时间、类型查询
4. 数据量适中，SQLite足够
5. 单用户或小团队，无需高并发

---

## 推荐方案总结

| 项目 | 推荐方案 | 理由 | 优先级 |
|------|---------|------|--------|
| 01-news-calendar | ✅ JSON + SQLite（保持） | 新闻用JSON，反应用数据库 | 🟢 已实现 |
| 02-tale-historical | ✅ JSON文件（保持） | 静态内容、数据量小 | 🟢 已实现 |
| 04-coin-index | ✅ JSON文件（保持） | 数据量小、更新频率低 | 🟢 已实现 |
| 05-san-storm | ✅ JSON + PostgreSQL | 静态+动态数据混合 | 🔴 需实施 |
| 06-rental-tracking | ✅ SQLite | 需要查询统计、数据关系 | 🟡 需实施 |

---

## 实施优先级

### 优先级1：06-rental-tracking（立即实施）

**原因**:
- 功能需求明确（统计、报表）
- 数据结构简单
- 已有后端框架
- 用户体验提升明显

**实施步骤**:
1. 设计数据库表结构
2. 创建SQLite数据库
3. 实现后端API（CRUD）
4. 更新前端调用API
5. 数据迁移（如果有旧数据）

**预计时间**: 2-3天

---

### ~~优先级2：01-news-calendar~~（无需改动）

**原因**:
- ✅ 已使用混合方案（JSON + SQLite）
- ✅ 新闻内容用JSON，适合手动编辑
- ✅ Emoji反应用SQLite，适合动态数据
- ✅ 方案合理，运行良好

**结论**: 无需改动

---

### 优先级3：05-san-storm（长期规划）

**原因**:
- 项目复杂，需要详细设计
- 静态数据已用JSON，保持不变
- 动态数据需要等游戏逻辑完善后再实施

**实施步骤**:
1. 完成游戏核心逻辑
2. 设计数据库表结构（玩家、战斗等）
3. 选择数据库（PostgreSQL推荐）
4. 实现后端API
5. 实现WebSocket实时通信

**预计时间**: 2-3周（分阶段）

---

### 优先级4：02和04项目（保持现状）

**原因**:
- 当前方案完全满足需求
- 无需改动
- 节省开发时间

---

## 技术选型建议

### SQLite vs PostgreSQL/MySQL

**使用SQLite的场景**:
- ✅ 单用户或小团队（<10人）
- ✅ 数据量<1GB
- ✅ 低并发（<100 QPS）
- ✅ 简单部署
- ✅ 示例：01-news-calendar, 06-rental-tracking

**使用PostgreSQL/MySQL的场景**:
- ✅ 多用户（>10人）
- ✅ 数据量>1GB
- ✅ 高并发（>100 QPS）
- ✅ 复杂查询和事务
- ✅ 示例：05-san-storm（未来）

### 数据库连接方式

**方案1：直接连接（推荐用于SQLite）**
```javascript
// Node.js后端
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data/app.db');
```

**方案2：ORM（推荐用于复杂项目）**
```javascript
// 使用Prisma ORM
// schema.prisma
model Project {
  id          String   @id
  name        String
  properties  Property[]
}

model Property {
  id         String   @id
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
}
```

---

## 数据迁移策略

### 从JSON迁移到数据库

**步骤**:
1. 设计数据库表结构
2. 创建迁移脚本
3. 验证数据完整性
4. 切换到数据库
5. 保留JSON作为备份

**示例脚本**:
```javascript
// migrate-to-db.js
const fs = require('fs');
const sqlite3 = require('sqlite3');

async function migrate() {
  // 1. 读取JSON数据
  const jsonData = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  
  // 2. 连接数据库
  const db = new sqlite3.Database('./app.db');
  
  // 3. 插入数据
  for (const item of jsonData.projects) {
    await db.run(
      'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
      [item.id, item.name, item.description]
    );
  }
  
  console.log('迁移完成');
}

migrate();
```

---

## 备份策略

### JSON文件备份
```bash
# 简单：git版本控制
git add data/*.json
git commit -m "backup: update data"
git push
```

### SQLite备份
```bash
# 方案1：文件复制
cp app.db app.db.backup

# 方案2：导出SQL
sqlite3 app.db .dump > backup.sql

# 方案3：定时备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp app.db backups/app_$DATE.db
```

### PostgreSQL/MySQL备份
```bash
# PostgreSQL
pg_dump dbname > backup.sql

# MySQL
mysqldump -u user -p dbname > backup.sql
```

---

## 总结

### 核心建议

1. **02和04项目**：保持JSON文件，无需改动 ✅
2. **01项目**：保持SQLite，添加优化 ⚠️
3. **06项目**：实施SQLite，优先级最高 🔴
4. **05项目**：长期规划，JSON+PostgreSQL 🔵

### 实施顺序

1. **第1周**：06项目实施SQLite（2-3天）
2. **第2周+**：05项目数据库设计和实施（长期）

### 关键原则

- ✅ 简单的用JSON，复杂的用数据库
- ✅ 静态数据用JSON，动态数据用数据库
- ✅ 小项目用SQLite，大项目用PostgreSQL
- ✅ 混合方案：静态内容JSON + 动态数据数据库（如01项目）
- ✅ 优先满足功能需求，再考虑性能优化

---

**文档版本**: v1.0  
**创建日期**: 2026-03-01  
**维护者**: Kiro AI Assistant
