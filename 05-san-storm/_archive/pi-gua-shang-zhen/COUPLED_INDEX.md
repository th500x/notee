# 强耦合文件索引（未整文件拷贝）

归档时这些文件同时服务披挂 **与** 驻地/战事/道路等。完整内容以 Git tag `archive/pi-gua-shang-zhen-2026-07-13` 为准。

| 文件 | 披挂相关锚点（搜索关键字） |
|------|----------------------------|
| `backend/services/pvpWarService.js` | `getCityOnDutyDefenders`、`pvp_online`、`garrison_slot = 0`、`on_duty` |
| `backend/services/garrisonService.js` | `getCityOnDutyDefenders`、`clearInvalidOnDuty`、`on_duty_city_id` |
| `backend/services/cityService.js` | 易主 `SET on_duty = FALSE` |
| `backend/services/pvpService.js` | 遇袭窗口、`siege` challenge 内存态 |
| `backend/routes/pvp.js` | `siege-resolve` / siege outcome 轮询 |
| `backend/services/imperialMarchService.js` | 御驾不含披挂 PVP |
| `game/src/components/world/WorldStrategicMapGrid.jsx` | `getOnDutyCount`、`onDutyCount` |
| `game/src/components/game/WorldMap.jsx` | `usePvpDefenseAlertPoll`、`playerOnDuty` |
| `game/src/components/world/WorldMapCityInfoBlock.jsx` | **已拷贝全文**（同文件含「设为主城」+「披挂上阵」） |
| `shared/battle/tacticalSim/runPvpTacticalDuel.js` | 战术核（道路/切磋共用，删除披挂时**保留**） |

移除披挂时：改队列与清 API，**不要**删除 `runPvpTacticalDuel`。
