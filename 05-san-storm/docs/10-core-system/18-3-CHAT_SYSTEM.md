# 聊天系统设计文档

**文档版本**：v1.3.0  
**最后更新**：2026-03-29  
**状态**：**部分实装** — 后端 HTTP + MySQL `chats`、前端通信浮层「聊天」Tab（`CommPanel` / `ChatTab` + `chatApi`）已上线并可联调；列表为 **轮询刷新**（约 25s）。**WebSocket 实时推送**、**Redis**、运营风控（举报/禁言）仍为后续。表结构以 [01-1-DATABASE_DESIGN.md](../00-base/01-1-DATABASE_DESIGN.md) §3.2.16 为准。

**仓库**：本页所述实装已随 `05-san-storm` 提交至 **GitHub**（`main`）；生产部署需执行 `create-chats-table.sql` 等迁移（见 §「实装对照」与 [DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md)）。

**文档说明**：早期由 Kiro 助手起草初版（频道与防刷思路）；本节已按本项目口径整理章节、**势力频道展示名**、**技术分期（MySQL / WebSocket / Redis）** 与 [12-POSITION_SYSTEM.md](12-POSITION_SYSTEM.md) 的 `position_level` 约定对齐。

**关联文档**：[01-1 §3.2.14–3.2.16](../00-base/01-1-DATABASE_DESIGN.md)、[12-POSITION_SYSTEM.md](12-POSITION_SYSTEM.md)、[92-1-GAME_UI_DESIGN.md](../90-assets/92-1-GAME_UI_DESIGN.md) §1.7（通信浮层第三 Tab）、[18-1](18-1-BATTLE_REPORT_SYSTEM.md) / [18-2](18-2-TEXT_SYSTEM.md)（战报与传书已实装，聊天与之并列）

**官职口径**：「都尉」「中郎将」为玩家可读表述；服务端一律用 `position_level` 数值比较（**数字越小官职越高**），与 12 文档一致。

### 实装对照（全栈，2026-03-29）

| 能力 | 说明 |
|------|------|
| 迁移 | `backend/database/migrations/create-chats-table.sql`；本地批量脚本 `backend/scripts/apply-pending-local-ddl.js` 已含此文件 |
| 服务 | `backend/services/chatService.js`（冷却/日限/官职、`legion_members` 校验、`getLegionForPlayer`） |
| 路由 | `backend/routes/chats.js`：`POST/GET /api/chats`、`GET /api/chats/legion-info` |
| 注册 | `backend/server.js`：`app.use('/api/chats', chatsRouter)` |
| 军团查询 | `GET /api/chats/legion-info?playerId=` → `{ legionId, legionName } \| null`（无表/无成员时 `null`） |
| 前端 | `game/src/services/chatApi.js`；`game/src/components/game/CommPanel.jsx` 内 `ChatTab`（天下 / 势力名 / 军团子 Tab，手动与定时刷新） |

**POST** `body`: `{ playerId, channelType, channelId?, content }` — `world` 时忽略 `channelId`。  
**GET** `query`: `playerId`, `channelType`, `channelId?`, `limit?` — 读势力/军团频道时校验归属。

---

## 1. 核心概念

| 维度 | 说明 |
|------|------|
| **聊天** | 实时公屏：在线可见，多频道，短文本（≤100 字），保留 **3 天**（`expires_at`，见 01-1 §3.2.14） |
| **与传书区别** | 传书异步、私密/系统收件箱（`texts`）；聊天同步、频道广播（`chats`） |
| **与战报区别** | 战报为战斗归档（`battles`）；聊天不参与战斗存储 |

---

## 2. 频道总览

| 频道 | Tab 展示 | `channel_type` | `channel_id` | 可见范围 | 发言门槛（`position_level`） | 冷却 | 每日上限 |
|------|----------|----------------|--------------|----------|-------------------------------|------|----------|
| 天下 | **天下** | `world` | `NULL` | 全服 | ≤7（都尉起） | 30s | 50 |
| 势力 | **势力名**（见 §2.1） | `faction` | 势力 ID | 本势力 | ≤7 | 10s | 50 |
| 军团 | **军团**（或军团简称） | `legion` | 军团 ID | 本军团 | ≤5（中郎将起） | 10s | 50 |

