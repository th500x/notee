/**
 * 赛季关服切换（rollover）服务（Phase 3 · 见 19-3 §6.4 / §6.5）
 *
 * 两个入口：
 *   - autoSealAccounts：方式2——对「未主动封档」的真人账号按规则自动封档（确定性取前 N）。
 *   - executeRollover：关服切换编排。**本实现仅支持 dryRun 报告 + 前置断言 + 自动封档**；
 *     世界态重置 / 删真人 players / 切 current_season 等**破坏性步骤未在此自动执行**，
 *     须按 19-3 §6.5/§6.6 在维护窗内人工/受控执行（避免半成品破坏性流程）。
 *
 * 封档逻辑复用 `seasonSettlementService.sealAccountInTx`（单源，禁止第二套）。
 * 自动取舍复用 `seasonSettlementCore` 的确定性排序清单（与玩家可选清单同序）。
 *
 * @module services/seasonRolloverService
 */

const path = require('path');
const { execFile } = require('child_process');
const { pool } = require('../database/connection');
const core = require('../../shared/utils/seasonSettlementCore.cjs');
const seasonSettlementService = require('./seasonSettlementService');

/**
 * §6.6 动态世界态清空表（child-first 顺序，已核对 information_schema FK）。
 * legions / legion_members 必须在删 players 前清空（legions.commander_id → players 为 RESTRICT）。
 */
