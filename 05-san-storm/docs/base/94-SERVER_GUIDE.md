# 服务器开发指南

**文档版本**: v1.0.0  
**最后更新**: 2026-02-09

---

## 📋 文档概述

本文档涵盖服务器开发的三个核心方面：
1. **性能优化** - 如何在有限资源下支持更多玩家
2. **安全保护** - 如何保护代码和数据
3. **知识产权** - 如何合法使用历史素材

---

## 🎯 服务器目标

**服务器配置**: 2核CPU, 2GB内存, 3Mbps带宽  
**目标容量**: 500注册用户, 200-300同时在线  
**核心策略**: 客户端为主，服务器为辅

---

## 一、性能优化策略

### 1.1 架构原则

```
✅ 90%的计算在客户端完成
✅ 服务器只做关键验证和数据同步
✅ 异步对战模式，减少实时压力
✅ 智能缓存，减少数据库查询
```

### 1.2 客户端计算

#### 事件系统 - 100%客户端

```javascript
// ✅ 客户端完成
- 事件触发检查
- 概率计算
- 因子计算
- 结果展示
- 动画播放

// ⚠️ 服务器只验证
- 关键奖励发放（经验、金币、物品）
- 防作弊检查
```

**数据传输量**: 每次事件完成约 200-500 bytes

```javascript
// 客户端 → 服务器
{
  eventId: 'event_tk_001',
  optionId: 'option_a',
  result: {
    exp: 1000,
    gold: 500,
    items: ['item_001']
  },
  timestamp: 1234567890,
  signature: 'hash_value'  // 防作弊签名
}

// 服务器 → 客户端
{
  success: true,
  verified: true
}
```

#### 战斗系统 - 95%客户端

```javascript
// ✅ 客户端完成
- 战斗动画
- 伤害计算
- 技能效果
- AI行动（单机模式）
- 回合逻辑

// ⚠️ 服务器只验证
- 战斗结果合法性
- 最终奖励
```

**数据传输量**: 每场战斗约 1-2 KB

#### 地图移动 - 100%客户端

```javascript
// ✅ 客户端完成
- 路径寻找
- 移动动画
- 碰撞检测
- 视野计算

// ⚠️ 服务器只验证
- 最终位置合法性（每5秒同步一次）
```

**数据传输量**: 每5秒约 50-100 bytes

### 1.3 异步对战模式

**传统实时对战 vs 异步对战**:

| 模式 | 服务器压力 | 网络要求 | 用户体验 |
|------|-----------|---------|---------|
| 实时对战 | 极高 | 高 | 需要同时在线 |
| 异步对战 | 极低 | 低 | 随时可玩 |

**实现示例**:

```javascript
// 场景：玩家A攻城（城市属于势力X，有玩家B、C、D）

// 第一阶段：攻击AI守军
{
  attacker: 'playerA',
  target: 'city_001',
  phase: 'ai_defense',
  aiTroops: [...],
  status: 'in_progress'
}

// 第二阶段：等待玩家防守
// 如果1小时内玩家B、C、D都没上线
{
  phase: 'capture',
  result: 'attacker_victory',
  newOwner: 'playerA'
}

// 如果玩家B上线
{
  phase: 'player_defense',
  defender: 'playerB',
  defenderTroops: [...],
  status: 'waiting_attacker'
}
```

**优势**:
- ✅ 不需要双方同时在线
- ✅ 服务器只存储状态，不处理实时战斗
- ✅ 战斗计算在客户端完成
- ✅ 大幅降低服务器压力

### 1.4 数据库优化

#### 数据结构设计

```sql
-- 玩家核心数据（经常读写）
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  gold INT DEFAULT 1000,
  last_login TIMESTAMP,
  factors JSONB DEFAULT '{"combat":50,"intelligence":50}',
  INDEX idx_username (username),
  INDEX idx_last_login (last_login)
);

-- 玩家详细数据（不常读写）
CREATE TABLE player_details (
  player_id INT PRIMARY KEY REFERENCES players(id),
  inventory JSONB DEFAULT '[]',
  relationships JSONB DEFAULT '{}',
  achievements JSONB DEFAULT '[]'
);

-- 战斗记录（只写入，定期归档）
CREATE TABLE battle_logs (
  id SERIAL PRIMARY KEY,
  player_id INT,
  battle_type VARCHAR(20),
  result VARCHAR(10),
  rewards JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  PARTITION BY RANGE (created_at)
);
```