### 2.1 势力频道与「势力名」

- **存储**：`channel_type = 'faction'` 时，`channel_id` = `faction_id`（如 `san_1_faction_1001`），与 `players.faction_id` 一致。
- **Tab / 列表前缀展示**：使用 **势力展示名**（如 **刘备**、**曹操**），取自 **`config_factions.faction_name`** 或赛季配置中与本项目一致的势力名称字段；**不**使用「州名」作为主展示——全州名与地图州域规则尚未单独成文，避免与未完备定义耦合。
- **消息行展示**：可与战报/传书 UI 一致，用势力主公或势力标签区分（如 `[刘备] 玩家名 …`），具体以 [92-1](../90-assets/92-1-GAME_UI_DESIGN.md) 为准。

### 2.2 配置常量（与实现共享）

```javascript
// 与 12-POSITION_SYSTEM 一致：level 越小越高
export const CHAT_LIMITS = {
  world:   { maxPositionLevel: 7, cooldownMs: 30000, maxLength: 100, dailyLimit: 50 },
  faction: { maxPositionLevel: 7, cooldownMs: 10000, maxLength: 100, dailyLimit: 50 },
  legion:  { maxPositionLevel: 5, cooldownMs: 10000, maxLength: 100, dailyLimit: 50 },
};
```

---

## 3. 数据库（与 01-1 一致）

表定义、索引与字段说明见 **01-1 §3.2.16 `chats`**。要点：

- 自增 `chat_id`；`channel_type` ∈ `world|faction|legion`。
- 发送者冗余字段降低 JOIN；**权威仍以落库为准**。
- 建议插入时即写入 `expires_at = created_at + 3 天`，便于清理任务与查询。

---

## 4. 业务规则摘要

**发送**：校验登录、频道权限（势力/军团归属）、`position_level`、冷却、每日条数、长度、敏感词（与项目统一策略）。

**拉取列表**：按频道查询最近 **100** 条（时间倒序）。**当前阶段**：直接读 **MySQL**；不依赖 Redis。

**清理**：定时任务删除 `expires_at < NOW()` 的行（批量上限可配置）。

---

## 5. API 约定（目标形态）

与现有 `express` 风格、`/api` 前缀及认证方式保持一致（具体路径以实现为准）。

| 方法 | 路径（示例） | 说明 |
|------|----------------|------|
| `POST` | `/api/chats` | body：`channelType`, `channelId`, `content` |
| `GET` | `/api/chats?channelType=world&limit=100` | 分页/限制与项目惯例一致 |

响应字段需包含前端展示所需：`chatId`, `channelType`, `channelId`, `senderId`, `senderName`, `senderFactionId`, `content`, `createdAt`；势力频道可选返回 **`channelLabel`**（势力展示名，服务端 JOIN `config_factions` 或由前端根据 `senderFactionId` 映射，二选一避免重复逻辑）。

---

## 6. 实现步骤（建议顺序）

以下为开发执行顺序，便于与战报/传书同一通信浮层迭代。

| 阶段 | 内容 | 说明 |
|------|------|------|
| **1** | 迁移 + 本地库 | 若尚无 `chats` 表，按 01-1 §3.2.16 建表；本地执行迁移（见 [DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md)） |
| **2** | 后端 CRUD | `chatService`：插入（写 `expires_at`）、按频道查询、冷却/每日计数（**先用 MySQL 或应用内存 + DB 统计**，见 §7） |
| **3** | HTTP API | `POST/GET` 路由、鉴权、`position_level` 与势力/军团校验 |
| **4** | WebSocket | 与现有 Node 进程集成（socket.io 或项目已有方案）；房间：`world` 广播，`faction:{id}`，`legion:{id}`；先发后推，失败回滚或补偿 |
| **5** | 前端通信浮层第三 Tab | ✅ 已做：`ChatTab` + `chatApi`；**今日余量** UI 可后续补；冷却以后端报错为准 |
| **6** | 定时清理 | 与 01-1 §3.2.14 一致，可与其他通信表清理任务同机或同进程调度 |