const WORLD_RESET_CLEAR_ORDER = [
  'wars_pvp_policies', 'wars_pvp',
  'pvp_tactical_room_events', 'pvp_tactical_rooms',
  'legion_members', 'legions',
  'wars', 'battles',
  'texts', 'chats',
  'bandits', 'raids',
  'daily_report_digests',
  'faction_bulletins', 'faction_policies', 'faction_reserve', 'factions',
];

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** 运营面板展示用：按本机本地时区格式化为 MySQL DATETIME 样式（避免 JSON ISO UTC 误导运营） */
function formatDatetimeForOps(val) {
  if (val == null) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 读服务器赛季上下文（current_season + 窗口 + 目标赛季） */
async function loadServer(serverId) {
  const [rows] = await pool.query(
    `SELECT server_id, current_season, settlement_window_start, settlement_window_end, rollover_target_season
     FROM config_servers WHERE server_id = ?`,
    [serverId]
  );
  return rows[0] || null;
}

/** season_records 外键是否已指向 accounts（rollover 删 players 不得级联毁成绩） */
async function seasonRecordsFkPointsToAccounts() {
  const [rows] = await pool.query(
    `SELECT k.referenced_table_name AS ref
     FROM information_schema.key_column_usage k
     WHERE k.constraint_schema = DATABASE()
       AND k.table_name = 'season_records'
       AND k.referenced_table_name IS NOT NULL`
  );
  if (rows.length === 0) return false;
  return rows.every((r) => String(r.ref).toLowerCase() === 'accounts');
}

/** 该服真人账号（有 players 行）封档情况 */
async function listRealAccountsWithSealState(serverId, fromSeason, toSeason) {
  const [rows] = await pool.query(
    `SELECT a.id AS accountId,
            ss.status AS settlementStatus
     FROM accounts a
     JOIN players p ON p.player_id = a.id
     LEFT JOIN season_settlements ss
       ON ss.account_id = a.id AND ss.from_season = ? AND ss.to_season = ?
     WHERE a.account_type = 'real' AND a.serverId = ?`,
    [fromSeason, toSeason, serverId]
  );
  return rows;
}

/** 自动取舍：复用与玩家可选清单同序的确定性列表，取前 N */
function autoSelectFromCards(cards, limits) {
  const sets = core.listSelectableEquipmentSets(cards).map((s) => s.instanceId);
  const troops = core.listSelectableLegendaryTroops(cards).map((t) => t.instanceId);
  return {
    equipmentSetInstanceIds: sets.slice(0, limits.maxEquipmentSets),
    legendaryTroopInstanceIds: troops.slice(0, limits.maxLegendaryTroops),
  };
}

/**
 * 方式2：对未主动封档的真人账号自动封档。
 * @param {{ serverId: string, dryRun?: boolean }} args
 *   fromSeason/toSeason 由服务器配置推导（current_season / rollover_target_season）。
 */
async function autoSealAccounts({ serverId, dryRun = true } = {}) {
  const server = await loadServer(serverId);
  if (!server) return { ok: false, code: 'SERVER_CONFIG_MISSING', error: '服务器配置缺失' };
  const fromSeason = server.current_season;
  const toSeason = server.rollover_target_season;
  if (!toSeason) return { ok: false, code: 'ROLLOVER_TARGET_MISSING', error: '未配置 rollover_target_season' };

  let limits;
  try {
    limits = core.computeSelectionLimits(fromSeason);
  } catch (e) {
    return { ok: false, code: e.code || 'INVALID_SEASON', error: e.message };
  }

  const accounts = await listRealAccountsWithSealState(serverId, fromSeason, toSeason);
  const pending = accounts.filter((a) => a.settlementStatus == null || a.settlementStatus === 'pending_selection');

  const results = [];
  for (const acc of pending) {
    const accountId = acc.accountId;
    // 预读卡牌算自动取舍
    const [cards] = await pool.query(`SELECT * FROM player_cards WHERE player_id = ?`, [accountId]);
    const selection = autoSelectFromCards(cards, limits);

    if (dryRun) {
      results.push({
        accountId,
        sealed: false,
        dryRun: true,
        picked: {
          equipmentSets: selection.equipmentSetInstanceIds.length,
          legendaryTroops: selection.legendaryTroopInstanceIds.length,
        },
      });
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const ctx = await seasonSettlementService.loadContext(conn, accountId, { forUpdate: true });
      if (ctx.error) {
        await conn.rollback();
        results.push({ accountId, sealed: false, error: ctx.error.code || ctx.error.error });
        continue;
      }
      const sealed = await seasonSettlementService.sealAccountInTx(conn, {
        accountId,
        account: ctx.account,
        fromSeason,
        toSeason,
        limits,
        selection,
        source: 'auto_shutdown',
      });
      if (!sealed.ok) {
        await conn.rollback();
        results.push({ accountId, sealed: false, error: sealed.error.code || sealed.error.error });
        continue;
      }
      await conn.commit();
      results.push({ accountId, sealed: true, inheritedCardCount: sealed.snapshotCount });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      results.push({ accountId, sealed: false, error: e.message });
    } finally {
      conn.release();
    }
  }

  return {
    ok: true,
    dryRun,
    fromSeason,
    toSeason,
    totalReal: accounts.length,
    alreadySealed: accounts.length - pending.length,
    autoSealedAttempted: pending.length,
    autoSealedOk: results.filter((r) => r.sealed).length,
    results,
  };
}

/** 以子进程跑 import-city-geo-data.js（独立脚本，require 即执行 main，故不能直接 require） */
function runImportCityGeoData() {
  const script = path.join(__dirname, '../database/import-city-geo-data.js');
  return new Promise((resolve, reject) => {
    execFile('node', [script], { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`import-city-geo-data failed: ${err.message}\n${stderr || ''}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * §6.6 世界态重置：清空动态表 → 复用 import 重建 cities/factions 开局态 → 显式归零 import 未覆盖列。
 *
 * ⚠ 破坏性、全局（非按 server 隔离）；仅在 executeRollover 已过全部前置 + 双闸门后调用。
 * ⚠ `cities.npc_garrison` 为地图工具手动编辑值，import 的 ON DUPLICATE **不覆盖** → rollover **保留不重置**。
 *    `npc_garrison_alive`（战斗损耗账本）是否需重置回满编，待 Phase 4 克隆库实跑核对。
 *    `is_capital` 当前无业务逻辑读取（import 恒写 0），**保留**作为未来玩法预留列，不在此处理。
 */
async function resetWorldState() {
  for (const table of WORLD_RESET_CLEAR_ORDER) {
    await pool.query(`DELETE FROM \`${table}\``);
  }
  await runImportCityGeoData(); // 重建 factions（运行时）+ cities 开局态（UPSERT）
  // import 未覆盖的「残留玩家痕迹」列显式归零（lord_player_id/built_by_player_id 由 SET NULL 自动）
  await pool.query(
    `UPDATE cities SET
       lord_appointed_at = NULL,
       built_at = NULL,
       build_complete_at = NULL,
       custom_name = NULL,
       buildings_state = NULL`
  );
  // 人口/四维/城防：按 13-1 §5.5 整图重随（贴下限 100%～105%；关隘四维强制 0）
  const cityAttributeGrowthService = require('./cityAttributeGrowthService');
  const reseed = await cityAttributeGrowthService.reseedAllCityAttributes();
  if (!reseed.ok) {
    throw new Error(`[seasonRollover] city attr reseed failed: ${reseed.error || 'unknown'}`);
  }
  console.log(`[seasonRollover] city attr reseed updated=${reseed.updated} npcSynced=${reseed.npcSynced} date=${reseed.date}`);
  // reseed 已按人口×1%整表重掷 NPC；此处再把存活数钉回满编（幂等）
  await resetNpcGarrisonsToFull();
}

/**
 * 将所有城的 NPC 守军恢复满编：保留 import 不覆盖的 `npc_garrison` 编制结构，
 * 把每个单位 `alive=true`、`npc_garrison_alive = 单位数`。复用 cityService 的序列化/解析（单源）。
 */
async function resetNpcGarrisonsToFull() {
  const cityService = require('./cityService');
  const [rows] = await pool.query(`SELECT city_id, npc_garrison FROM cities WHERE npc_garrison IS NOT NULL`);
  for (const row of rows) {
    const { units } = cityService.parseNpcGarrisonStored(row.npc_garrison);
    if (!Array.isArray(units) || units.length === 0) continue;
    for (const u of units) {
      if (u && typeof u === 'object') u.alive = true;
    }
    await pool.query(
      `UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?`,
      [cityService.serializeNpcGarrisonStored(units, new Date()), units.length, row.city_id]
    );
  }
}

/**
 * 关服切换编排（Phase 3/4）。
 *
 * - `dryRun: true`（默认）：执行到步3止，输出报告，**不写任何数据**。
 * - `dryRun: false` 且 **`confirmDestructive` + `backupConfirmed` 同时为 true**：前置全过后执行破坏性步骤
 *   （世界重置 → 删真人 players → 切 current_season → accounts 更新）。任一闸门缺失则拒绝执行。
 *
 * @param {{ serverId: string, dryRun?: boolean, runAutoSeal?: boolean,
 *           confirmDestructive?: boolean, backupConfirmed?: boolean }} args
 */
async function executeRollover({ serverId, dryRun = true, runAutoSeal = false, confirmDestructive = false, backupConfirmed = false } = {}) {
  const server = await loadServer(serverId);
  if (!server) return { ok: false, code: 'SERVER_CONFIG_MISSING', error: '服务器配置缺失' };
  const fromSeason = server.current_season;
  const toSeason = server.rollover_target_season;
  if (!toSeason) return { ok: false, code: 'ROLLOVER_TARGET_MISSING', error: '未配置 rollover_target_season' };

  // 步0：FK 断言
  const fkOk = await seasonRecordsFkPointsToAccounts();

  // 步1：窗口是否已到 _end
  const end = server.settlement_window_end ? new Date(server.settlement_window_end) : null;
  const windowEnded = !!end && Date.now() >= end.getTime();

  // 可选：先跑自动封档（方式2）
  let autoSeal = null;
  if (runAutoSeal) {
    autoSeal = await autoSealAccounts({ serverId, dryRun });
  }

  // 步3：是否所有真人账号均已封档
  const accounts = await listRealAccountsWithSealState(serverId, fromSeason, toSeason);
  const unsealed = accounts
    .filter((a) => a.settlementStatus == null || a.settlementStatus === 'pending_selection')
    .map((a) => a.accountId);

  const report = {
    serverId,
    fromSeason,
    toSeason,
    preconditions: {
      seasonRecordsFkToAccounts: fkOk,
      settlementWindowEnded: windowEnded,
      allRealAccountsSealed: unsealed.length === 0,
    },
    counts: {
      realAccounts: accounts.length,
      unsealed: unsealed.length,
      wouldDeletePlayers: accounts.length,
    },
    unsealedAccountIds: unsealed,
    autoSeal,
  };

  if (dryRun) {
    return { ok: true, dryRun: true, report };
  }

  // 非 dryRun：先验所有前置；任一不满足则 abort（不静默继续）
  if (!fkOk) {
    return { ok: false, code: 'ROLLOVER_FK_NOT_MIGRATED', error: 'season_records 外键未指向 accounts，禁止 rollover', report };
  }
  if (!windowEnded) {
    const endLabel = end ? formatDatetimeForOps(end) : '（未配置）';
    return {
      ok: false,
      code: 'ROLLOVER_WINDOW_NOT_ENDED',
      error: `结算窗口尚未结束（关服时刻 ${endLabel}，须等到该时刻之后才能实跑 rollover）`,
      report,
    };
  }
  if (unsealed.length > 0) {
    return { ok: false, code: 'ROLLOVER_PRECONDITION_FAILED', error: `仍有 ${unsealed.length} 个账号未封档`, report };
  }

  // 双闸门：必须显式确认「执意破坏」+「已备份」，否则拒绝执行（不静默继续）
  if (!confirmDestructive || !backupConfirmed) {
    return {
      ok: false,
      code: 'ROLLOVER_CONFIRM_REQUIRED',
      error: '前置全部通过；破坏性执行须同时传 confirmDestructive=true 与 backupConfirmed=true（须先全库备份）',
      report,
    };
  }

  // ===== 破坏性步骤（不可逆；仅在维护窗、停写、已备份下执行）=====
  const realIds = accounts.map((a) => a.accountId);

  // 步5：世界态重置（清动态表 → import 重建 → 显式归零）
  await resetWorldState();

  // 步6：删真人 players（legions 已在步5清空，规避 commander_id RESTRICT；
  //       player_* 子表 CASCADE；season_records 已改 FK→accounts，不被级联）
  if (realIds.length) {
    await pool.query(`DELETE FROM players WHERE player_id IN (?)`, [realIds]);
  }

  // 步8：服务器切赛季 + 清结算窗口（用后即清，避免下次误判窗口仍开）
  await pool.query(
    `UPDATE config_servers
     SET current_season = ?, settlement_window_start = NULL, settlement_window_end = NULL, rollover_target_season = NULL
     WHERE server_id = ?`,
    [toSeason, serverId]
  );

  // 步9：accounts 切赛季 + 清高级权益 + participated_seasons 判重追加（§6.8）
  for (const id of realIds) {
    await pool.query(
      `UPDATE accounts
       SET current_season = ?,
           hasPremium = 0,
           participated_seasons = IF(
             JSON_CONTAINS(IFNULL(participated_seasons, JSON_ARRAY()), JSON_QUOTE(?)),
             participated_seasons,
             JSON_ARRAY_APPEND(IFNULL(participated_seasons, JSON_ARRAY()), '$', ?))
       WHERE id = ?`,
      [toSeason, fromSeason, fromSeason, id]
    );
  }

  return {
    ok: true,
    dryRun: false,
    executed: true,
    fromSeason,
    toSeason,
    deletedPlayers: realIds.length,
    report,
  };
}

const ALLOWED_SERVER_STATUS = new Set(['open', 'maintenance', 'closed']);

/**
 * 运营面板只读态：服务器赛季 / 窗口 / 维护状态 + 关键计数（真人账号 / 已封档 / 待发放 / players）。
 * 供管理端 GET /status 展示，便于运营在每一步前确认前置。
 */
async function getOpsStatus(serverId) {
  const [srv] = await pool.query(
    `SELECT server_id, server_name, status, current_season,
            settlement_window_start, settlement_window_end, rollover_target_season
     FROM config_servers WHERE server_id = ?`,
    [serverId]
  );
  if (!srv.length) return { ok: false, code: 'SERVER_CONFIG_MISSING', error: '服务器配置缺失' };
  const s = srv[0];
  const fromSeason = s.current_season;
  const toSeason = s.rollover_target_season;

  const now = Date.now();
  const start = s.settlement_window_start ? new Date(s.settlement_window_start) : null;
  const end = s.settlement_window_end ? new Date(s.settlement_window_end) : null;
  const windowOpen = !!start && !!end && !!toSeason && now >= start.getTime() && now <= end.getTime();
  const windowEnded = !!end && now >= end.getTime();

  const [[acc]] = await pool.query(
    `SELECT COUNT(*) c FROM accounts WHERE serverId = ? AND account_type = 'real'`,
    [serverId]
  );
  const [[ply]] = await pool.query(
    `SELECT COUNT(*) c FROM players p JOIN accounts a ON a.id = p.player_id
     WHERE a.serverId = ? AND a.account_type = 'real'`,
    [serverId]
  );
  let sealedConfirmed = 0;
  let applyPending = 0;
  if (toSeason) {
    const [[sealed]] = await pool.query(
      `SELECT COUNT(*) c FROM season_settlements ss JOIN accounts a ON a.id = ss.account_id
       WHERE a.serverId = ? AND ss.from_season = ? AND ss.to_season = ? AND ss.status = 'confirmed'`,
      [serverId, fromSeason, toSeason]
    );
    sealedConfirmed = sealed.c;
  }
  // 待发放：本季已是目标季（rollover 后），confirmed 未 applied
  const [[pend]] = await pool.query(
    `SELECT COUNT(*) c FROM season_settlements ss JOIN accounts a ON a.id = ss.account_id
     WHERE a.serverId = ? AND ss.to_season = ? AND ss.status = 'confirmed'`,
    [serverId, fromSeason]
  );
  applyPending = pend.c;

  const fkOk = await seasonRecordsFkPointsToAccounts();

  let unsealed = 0;
  if (toSeason && fromSeason) {
    const accounts = await listRealAccountsWithSealState(serverId, fromSeason, toSeason);
    unsealed = accounts.filter(
      (a) => a.settlementStatus == null || a.settlementStatus === 'pending_selection'
    ).length;
  }

  const allRealAccountsSealed = toSeason ? unsealed === 0 : false;
  const rolloverReady = fkOk && windowEnded && allRealAccountsSealed && !!toSeason;

  return {
    ok: true,
    data: {
      serverId: s.server_id,
      serverName: s.server_name,
      status: s.status,
      currentSeason: fromSeason,
      rolloverTargetSeason: toSeason,
      settlementWindowStart: formatDatetimeForOps(s.settlement_window_start),
      settlementWindowEnd: formatDatetimeForOps(s.settlement_window_end),
      windowOpen,
      windowEnded,
      counts: { realAccounts: acc.c, players: ply.c, sealedConfirmed, applyPending, unsealed },
      preconditions: {
        seasonRecordsFkToAccounts: fkOk,
        settlementWindowEnded: windowEnded,
        rolloverTargetConfigured: !!toSeason,
        allRealAccountsSealed,
        rolloverReady,
      },
    },
  };
}

/** 设结算窗口 + 目标赛季（运营提前配置；用于让玩家手动「赛季结算」按钮按时出现）。 */
async function setSettlementWindow({ serverId, settlementWindowStart, settlementWindowEnd, rolloverTargetSeason }) {
  const [srv] = await pool.query(`SELECT server_id FROM config_servers WHERE server_id = ?`, [serverId]);
  if (!srv.length) return { ok: false, code: 'SERVER_CONFIG_MISSING', error: '服务器配置缺失' };

  const fields = [];
  const params = [];
  if (settlementWindowStart !== undefined) {
    fields.push('settlement_window_start = ?');
    params.push(settlementWindowStart || null);
  }
  if (settlementWindowEnd !== undefined) {
    fields.push('settlement_window_end = ?');
    params.push(settlementWindowEnd || null);
  }
  if (rolloverTargetSeason !== undefined) {
    fields.push('rollover_target_season = ?');
    params.push(rolloverTargetSeason || null);
  }
  if (!fields.length) {
    return { ok: false, code: 'NO_WINDOW_FIELDS', error: '未提供任何窗口字段' };
  }
  params.push(serverId);
  await pool.query(`UPDATE config_servers SET ${fields.join(', ')} WHERE server_id = ?`, params);
  return getOpsStatus(serverId);
}

/** 设服务器状态（open / maintenance / closed）。maintenance/closed 由 serverMaintenanceGate 拦玩家 API。 */
async function setServerStatus({ serverId, status }) {
  const st = String(status || '').toLowerCase();
  if (!ALLOWED_SERVER_STATUS.has(st)) {
    return { ok: false, code: 'INVALID_SERVER_STATUS', error: `status 须为 ${[...ALLOWED_SERVER_STATUS].join('/')}` };
  }
  const [srv] = await pool.query(`SELECT server_id FROM config_servers WHERE server_id = ?`, [serverId]);
  if (!srv.length) return { ok: false, code: 'SERVER_CONFIG_MISSING', error: '服务器配置缺失' };
  await pool.query(`UPDATE config_servers SET status = ? WHERE server_id = ?`, [st, serverId]);
  return getOpsStatus(serverId);
}

module.exports = {
  autoSealAccounts,
  executeRollover,
  getOpsStatus,
  setSettlementWindow,
  setServerStatus,
  // 供测试
  _internal: { seasonRecordsFkPointsToAccounts, listRealAccountsWithSealState, autoSelectFromCards },
};