#### 缓存策略

```javascript
// Redis缓存层
const cacheStrategy = {
  // 玩家在线数据 - 缓存在Redis
  'player:online:{id}': {
    ttl: 3600,  // 1小时
    data: { id, username, level, factors, position }
  },
  
  // 游戏配置 - 永久缓存
  'config:events': {
    ttl: -1,  // 永不过期
    updateOnDeploy: true
  },
  
  // 排行榜 - 定时更新
  'leaderboard:top100': {
    ttl: 300,  // 5分钟
    updateCron: '*/5 * * * *'
  }
};
```

#### 查询优化

```javascript
// ✅ 正确：先查缓存
async function getPlayerData(playerId) {
  // 1. 先查Redis
  let player = await redis.get(`player:${playerId}`);
  
  if (player) {
    return JSON.parse(player);
  }
  
  // 2. 缓存未命中，查数据库
  player = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
  
  // 3. 写入缓存
  await redis.setex(`player:${playerId}`, 3600, JSON.stringify(player));
  
  return player;
}
```

### 1.5 网络优化

#### 数据压缩

```javascript
// 使用MessagePack替代JSON（减少30-50%体积）
import msgpack from 'msgpack-lite';

// 发送数据
const data = { eventId: 'event_tk_001', result: {...} };
const compressed = msgpack.encode(data);
socket.send(compressed);

// 接收数据
socket.on('message', (compressed) => {
  const data = msgpack.decode(compressed);
});
```

#### 批量同步

```javascript
// ✅ 正确：批量同步
const batch = new SyncBatch();
batch.add('exp', 100);
batch.add('gold', 50);
batch.add('item', 'sword');
batch.sync();  // → 一次请求
```

#### 增量更新

```javascript
// ✅ 正确：只发送变化
{
  type: 'delta',
  changes: {
    exp: +1000,
    gold: +500,
    'factors.combat': +5
  }
}
```

### 1.6 服务器架构

#### 进程管理

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'san-storm-api',
    script: './server/api.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }, {
    name: 'san-storm-websocket',
    script: './server/websocket.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '800M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

#### 负载分配

```
┌─────────────────────────────────────┐
│         Nginx (反向代理)             │
│         端口: 80/443                 │
└─────────────────────────────────────┘
              │
              ├─────────────────────────┐
              │                         │
    ┌─────────▼─────────┐    ┌─────────▼─────────┐
    │   API服务器        │    │  WebSocket服务器   │
    │   端口: 3000       │    │   端口: 3001       │
    └────────┬──────────┘    └────────┬───────────┘
             │                        │
             └────────┬───────────────┘
                      │
              ┌───────▼────────┐
              │  Redis缓存     │
              │  PostgreSQL    │
              └────────────────┘
```

#### Nginx配置

```nginx
# /etc/nginx/nginx.conf
worker_processes 2;

events {
    worker_connections 1024;
    use epoll;
}

http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;
    
    keepalive_timeout 65;
    client_max_body_size 10M;
    
    upstream api_backend {
        server localhost:3000;
        keepalive 32;
    }
    
    upstream ws_backend {
        server localhost:3001;
        keepalive 32;
    }
    
    server {
        listen 80;
        server_name your-domain.com;
        
        location / {
            root /var/www/san-storm;
            try_files $uri $uri/ /index.html;
            
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
        
        location /api/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }
        
        location /ws/ {
            proxy_pass http://ws_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
        location /api/ {
            limit_req zone=api_limit burst=20;
        }
    }
}
```

### 1.7 容量计算

#### 内存使用估算

```
总内存: 2GB = 2048MB

分配:
- 操作系统: 300MB
- Nginx: 50MB
- Node.js API: 500MB
- Node.js WebSocket: 500MB
- Redis: 400MB
- PostgreSQL: 200MB
- 其他: 98MB
-------------------
总计: 2048MB
```

