# 披挂上阵（on_duty PVP）功能档案

**归档日期**：2026-07-13  
**Git tag**：`archive/pi-gua-shang-zhen-2026-07-13`（仓库根：`notee`，指向创建前 `HEAD`）  
**状态**：玩法 1 重构前快照；主线计划**移除**披挂，城池按钮位改由已有 **「设为主城」**（`main_city_id`）承担，**不**动驻地编组 / 军营背包。

---

## 1. 产品边界

| 属于本档案（披挂） | 不属于（勿当披挂删除） |
|--------------------|------------------------|
| `players.on_duty` / `on_duty_city_id` | `player_garrison` 驻地槽 1/2 |
| 攻城队列优先级 ① `pvp_online`（虚拟槽 `0`） | 驻地防守 ②、NPC ③ |
| 遇袭 10s 弹窗 + `siege-resolve` 权威结算 | 道路遭遇（共享战术核，须保留） |
| 城池 UI「🛡️ 披挂上阵」 | 「设为主城」（已实装，将保留/强化） |
| 战报积分倍率 `pvp_online = 2.0` | `GarrisonBackpack` / 编组 Tab |

主文档：

- `docs/01-jun-exploration/10-core-system/13-2-CITY_DEFENSE_SYSTEM.md` §5
- `docs/01-jun-exploration/10-core-system/17-5-DUEL_SYSTEM.md` §4
- `docs/01-jun-exploration/10-core-system/17-4-SIEGE_SYSTEM.md`（队列 ①）
- `docs/00/10-core-system/17-1-COMBAT_SYSTEM.md`（积分倍率表）

本目录 `docs/` 下为上述文件的**完整拷贝**（归档时点）。

---

## 2. 如何从 Git 整仓还原

```bash
cd /path/to/notee
git fetch --tags   # 若 tag 已 push
git checkout archive/pi-gua-shang-zhen-2026-07-13
# 或：git worktree add ../san-storm-pi-gua-archive archive/pi-gua-shang-zhen-2026-07-13
```

---

## 3. 专属 / 近专属代码（已拷贝到 `code/`）

见 `FILE_MANIFEST.txt`。摘要：

| 路径 | 角色 |
|------|------|
| `backend/services/pvp/auto-duel/pvpGarrisonAutoDuelResolveService.js` | 披挂权威结算入口 |
| `backend/services/siegePvpResolveService.js` | 可能为 re-export / 旧名兼容 |
| `backend/services/siegePvpSkirmish.js` | 披挂 skirmish 推演包装 |
| `backend/routes/garrisons.js`（on-duty 段） | `POST …/on-duty`、`GET …/on-duty-count` |
| `backend/middleware/validationSchemas/garrisons.js` | onDuty body |
| `game/src/services/garrisonApi.js`（onDuty 方法） | 前端 API |
| `game/src/hooks/usePvpDefenseAlertPoll.js`（若存在） | 守方遇袭轮询 |
| 迁移 `add-players-on-duty*.sql` | DB 列 |

**强耦合、未整文件拷贝（还原时对照主仓）**：

- `backend/services/pvpWarService.js` — 队列合并、`recordAttackerCitySiegeResult` 披挂分支
- `backend/services/garrisonService.js` — `getCityOnDutyDefenders` / 清 on_duty
- `backend/services/cityService.js` — 易主清披挂
- `backend/services/pvpService.js` — 内存挑战 / 遇袭窗口
- `game/.../WorldMapCityInfoBlock.jsx` — 披挂按钮与「设为主城」同面板
- `game/.../WorldStrategicMapGrid.jsx` — onDutyCount 拉取
- `shared/battle/tacticalSim/runPvpTacticalDuel.js` — **共享**战术核（道路/切磋也用，**禁止**当披挂专属删除）

---

## 4. 给其他项目复用时建议带走的

1. 本 README + `docs/` 设计口径（遇袭窗口、槽位 0 锁键、与驻地互斥入队）
2. `pvpGarrisonAutoDuelResolveService` + `tacticalToAutoDuelResult` 适配思路
3. 依赖清单：须自备「主阵容快照 → 战术推演 → 写回兵力/战报」管道

不宜原样粘贴：与 `wars_pvp`、城池势力、大地图 tooltip 绑定的 UI。

---

## 5. 主线移除清单（归档后执行，非本包内容）

1. 隐藏/删除「披挂上阵」按钮与 on-duty API 调用  
2. 攻城队列去掉 ①，仅 驻地 → NPC  
3. 停用 `siege-resolve` 披挂路径与守方遇袭 poll  
4. 文档 13-2 / 17-4 / 17-5 / 17-1 删改披挂段落  
5. DB 列可先保留并强制 `on_duty=FALSE`，再考虑 deprecate  

**UI 替换**：同面板已有「设为主城」；移除披挂后强化该入口即可（无需新建能力）。

---

## 6. Zip

同级或上级可生成：`pi-gua-shang-zhen-2026-07-13.zip`（含本目录全文）。
