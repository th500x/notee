# 真三风云 · 后端架构说明（阶段优化）

本文档与当前代码（`routes/` + `services/`）对齐，便于后续继续拆分与维护。

## 原则

- **路由层（`routes/*.js`）**：只做 HTTP 映射、参数读取、状态码与 JSON 形状；不写复杂业务。
- **服务层（`services/*.js`）**：承载业务规则、事务性数据库操作、可单测的逻辑。
- **对外契约**：路径、请求体、响应 JSON 与既有前端/客户端保持兼容；重构不改变行为。

## 路由与服务对应关系（节选）

| 路由模块 | 职责摘要 | 主要服务 |
|---------|----------|----------|
| `routes/auth.js` | 注册、登录、会话等 | `accountService` |
| `routes/players.js` | 玩家、势力、探索、道具等 | `playerService`、`playerProfileService`、`playerEventRewardsService`、`playerExploreEventService`、`playerItemsService`、`playerExploreQuotaService`、`playerCardLineupService`、`playerRerollService` 等 |
| 其他 | 配置、战斗、卡池、城市等 | 各同名或领域服务 |

## 已落地的 `players` 拆分

- **`playerProfileService`**：例如 `GET /api/players/:playerId/profile`（含 `loadGameTimeForPlayer` 等与档案相关的逻辑）。
- **`playerEventRewardsService`**：`POST /api/players/:playerId/rewards` 的完整业务（运势、消耗与整编、`executeRewards`、迷你游戏/战斗结算字段、事件链完成写入等）。路由内仅调用 `executeEventRewards` 并返回 `ok` / `status` / `json` 或成功 `data`。
- **事件链 + 惩罚战斗**：带 `triggerBattle` 且运势为凶/大凶时，前端会先请求一次（无 `battleResult`）、战后再带 `battleResult`；仅在**非**「待战后结算」状态下写入链环完成，避免战后第二次请求被误判为「已完成」。

## 入口与前缀

- `server.js` 注册各 `app.use('/api/...', router)`。
- 生产环境经 nginx 时，前端可能请求 `/api/san-storm/*`；`server.js` 中间件会将该前缀剥为 `/api/*`，与本地直连端口行为一致。

## 前端（管理员 Hook，非后端）

- `game/src/hooks/useAdmin.js`：正式环境应使用 `useState(false)`，并在 `useEffect` 中根据 `tokenManager.isValid()` 同步登录态。本地调试若需临时放开管理员入口，仅限本地修改，**提交前须恢复**，避免将「全员管理员」带入仓库。