#### 并发连接估算

```
WebSocket连接:
- 每个连接约 2KB 内存
- 实际安全值: 300 并发连接

数据库连接:
- PostgreSQL连接池: 20个连接
- Redis连接池: 10个连接
```

#### 带宽使用估算

```
3Mbps = 375KB/s

200个在线玩家:
- 位置同步: 200 * 0.1KB / 5s = 4KB/s
- 事件/战斗: 平均 10KB/s
- 总计: 约 15KB/s

安全余量: 375KB/s / 15KB/s = 25倍 ✅
```

### 1.8 前端性能优化

#### 图片资源优化

```javascript
// 根据设备加载不同分辨率的图片
const imageQuality = {
  mobile: {
    character: '512x512',
    background: '1024x768',
    icon: '64x64'
  },
  desktop: {
    character: '1024x1024',
    background: '1920x1080',
    icon: '128x128'
  }
};

// 懒加载
<img 
  src={placeholder} 
  data-src={actualImage}
  loading="lazy"
  className="w-full h-auto"
/>
```

#### 动画性能优化

```css
/* 使用 transform 而不是 position */
/* ❌ 性能差 */
.move {
  left: 100px;
  top: 100px;
}

/* ✅ 性能好 */
.move {
  transform: translate(100px, 100px);
  will-change: transform;  /* 提示浏览器优化 */
}

/* 使用 GPU 加速 */
.animated {
  transform: translateZ(0);  /* 强制GPU加速 */
  backface-visibility: hidden;
}
```

#### 渲染优化

```javascript
// 只渲染可见区域
class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.visibleArea = this.calculateVisibleArea();
  }
  
  render(entities) {
    // 只渲染在视口内的实体
    const visibleEntities = entities.filter(entity => 
      this.isInViewport(entity)
    );
    
    visibleEntities.forEach(entity => {
      entity.render(this.canvas);
    });
  }
  
  isInViewport(entity) {
    return (
      entity.x >= this.visibleArea.left &&
      entity.x <= this.visibleArea.right &&
      entity.y >= this.visibleArea.top &&
      entity.y <= this.visibleArea.bottom
    );
  }
}
```

#### React性能优化

```javascript
// 使用 React.memo 避免不必要的重渲染
const CharacterCard = React.memo(({ character }) => {
  return (
    <div className="character-card">
      {/* ... */}
    </div>
  );
}, (prevProps, nextProps) => {
  // 只有 character.id 变化时才重新渲染
  return prevProps.character.id === nextProps.character.id;
});

// 使用 useMemo 缓存计算结果
const ExpensiveComponent = ({ data }) => {
  const processedData = useMemo(() => {
    return heavyCalculation(data);
  }, [data]);
  
  return <div>{processedData}</div>;
};

// 使用 useCallback 缓存函数
const ParentComponent = () => {
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  return <ChildComponent onClick={handleClick} />;
};
```

#### 代码分割和懒加载

```javascript
// 路由级别的代码分割
import { lazy, Suspense } from 'react';

const CharacterList = lazy(() => import('./pages/CharacterList'));
const BattleView = lazy(() => import('./pages/BattleView'));
const MapView = lazy(() => import('./pages/MapView'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/characters" element={<CharacterList />} />
        <Route path="/battle" element={<BattleView />} />
        <Route path="/map" element={<MapView />} />
      </Routes>
    </Suspense>
  );
}
```

#### 资源预加载

```javascript
// 预加载关键资源
const preloadImages = [
  '/assets/characters/liubei.png',
  '/assets/characters/guanyu.png',
  '/assets/ui/background.jpg'
];

preloadImages.forEach(src => {
  const img = new Image();
  img.src = src;
});

// 预加载下一页面的资源
<link rel="prefetch" href="/assets/battle-background.jpg" />
```

#### 性能监控