---

## 7. 技术分期：MySQL 与 Redis

| 能力 | 当前阶段 | 后续（可选） |
|------|----------|--------------|
| 消息持久化 | **MySQL `chats`** | — |
| 列表查询 | **MySQL 索引 `idx_channel`** | 热点再考虑读优化 |
| 冷却 / 日限 | **DB 查询 + 唯一约束或事务**；或后续迁 Redis | **Redis** 计数与 TTL（文档推荐形态，**待接入**） |
| 最新 100 条缓存 | **不依赖** | **Redis List + LTRIM**（见下节「后续」） |

**原则**：未部署 Redis 前，**不得**假设存在缓存；**以 MySQL 与接口返回为权威**。

---

## 8. 前端要点（摘要）

- 入口：通信浮层第三 Tab；样式与战报/传书 Tab 统一（间距、字体、暗色/琥珀主题等沿用现有组件）。
- 频道 Tab 文案：**天下** | **势力展示名** | **军团**（军团名若有过长省略规则，与 UI 规范一致）。

---

## 9. 实时推送（伪代码方向）

服务端在 `POST` 成功写入 DB 后，向对应 namespace 推送（与 §6 阶段 4 一致）。示例逻辑（非绑定 Mongo API）：

```javascript
// 权限：position_level 越小越高 → 都尉：level <= 7；中郎将：level <= 5
function canChatWorld(positionLevel) { return positionLevel <= 7; }
function canChatFaction(playerFactionId, channelFactionId, positionLevel) {
  return playerFactionId === channelFactionId && positionLevel <= 7;
}
function canChatLegion(playerLegionId, channelLegionId, positionLevel) {
  return playerLegionId === channelLegionId && positionLevel <= 5;
}
```

---

## 10. 防刷屏（必选逻辑）

- 冷却、每日上限、长度、敏感词、重复内容检测：**首版可在应用层 + MySQL 实现**。
- 文档中若出现「Redis 冷却键」：**实现上等价于** Redis 接入后的优化，**当前可省略 Redis**。

---

## 11. 后续实现（未纳入首版）

以下**不阻塞**聊天 MVP，单独排期：

| 类别 | 内容 |
|------|------|
| **缓存** | Redis：最新消息列表、冷却键、热点读 |
| **运营与风控** | 举报、禁言、审计表、管理后台 |
| **体验** | 表情、快捷短语、气泡、撤回 |
| **其它** | 语音、导出、主题、AI 回复等 |

---

## 12. 更新日志

### v1.3.0 (2026-03-29)
- **前端**：`chatApi` + `CommPanel` `ChatTab` 对接 `POST/GET /api/chats` 与 `legion-info`；通信浮层第三 Tab 可玩。
- **文档**：实装对照改为全栈说明；补充仓库已提交 GitHub、生产须跑迁移、轮询与后续 WebSocket/Redis 边界。
- **后端**：`GET /api/chats/legion-info`、`getLegionForPlayer`（与前端军团 Tab 联动）。

### v1.2.1 (2026-03-29)
- 后端：`chats` 迁移、`chatService`、`/api/chats`；文档增加 **实装对照**。

### v1.2.0 (2026-03-29)
- 重写章节结构；补充 **§6 实现步骤**、**§7 MySQL/Redis 分期**。
- 频道「州名」改为 **势力展示名**；与全州域规则解耦。
- Redis 标记为 **后续**；举报/禁言等归入 **§11**。
- 权限伪代码与 `position_level` 方向修正说明。

### v1.1.0 (2026-03-29)
- 发言权限与 12 文档对齐。

### v1.0.0 (2026-03-10)
- 初版：频道、chats 表、API 草案、防刷思路。

---

**维护**：聊天落地后以 `backend/routes`、`services`、前端通信组件为准，本文同步更新「实装对照」表（可在首版合并后追加一节，格式同 18-2）。
