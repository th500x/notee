# 强耦合文件索引（未整文件拷贝）

归档时这些文件同时服务道路遇敌 **与** 行军 / 攻城 / 匪寨等。完整内容以 Git tag `archive/dao-lu-yu-di-2026-07-13` 为准。

| 文件 | 道路遇敌相关锚点（搜索关键字） |
|------|-------------------------------|
| `game/src/components/game/WorldMap.jsx` | `roadFriction`、`roadAttacker`、`onRoadEncounterBattle`、`setRoadAttackerAlert` |
| `game/src/components/world/StrategicWorldMapSection.jsx` | `onRoadEncounterBattle`、`strategicRoadLockedCells`、`findActiveRoadEncounterLockOnCell`、遇敌 toast |
| `game/src/components/world/WorldStrategicMapGrid.jsx` | `strategicRoadLockedCells`、intercept 相关 props |
| `game/src/components/world/StrategicMapSelfPawn.jsx` | `setRoadIntercept`、`roadIntercept`、来战 UI |
| `game/src/components/world/WorldMapAlertOverlays.jsx` | `roadAttackerAlert`、道路遭遇弹窗 |
| `game/src/pages/GamePage.jsx` | `RoadEncounterDefenseRoot` |
| `game/src/services/playerApi.js` | `encounter-authoritative`、`pending-encounter`、`encounter-battle` |
| `backend/services/aiPlayerDailyOrchestrator.js` | `resolveRoadEncounterIfAny`、`resolveAuthoritativeRoadEncounter` |
| `game/src/components/comm/BattleTab.jsx` | `pvp_field`、`roadEncounterId` |
| `backend/routes/cities.js` | `road-presence`、`lockedCells`（遇敌锁格展示） |
| `backend/services/road/roadMoveAlongService.js` | **已整文件拷贝**；下线时只改遭遇 INSERT / 截断，勿整删行军 |

## 明确保留（非本档案删除目标）

| 资产 | 说明 |
|------|------|
| `17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md` | 战术自动对决实现；后续另入口 |
| `shared/battle/tacticalSim/runPvpTacticalDuel.js` | 共享战术核 |
| `backend/services/pvp/tactical/*` | 战术房 / runner / adapter |
| `game/src/pvp/tactical/PvpTacticalBattleShell.jsx` | 通用回放壳 |
| `POST …/road/move` · `GET …/road/self` | 战略行军（计划保留） |