```javascript
// 使用 Performance API 监控性能
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 0,
      renderTime: 0,
      memoryUsage: 0
    };
  }
  
  measureFPS() {
    let lastTime = performance.now();
    let frames = 0;
    
    const loop = () => {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        this.metrics.fps = frames;
        frames = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(loop);
    };
    
    loop();
  }
  
  measureRenderTime(component) {
    const start = performance.now();
    component.render();
    const end = performance.now();
    
    this.metrics.renderTime = end - start;
    
    if (this.metrics.renderTime > 16.67) {
      console.warn(`Slow render: ${component.name} took ${this.metrics.renderTime}ms`);
    }
  }
  
  measureMemory() {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1048576;
      
      if (this.metrics.memoryUsage > 100) {
        console.warn(`High memory usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
      }
    }
  }
}
```

### 1.9 监控与预警

#### 性能监控

```javascript
const monitor = {
  cpu: () => os.loadavg()[0],
  
  memory: () => {
    const used = process.memoryUsage();
    return {
      rss: used.rss / 1024 / 1024,
      heapUsed: used.heapUsed / 1024 / 1024
    };
  },
  
  onlineUsers: () => connectionPool.size,
  dbConnections: () => db.pool.totalCount,
  
  responseTime: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow request: ${req.url} took ${duration}ms`);
      }
    });
    next();
  }
};

// 每分钟记录一次
setInterval(() => {
  const stats = {
    cpu: monitor.cpu(),
    memory: monitor.memory(),
    online: monitor.onlineUsers(),
    timestamp: new Date()
  };
  
  logger.info('Server stats:', stats);
  
  // 预警
  if (stats.memory.rss > 1500) {
    logger.warn('High memory usage!');
  }
  if (stats.online > 280) {
    logger.warn('Approaching connection limit!');
  }
}, 60000);
```

#### 自动降级

```javascript
class AutoDegradation {
  constructor() {
    this.level = 0;  // 0=正常, 1=轻度降级, 2=重度降级
  }
  
  check() {
    const cpu = os.loadavg()[0];
    const memory = process.memoryUsage().rss / 1024 / 1024;
    const online = connectionPool.size;
    
    // 重度降级
    if (cpu > 1.8 || memory > 1700 || online > 290) {
      this.level = 2;
      this.applyHeavyDegradation();
    }
    // 轻度降级
    else if (cpu > 1.5 || memory > 1500 || online > 250) {
      this.level = 1;
      this.applyLightDegradation();
    }
    // 恢复正常
    else if (this.level > 0) {
      this.level = 0;
      this.restore();
    }
  }
  
  applyLightDegradation() {
    eventConfig.TRIGGER_RATE = 0.5;
    syncConfig.INTERVAL = 10000;
  }
  
  applyHeavyDegradation() {
    eventConfig.TRIGGER_RATE = 0.2;
    syncConfig.INTERVAL = 30000;
    connectionPool.maxConnections = 250;
  }
  
  restore() {
    eventConfig.TRIGGER_RATE = 1.0;
    syncConfig.INTERVAL = 5000;
    connectionPool.maxConnections = 300;
  }
}
```

---

## 二、安全与保护

### 2.1 核心理念

```
代码 < 数据 < 运营 < 社区

即使代码被抄袭：
✅ 你有先发优势
✅ 你有玩家社区
✅ 你有运营经验
✅ 你有持续更新
✅ 你有原创声誉
```

### 2.2 优先级

1. **游戏体验** > 代码保护
2. **活跃社区** > 数据保护
3. **持续更新** > 技术壁垒
4. **优质运营** > 一切防护

### 2.3 现实情况

**Web游戏的本质**：
- ❌ 前端代码100%可以被查看
- ❌ 前端数据100%可以被获取
- ❌ 没有任何方法可以完全防止
- ✅ 可以大幅提高窃取难度
- ✅ 可以保护核心商业逻辑

### 2.4 分阶段保护策略

#### 阶段1：开发期（当前）

**策略**：开放开发，快速迭代

```
✅ 公开GitHub仓库
✅ 代码和数据都在前端
✅ 专注于功能开发
✅ 添加版权声明
```

**实施**：
```javascript
/**
 * 真三风云 (San Storm)
 * Copyright (c) 2026 [你的名字/团队]
 * All rights reserved.
 * 
 * 未经授权，禁止复制、修改、分发本软件
 */
```

#### 阶段2：测试期（有玩家后）

**策略**：基础保护

```
✅ 代码混淆和压缩
✅ 敏感数据加密
✅ 添加基础API保护
⚠️ 仍然是公开仓库
```

**实施**：

1. **代码混淆**
```javascript
// vite.config.js
export default {
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
    },
  },
};
```

2. **数据加密**
```javascript
import CryptoJS from 'crypto-js';

const encryptedData = CryptoJS.AES.encrypt(
  JSON.stringify(sensitiveData),
  'your-secret-key'
).toString();
```

3. **API频率限制**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use('/api/', limiter);
```

#### 阶段3：商业化期（有收入后）

**策略**：核心数据服务器化

```
✅ 私有GitHub仓库
✅ 核心数据放服务器
✅ 战斗验证服务器端
✅ API签名和频率限制
✅ 前端只保留UI和基础逻辑
```

**架构**：
```
前端（客户端）          后端（服务器）
├─ UI界面              ├─ 武将完整数据
├─ 游戏逻辑            ├─ 技能完整数据
├─ 基础数据（展示用）   ├─ 事件完整数据
└─ 请求服务器          ├─ 战斗验证
                       └─ 反作弊系统
```

---

## 三、知识产权

### 3.1 不构成侵权的部分

#### 游戏机制/规则
- ❌ **不受版权保护**
- 游戏玩法、规则、系统本身不受版权保护
- 示例：回合制、属性系统、技能系统等机制
- 参考其他游戏的机制是合法的

#### 历史人物和事件
- ❌ **不受版权保护**
- 三国历史人物（刘备、关羽、曹操等）是公共领域
- 历史事件（桃园结义、赤壁之战等）是公共领域
- 任何人都可以使用

#### 通用概念和名词
- ❌ **不受版权保护**
- "飞将"、"神速"、"鬼才"等是通用词汇
- 这些词汇在历史文献中早已存在
- 不是任何游戏的专有名词

### 3.2 可能有风险的部分

#### 特定的技能组合和数值
- 如果完全照搬某游戏的技能效果和数值
- 可能被认为是"实质性相似"
- **解决方案**：参考但不照搬，修改具体效果

#### UI/美术资源
- ⚠️ **绝对不能使用**
- 图片、音乐、界面设计等受版权保护
- 必须使用原创或授权资源

### 3.3 安全做法

**保留历史典故名称，修改具体效果**：

```javascript
// 示例1：飞将
// 三国志11：移动+1，无视ZOC
// 我们的游戏：移动+1，无视地形，冲锋+20%（新增效果）

飞将: {
  effects: {
    cavalryMovement: 1,
    ignoreTerrainPenalty: true,
    chargeBonus: 0.2,  // 新增效果
  }
}

// 示例2：鬼才
// 三国志11：计谋成功率+30%
// 我们的游戏：计谋成功率+30%，计谋伤害+20%，计谋消耗-20%

鬼才: {
  effects: {
    strategySuccessBonus: 0.3,
    strategyDamageBonus: 0.2,   // 新增
    strategyCostReduction: 0.2,  // 新增
  }
}
```

**关键点**：
- ✅ 技能名称：历史典故（公共领域）
- ✅ 技能效果：参考但有明显差异
- ✅ 游戏机制：有很多创新
- ✅ 美术资源：独立创作

### 3.4 法律保护

**版权声明模板**：
```javascript
/**
 * 真三风云 (San Storm)
 * 
 * Copyright (c) 2026 [你的名字/团队]
 * All rights reserved.
 * 
 * 本软件及其文档受版权法保护。
 * 未经版权所有者明确书面许可，不得：
 * - 复制、修改本软件
 * - 分发、出售本软件
 * - 创建衍生作品
 * 
 * 违反者将承担法律责任。
 */
```

**游戏内版权信息**：
```
真三风云 (San Storm)
版本：1.0.0
Copyright © 2026 [你的名字/团队]
保留所有权利

本游戏为原创作品，受版权法保护。
游戏中的创意、机制、数据均为原创。
```

---

## 四、实施计划

### 4.1 性能优化

**阶段1：基础优化（立即实施）**
- [x] 客户端计算架构
- [ ] 异步对战模式
- [ ] 数据库索引优化
- [ ] Redis缓存层

**阶段2：性能优化（开发期间）**
- [ ] 数据压缩
- [ ] 批量同步
- [ ] 连接池管理
- [ ] Nginx配置

**阶段3：监控预警（上线前）**
- [ ] 性能监控
- [ ] 自动降级
- [ ] 日志系统
- [ ] 备份方案

### 4.2 安全保护

**当前阶段（开发期）**

必须做：
- [x] 添加版权声明到代码中
- [x] 在游戏中添加版权信息
- [x] 保持Git历史完整
- [x] 记录设计文档

不需要做：
- [ ] 代码混淆（暂时不需要）
- [ ] 数据加密（暂时不需要）
- [ ] 私有仓库（暂时不需要）

**未来阶段（测试期）**
- [ ] 配置Vite代码混淆
- [ ] 实现基础数据加密
- [ ] 添加API频率限制

**未来阶段（商业化期）**
- [ ] 核心数据服务器化
- [ ] 战斗验证服务器端
- [ ] API签名验证
- [ ] 私有GitHub仓库

---

## 五、成本估算

### 当前配置（2核2G）
- 月费用: 约 ¥50-100
- 支持: 500注册用户, 200-300在线

### 未来扩展（如需要）
- 升级到 4核4G: 约 ¥150-200/月
- 支持: 2000注册用户, 500-800在线

---

## 六、总结

### 性能优化

通过以上优化方案，2核2G服务器完全可以支持：
- ✅ 500注册用户
- ✅ 200-300同时在线
- ✅ 流畅的游戏体验
- ✅ 低延迟（<100ms）

**关键**：客户端计算 + 异步对战 + 智能缓存

### 安全保护

**核心原则**：
1. **开发期**：专注开发，不过度保护
2. **测试期**：基础保护，防止简单抄袭
3. **商业化期**：核心保护，服务器验证

**最重要的**：
- 💪 **好的游戏体验** > 代码保护
- 💪 **活跃的社区** > 数据保护
- 💪 **持续的更新** > 技术壁垒
- 💪 **优质的运营** > 一切防护

### 知识产权

**可以放心使用**：
- ✅ 历史人物和事件（公共领域）
- ✅ 通用概念和名词（公共领域）
- ✅ 游戏机制和规则（不受版权保护）

**需要注意**：
- ⚠️ 技能效果要有差异化
- ⚠️ 美术资源必须原创

**真正的护城河**：
- ✅ 先发优势
- ✅ 原创声誉
- ✅ 玩家基础
- ✅ 运营经验
- ✅ 创新能力

---

**文档创建者**: Kiro AI  
**创建日期**: 2026-02-09  
**最后更新**: 2026-02-09  
**文档版本**: v1.1.0

---

## 七、服务器性能分析与压力测试

**基于**: PERFORMANCE_ANALYSIS.md v1.0.0  
**测试场景**: 极限压力测试（400人在线，300人同时战斗）

### 7.1 测试场景设定

#### 基础参数
- **同时在线**: 400人
- **同时战斗**: 300人
- **战斗时长**: 平均2分钟/场
- **战斗频率**: 150场/分钟（300人÷2分钟）

#### 单场战斗数据量估算
```javascript
const singleBattleSize = {
  battleBasic: 1,            // 1KB - 战斗基础信息
  playerData: 4,             // 4KB - 双方玩家数据（2×2KB）
  troopData: 5,              // 5KB - 部队数据（10支×0.5KB）
  roundData: 30,             // 30KB - 回合数据（15回合×2KB）
  actionData: 15,            // 15KB - 动作数据（150个×0.1KB）
  statisticsUpdate: 2,       // 2KB - 统计数据更新
  total: 57,                 // 总计约57KB/场
};
```

### 7.2 极限压力测试分析

#### 数据写入压力
```
每分钟数据量: 150场 × 57KB = 8.35MB/分钟
每秒数据量: 142.5KB/秒
每小时数据量: 501MB/小时
每天数据量（高峰6小时）: 3GB/天
```

#### 数据库操作压力
```javascript
const writeOperations = {
  battleCreate: 1,           // 创建战斗记录
  roundUpdate: 15,           // 15回合更新
  battleComplete: 1,         // 完成战斗记录
  playerStatsUpdate: 2,      // 更新双方统计数据
  troopUpdate: 10,           // 更新部队兵力
  resourceUpdate: 2,         // 更新资源
  questProgress: 2,          // 更新任务进度
  achievementCheck: 2,       // 检查成就
  total: 35,                 // 总计35次写入操作/场
};

// 每秒数据库操作
// 写入: 87.5次/秒
// 读取: 75次/秒
// 总计: 162.5次/秒
```

### 7.3 数据库性能评估

#### MongoDB性能基准（2核2G配置）
- **单机性能**: 500-1,500 ops/秒（共享资源）
- **我们的需求**: 162.5 ops/秒（未优化）
- **性能余量**: 500 ÷ 162.5 = 3.08倍

**结论**: ⚠️ 性能余量较小，必须优化

### 7.4 优化策略详解

#### 批量写入优化
```javascript
// ❌ 不好的做法：每个动作都写入
for (let i = 0; i < 15; i++) {
  await db.battles.updateOne({ battleId }, { $push: { rounds: roundData } });
}

// ✅ 好的做法：批量写入
const rounds = [];
for (let i = 0; i < 15; i++) {
  rounds.push(roundData);
}
await db.battles.updateOne({ battleId }, { $push: { rounds: { $each: rounds } } });
```

**优化效果**: 15次写入 → 1次写入（减少93%）

#### 缓存策略优化
```javascript
const playerCache = {
  ttl: 300,                  // 5分钟过期
  
  async getPlayer(playerId) {
    // 1. 先从Redis读取
    let player = await redis.get(`player:${playerId}`);
    
    if (player) {
      return JSON.parse(player);
    }
    
    // 2. Redis没有，从MongoDB读取
    player = await db.players.findOne({ playerId });
    
    // 3. 写入Redis缓存
    await redis.setex(`player:${playerId}`, this.ttl, JSON.stringify(player));
    
    return player;
  }
};
```

**优化效果**: 缓存命中率90%时，数据库读取减少90%

#### 异步写入优化
```javascript
async function completeBattle(battleId) {
  // 1. 立即返回战斗结果给玩家
  const result = calculateBattleResult(battleId);
  sendToClient(result);
  
  // 2. 异步更新统计数据（不阻塞玩家）
  updateStatisticsAsync(battleId).catch(err => {
    logger.error('Statistics update failed', err);
  });
}
```

**优化效果**: 玩家体验流畅，统计数据延迟更新

### 7.5 优化后的性能估算

#### 优化效果计算
```javascript
const optimized = {
  // 1. 批量写入：15次 → 1次
  writeReduction: 0.93,      // 减少93%
  
  // 2. 缓存命中：90%读取从缓存
  readReduction: 0.90,       // 减少90%
  
  // 3. 异步更新：统计数据异步
  asyncUpdate: 0.30,         // 减少30%阻塞
  
  // 最终结果
  databaseOps: 162.5 * (1 - 0.93) * (1 - 0.90) = 1.14, // ops/秒
  dataWrite: 142.5 * (1 - 0.30) = 99.75, // KB/秒
};
```

#### 优化后性能评估
- **数据库操作**: 162.5 ops/秒 → **1.14 ops/秒**（减少99.3%）
- **数据写入**: 142.5KB/秒 → **99.75KB/秒**（减少30%）
- **性能余量**: 500 ÷ 1.14 = **438倍**

### 7.6 2核2G配置最终评估

#### 未优化情况
- ⚠️ **数据库压力**: 162.5 ops/秒（性能余量3.08倍，较小）
- ⚠️ **带宽压力**: 1.76Mbps（58.7%使用率）
- ⚠️ **内存压力**: 紧张

#### 优化后情况
- ✅ **数据库压力**: 1.14 ops/秒（性能余量438倍）
- ✅ **带宽压力**: 0.47Mbps（15.7%使用率）
- ✅ **内存压力**: 刚好够用

#### 实际承载能力（优化后）
```javascript
const capacity = {
  // 数据库瓶颈
  dbLimit: 500 / 1.14,       // 438人
  
  // 带宽瓶颈
  bandwidthLimit: 3 / 0.47 * 300, // 1,915人
  
  // 内存瓶颈
  memoryLimit: 400 / 35 * 1000, // 11,428人（缓存限制）
  
  // 实际瓶颈（取最小值）
  actualLimit: 438,          // 438人
  
  // 安全余量（80%）
  safeLimit: 438 * 0.8,      // 350人
};
```

#### 推荐配置
- **最大在线**: 300人
- **同时战斗**: 200人
- **性能余量**: 充足
- **扩展方式**: 横向扩展（多服务器）

### 7.7 必须优化项（2核2G配置）

#### 高优先级（必须）
1. ✅ **Redis缓存** - 减少90%数据库读取
2. ✅ **批量写入** - 减少93%数据库写入
3. ✅ **数据压缩** - 节省73%带宽
4. ✅ **异步更新** - 统计数据不阻塞战斗

#### 中优先级（推荐）
1. ✅ **战斗排队** - 避免峰值超载
2. ✅ **内存限制** - Redis最大400MB
3. ✅ **连接池限制** - MongoDB最大20连接

### 7.8 监控指标

#### 关键指标
```javascript
const metrics = {
  // 数据库
  dbOpsPerSecond: 0,         // 数据库操作/秒
  dbResponseTime: 0,         // 数据库响应时间
  
  // 缓存
  cacheHitRate: 0,           // 缓存命中率
  cacheMemoryUsage: 0,       // 缓存内存使用
  
  // 战斗
  activeBattles: 0,          // 活跃战斗数
  avgBattleTime: 0,          // 平均战斗时长
  
  // 玩家
  onlinePlayers: 0,          // 在线玩家数
  concurrentBattles: 0,      // 并发战斗数
};
```

#### 告警阈值
```javascript
const alerts = {
  dbOpsPerSecond: 1000,      // 超过1000 ops/秒告警
  dbResponseTime: 100,       // 超过100ms告警
  cacheHitRate: 0.80,        // 低于80%告警
  onlinePlayers: 450,        // 超过450人告警（接近上限）
};
```

### 7.9 最终结论

#### 当前配置评估（2核2G）

**未优化情况**：
- ⚠️ 数据库：性能余量3倍（较小）
- ⚠️ 带宽：峰值可能超出
- ⚠️ 内存：紧张

**优化后情况**：
- ✅ 数据库：性能余量438倍（充足）
- ✅ 带宽：性能余量6.4倍（充足）
- ✅ 内存：刚好够用

#### 实际承载能力

**保守估算**：
- 最大在线：350人
- 同时战斗：230人

**推荐配置**：
- 最大在线：300人
- 同时战斗：200人
- 服务器上限：300人/服

#### 风险评估

**技术风险**：中等
- 需要做好优化
- 需要监控性能

**性能风险**：低
- 优化后性能充足
- 有一定余量

**扩展风险**：低
- 可以横向扩展（多服务器）
- 可以垂直扩展（升级配置）

#### 最终建议

**阶段1：初期（0-100人）**
- 当前配置足够
- 基础优化即可

**阶段2：成长期（100-300人）**
- 启用所有优化
- 密切监控性能

**阶段3：扩展期（300+人）**
- 考虑升级到4核4GB
- 或者开设第二个服务器

**结论**：2核2G配置经过优化后，可以稳定支持300人在线、200人同时战斗。只要做好优化，完全够用！💪

---

**性能分析文档整合完成**  
**原文档**: PERFORMANCE_ANALYSIS.md v1.0.0  
**整合日期**: 2026-02-11