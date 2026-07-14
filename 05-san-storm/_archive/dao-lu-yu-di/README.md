# 道路遇敌 PVP（road encounter）功能档案

**归档日期**：2026-07-13  
**Git tag**：`archive/dao-lu-yu-di-2026-07-13`（仓库根：`notee`，指向创建前 `HEAD`）  
**状态**：玩法重构前快照；**本轮仅备份**。主线计划**移除道路遭遇战**，**保留**战略道路行军（`road/move` / 坐标 / `road/self`）。  
**对决基建**：`17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md` 与 `runPvpTacticalDuel` **不在本档案删除范围**（后续另入口进入对决）。

---

## 1. 产品边界

| 属于本档案（道路遇敌 PVP） | 不属于（勿当遇敌删除） |
|----------------------------|------------------------|
| `road_encounters` 同格登记、`fighting` 锁格 | 道路行军 `POST …/road/move`、粮草步进 |
| 权威裁定 `encounter-authoritative-resolve` / outcome | `players.road_jun_id` / `road_position_*` 坐标同步 |
| 攻方 10s 弹窗 + 守方 `RoadEncounterDefenseRoot` poll | `GET …/road/self`、`GET /cities/road-presence`（占格展示） |
| 来战 `road_intercept`（为遇敌服务） | `17-5-2` 战术自动对决实现稿 |
| `roadEncounterSettlement` 遇敌映射 | `runPvpTacticalDuel`、战术房、`PvpTacticalBattleShell` |

主文档：

- `docs/01-jun-exploration/30-frontend/31-6-STRATEGIC_ROAD_MARCH.md`（行军 + 遇敌触发）
- `docs/01-jun-exploration/10-core-system/17-5-DUEL_SYSTEM.md` §5 场景 B
- `docs/01-jun-exploration/10-core-system/17-5-3-DUEL_REAL_CHAIN_MIGRATION.md`（道路权威链段落）
- `docs/00/00-base/02-architecture-split/12-road-encounter-api.md`

本目录 `docs/` 下为上述文件的**完整拷贝**（归档时点）。

---

## 2. 如何从 Git 整仓还原

```bash
cd /path/to/notee
git fetch --tags   # 若 tag 已 push
git checkout archive/dao-lu-yu-di-2026-07-13
# 或：git worktree add ../san-storm-dao-lu-archive archive/dao-lu-yu-di-2026-07-13
```

---

## 3. 专属 / 近专属代码（已拷贝到 `code/`）

见 `FILE_MANIFEST.txt`。摘要：

| 路径 | 角色 |
|------|------|
| `backend/services/roadEncounterService.js` | 遭遇载荷、权威裁定入口、战果写入 |
| `backend/services/road/roadMoveAlongService.js` | 行军权威；**含**敌对同格遭遇 INSERT（与行军同文件） |
| `backend/services/road/roadInterceptService.js` | 来战开关 |
| `backend/services/road/roadPresenceService.js` | presence + pending 守方遭遇 |
| `backend/services/road/roadStaleCleanup.js` | 过期 fighting 清理 |
| `backend/routes/players/road.js` | `/road/*` 全路由（含遇敌段） |
| `game/.../RoadEncounterDefenseRoot.jsx` | 守方常驻 poll + 回放结算 |
| `game/.../RoadDefenseFrictionContext.jsx` | 与 WorldMap 互斥桥 |
| `game/.../useRoadSelfPresencePoll.js` | `road/self`；含 fighting 恢复 |
| `game/.../roadEncounterSettlement.js` | 遇敌 → 结算卡映射 |
| `game/.../useWorldMapStrategicBattles.js` | 攻方道路遭遇分支（整文件；也含攻城/匪寨） |
| `shared/utils/roadEncounterLockPassage.js` | 锁格通行规则 |
| 迁移 `create-road-encounters.sql` 等 | DB |

**强耦合、未整文件拷贝（还原时对照主仓 / `COUPLED_INDEX.md`）**：

- `WorldMap.jsx` — `roadFriction` / `roadAttacker*` / `onRoadEncounterBattle`
- `StrategicWorldMapSection.jsx` — 锁格、遇敌 toast
- `StrategicMapSelfPawn.jsx` — 来战 UI
- `GamePage.jsx` — 挂载 `RoadEncounterDefenseRoot`
- `playerApi.js` — encounter API 方法
- `aiPlayerDailyOrchestrator.js` — Step 7a `resolveRoadEncounterIfAny`
- `BattleTab.jsx` — `pvp_field` / `roadEncounterId` 回放

**共享战术核（禁止当遇敌专属删除）**：

- `shared/battle/tacticalSim/runPvpTacticalDuel.js`
- `backend/services/pvp/tactical/*`
- `docs/.../17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md`

---

## 4. 给其他项目复用时建议带走的

1. 本 README + `docs/` 设计口径（同格登记、10s 窗口、权威裁定、锁格规则）
2. `roadEncounterService.resolveAuthoritativeRoadEncounter` + `tacticalToAutoDuelResult` 适配思路
3. 攻守两侧 UI 分工：攻方 WorldMap 弹窗 vs 守方常驻 `RoadEncounterDefenseRoot`

不宜原样粘贴：与战略格网、郡道路数据、势力敌对判定强绑定的行军壳。

---

## 5. 主线移除清单（归档后执行，非本包内容）

1. 遇敌 API（`pending-encounter`、`encounter-*`、`resolve-encounter`）→ **410**；可选保留 `move` / `self` / `intercept`  
2. `moveAlongRoad` **跳过**敌对同格遭遇 INSERT；不再截断路径为遇敌  
3. 卸 `RoadEncounterDefenseRoot`、攻方道路遭遇弹窗、`roadFriction` 互斥  
4. 停 AI Step 7a 道路遭遇权威结算  
5. 文档 `31-6` / `17-5` §5 / `12-road` 标注道路遭遇已移除；**行军段落与 `17-5-2` 保留**  
6. 表 `road_encounters` 可先停写再考虑 deprecate；`players.road_*` 行军列保留  

---

## 6. Zip

同级：`dao-lu-yu-di-2026-07-13.zip`（含本目录全文）。
