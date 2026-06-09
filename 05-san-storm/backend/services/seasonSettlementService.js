/**
 * 赛季继承（结算）服务 · 封档阶段（Phase 1 · 见 19-3 §6.1/§6.2）
 *
 * 职责：
 *   - preview：只读，返回自动继承内容 + 可选清单 + 上限 + 是否已封档。
 *   - confirm：事务，校验玩家选择 → 写 player_cards 完整行快照 → season_settlements=confirmed
 *              + season_records 本季成绩占位。**不删** player_cards（删卡在 rollover）。
 *   - getStatus：只读，返回封档/待发放/已发放/无。
 *
 * 纯算法全部走 shared/utils/seasonSettlementCore.cjs（单源、已单测）。
 * 严守 P0：失败早返回明确 code，禁止静默跨语义兜底。
 *
 * @module services/seasonSettlementService
 */

const { pool } = require('../database/connection');
const core = require('../../shared/utils/seasonSettlementCore.cjs');

function fail(status, code, error) {
  return { ok: false, status, code, error: error || code };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** 窗口是否开启（start <= now <= end，且两端与目标赛季均已配置） */
function computeWindow(server) {
  const start = server.settlement_window_start ? new Date(server.settlement_window_start) : null;
  const end = server.settlement_window_end ? new Date(server.settlement_window_end) : null;
  const target = server.rollover_target_season || null;
  const now = Date.now();
  const open =
    !!start && !!end && !!target && now >= start.getTime() && now <= end.getTime();
  return { open, start, end, target };
}

/**
 * 加载账号 + 服务器 + 赛季上下文。conn 可为 pool 或事务连接。
 * @returns {{ error?: object, account, server, fromSeason, toSeason, window }}
 */
async function loadContext(conn, accountId, { forUpdate = false } = {}) {
  const [accRows] = await conn.query(
    `SELECT id, serverId, account_type, current_season FROM accounts WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [accountId]
  );
  if (accRows.length === 0) return { error: { notFound: true, error: '账号不存在' } };
  const account = accRows[0];

  if (account.account_type !== 'real') {
    return { error: fail(403, 'SETTLEMENT_REAL_ONLY', 'AI 账号不参与赛季继承') };
  }

  const [srvRows] = await conn.query(
    `SELECT server_id, current_season, settlement_window_start, settlement_window_end, rollover_target_season
     FROM config_servers WHERE server_id = ?`,
    [account.serverId]
  );
  if (srvRows.length === 0) {
    return { error: fail(500, 'SERVER_CONFIG_MISSING', '服务器配置缺失') };
  }
  const server = srvRows[0];

  // 早失败：账号赛季与服务器赛季必须一致（禁止跨语义兜底）
  if (account.current_season && account.current_season !== server.current_season) {
    return {
      error: fail(
        500,
        'SEASON_MISMATCH',
        `账号赛季(${account.current_season})与服务器赛季(${server.current_season})不一致`
      ),
    };
  }

  const fromSeason = server.current_season;
  const window = computeWindow(server);
  const toSeason = window.target;

  return { account, server, fromSeason, toSeason, window };
}

async function loadSeasonBadgeItemIds(conn) {
  const [rows] = await conn.query(
    `SELECT item_id FROM config_items WHERE item_type = 'season_badge'`
  );
  return rows.map((r) => r.item_id);
}

async function loadPlayerCards(conn, playerId, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `SELECT * FROM player_cards WHERE player_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId]
  );
  return rows;
}

async function loadPlayerItems(conn, playerId, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `SELECT items FROM players WHERE player_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId]
  );
  if (rows.length === 0) return { notFound: true };
  return { items: parseJson(rows[0].items, {}) };
}

async function loadSettlementRow(conn, accountId, fromSeason, toSeason, { forUpdate = false } = {}) {
  const [rows] = await conn.query(
    `SELECT * FROM season_settlements WHERE account_id = ? AND from_season = ? AND to_season = ?${
      forUpdate ? ' FOR UPDATE' : ''
    }`,
    [accountId, fromSeason, toSeason]
  );
  return rows[0] || null;
}

function normalizeSelection(payload) {
  const eq = Array.isArray(payload?.equipmentSetInstanceIds)
    ? payload.equipmentSetInstanceIds.map(String)
    : [];
  const tr = Array.isArray(payload?.legendaryTroopInstanceIds)
    ? payload.legendaryTroopInstanceIds.map(String)
    : [];
  return { equipmentSetInstanceIds: eq, legendaryTroopInstanceIds: tr };
}

/** 两份选择是否等价（用于 confirm 幂等比较，忽略顺序） */
function selectionEquals(a, b) {
  const norm = (arr) => [...new Set((arr || []).map(String))].sort();
  const ax = norm(a.equipmentSetInstanceIds);
  const bx = norm(b.equipmentSetInstanceIds);
  const ay = norm(a.legendaryTroopInstanceIds);
  const by = norm(b.legendaryTroopInstanceIds);
  return (
    ax.length === bx.length &&
    ax.every((v, i) => v === bx[i]) &&
    ay.length === by.length &&
    ay.every((v, i) => v === by[i])
  );
}

/**
 * 只读预览。
 * @param {string} accountId == playerId
 */
async function preview(accountId) {
  const ctx = await loadContext(pool, accountId);
  if (ctx.error) return ctx.error;
  const { account, fromSeason, toSeason, window } = ctx;

  let limits;
  try {
    limits = core.computeSelectionLimits(fromSeason);
  } catch (e) {
    return fail(400, e.code || 'INVALID_SEASON', e.message);
  }
  if (!toSeason) {
    return fail(409, 'ROLLOVER_TARGET_MISSING', '尚未配置下个赛季（rollover_target_season）');
  }

  const cards = await loadPlayerCards(pool, accountId);
  const itemsOut = await loadPlayerItems(pool, accountId);
  if (itemsOut.notFound) return { notFound: true, error: '玩家角色不存在' };
  const seasonBadgeItemIds = await loadSeasonBadgeItemIds(pool);

  const auto = core.buildAutoInheritedPayload({
    cards,
    items: itemsOut.items,
    seasonBadgeItemIds,
  });
  const selectableEquipmentSets = core.listSelectableEquipmentSets(cards);
  const selectableLegendaryTroops = core.listSelectableLegendaryTroops(cards);

  const existing = await loadSettlementRow(pool, accountId, fromSeason, toSeason);
  const alreadyConfirmed = !!existing && existing.status !== 'pending_selection';

  return {
    data: {
      fromSeason,
      toSeason,
      windowOpen: window.open,
      windowStart: window.start ? window.start.toISOString() : null,
      windowEnd: window.end ? window.end.toISOString() : null,
      limits,
      autoInherited: auto,
      selectableEquipmentSets,
      selectableLegendaryTroops,
      alreadyConfirmed,
      status: existing ? existing.status : null,
      selection: existing ? parseJson(existing.player_selected_json, null) : null,
    },
  };
}

/**
 * 在事务内对单账号执行封档：构建自动继承 + 快照 → UPSERT season_settlements + season_records。
 * 供 confirm（source='player'）与 autoSealAccounts（source='auto_shutdown'）复用，单源逻辑。
 *
 * 调用方须已在事务中并完成窗口/幂等校验；本函数只负责「构建 + 写库」，失败返回 { ok:false, error }，
 * 不自行 rollback（由调用方决定）。
 *
 * @returns {{ ok: true, snapshotCount: number, auto: object } | { ok: false, error: object }}
 */
async function sealAccountInTx(conn, { accountId, account, fromSeason, toSeason, limits, selection, source }) {
  const cards = await loadPlayerCards(conn, accountId, { forUpdate: true });
  const itemsOut = await loadPlayerItems(conn, accountId, { forUpdate: true });
  if (itemsOut.notFound) {
    return { ok: false, error: { notFound: true, error: '玩家角色不存在' } };
  }
  const seasonBadgeItemIds = await loadSeasonBadgeItemIds(conn);

  const validation = core.validatePlayerSelection({
    cards,
    selectedEquipmentSetInstanceIds: selection.equipmentSetInstanceIds,
    selectedLegendaryTroopInstanceIds: selection.legendaryTroopInstanceIds,
    limits,
  });
  if (!validation.ok) {
    const first = validation.errors[0];
    return {
      ok: false,
      error: fail(400, first.code, `选择校验失败：${first.code}${first.detail ? ` (${first.detail})` : ''}`),
    };
  }

  const auto = core.buildAutoInheritedPayload({ cards, items: itemsOut.items, seasonBadgeItemIds });
  const snapshot = core.buildPlayerCardsSnapshot({
    cards,
    auto,
    selectedEquipmentSetInstanceIds: selection.equipmentSetInstanceIds,
    selectedLegendaryTroopInstanceIds: selection.legendaryTroopInstanceIds,
  });
  try {
    core.assertSnapshotApplyable(snapshot);
  } catch (e) {
    return { ok: false, error: fail(500, 'APPLY_SNAPSHOT_INVALID', e.message) };
  }

  const sourceVal = source === 'auto_shutdown' ? 'auto_shutdown' : 'player';
  await conn.query(
    `INSERT INTO season_settlements
       (account_id, from_season, to_season, server_id,
        auto_inherited_json, player_selected_json, player_cards_snapshot_json, selection_limits_json,
        selection_source, status, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW())
     ON DUPLICATE KEY UPDATE
       server_id = VALUES(server_id),
       auto_inherited_json = VALUES(auto_inherited_json),
       player_selected_json = VALUES(player_selected_json),
       player_cards_snapshot_json = VALUES(player_cards_snapshot_json),
       selection_limits_json = VALUES(selection_limits_json),
       selection_source = VALUES(selection_source),
       status = 'confirmed',
       confirmed_at = NOW()`,
    [
      accountId,
      fromSeason,
      toSeason,
      account.serverId,
      JSON.stringify(auto),
      JSON.stringify(selection),
      JSON.stringify(snapshot),
      JSON.stringify(limits),
      sourceVal,
    ]
  );

  // season_records 本季成绩占位（仅 reputation；其余默认 0）
  const [pRows] = await conn.query(`SELECT reputation FROM players WHERE player_id = ?`, [accountId]);
  const reputation = pRows.length ? Number(pRows[0].reputation) || 0 : 0;
  await conn.query(
    `INSERT INTO season_records (player_id, season_id, server_id, final_reputation, settled_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE final_reputation = VALUES(final_reputation), settled_at = NOW()`,
    [accountId, fromSeason, account.serverId, reputation]
  );

  return { ok: true, snapshotCount: snapshot.length, auto };
}

/**
 * 封档（玩家主动确认）。
 * @param {string} accountId == playerId
 * @param {{ equipmentSetInstanceIds?: string[], legendaryTroopInstanceIds?: string[] }} payload
 */
async function confirm(accountId, payload) {
  const selection = normalizeSelection(payload);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ctx = await loadContext(conn, accountId, { forUpdate: true });
    if (ctx.error) {
      await conn.rollback();
      return ctx.error;
    }
    const { account, server, fromSeason, toSeason, window } = ctx;

    if (!toSeason) {
      await conn.rollback();
      return fail(409, 'ROLLOVER_TARGET_MISSING', '尚未配置下个赛季');
    }
    if (!window.open) {
      await conn.rollback();
      return fail(403, 'SETTLEMENT_WINDOW_CLOSED', '赛季继承窗口未开启');
    }

    let limits;
    try {
      limits = core.computeSelectionLimits(fromSeason);
    } catch (e) {
      await conn.rollback();
      return fail(400, e.code || 'INVALID_SEASON', e.message);
    }

    // 幂等：已封档则比较 payload
    const existing = await loadSettlementRow(conn, accountId, fromSeason, toSeason, {
      forUpdate: true,
    });
    if (existing && existing.status !== 'pending_selection') {
      const prevSelection = parseJson(existing.player_selected_json, {
        equipmentSetInstanceIds: [],
        legendaryTroopInstanceIds: [],
      });
      await conn.commit();
      if (selectionEquals(prevSelection, selection)) {
        return { data: { status: existing.status, idempotent: true }, message: '已封档（幂等）' };
      }
      return fail(409, 'ALREADY_CONFIRMED', '已封档，选择不可更改');
    }

    const sealed = await sealAccountInTx(conn, {
      accountId,
      account,
      fromSeason,
      toSeason,
      limits,
      selection,
      source: 'player',
    });
    if (!sealed.ok) {
      await conn.rollback();
      return sealed.error;
    }

    await conn.commit();
    return {
      data: {
        status: 'confirmed',
        fromSeason,
        toSeason,
        inheritedCardCount: sealed.snapshotCount,
        selection,
      },
      message: '已封档',
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/** 快照行的列，排除由 DB 默认/自增维护的列 */
const SNAPSHOT_INSERT_EXCLUDE = new Set(['created_at', 'updated_at']);

/**
 * 把快照行 INSERT 回 player_cards（保留原 instance_id）。逐行显式列 INSERT；
 * 重复 instance_id 视为异常（不静默忽略）。
 */
async function insertSnapshotRows(conn, rows, playerId) {
  for (const row of rows) {
    const cols = Object.keys(row).filter((k) => !SNAPSHOT_INSERT_EXCLUDE.has(k));
    if (!cols.includes('player_id')) cols.push('player_id');
    const values = cols.map((c) => (c === 'player_id' ? playerId : normalizeCellForInsert(row[c])));
    const placeholders = cols.map(() => '?').join(', ');
    await conn.query(
      `INSERT INTO player_cards (${cols.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }
}

/** JSON 经 JSON.stringify 序列化后的 ISO 时间串（DATETIME 列需转 MySQL 格式） */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

/**
 * 写回 player_cards 单元值的规整：
 *   - JSON 列（对象/数组）→ 字符串；
 *   - 快照里 DATETIME 经 JSON 变成 ISO 串（`...T...Z`）→ 转 `YYYY-MM-DD HH:MM:SS`，避免 MySQL 解析失败/置零。
 */
function normalizeCellForInsert(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && ISO_DATETIME_RE.test(v)) {
    return v.replace('T', ' ').replace(/\.\d+/, '').replace(/Z$/, '');
  }
  return v;
}

/**
 * 新赛季创角后发放继承物品（Phase 3 · 见 19-3 §6.3）。
 * 前置：已 rollover（account.current_season === settlement.to_season）、players 行已创建、settlement=confirmed。
 *
 * @param {string} accountId == playerId
 */
async function apply(accountId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ctx = await loadContext(conn, accountId, { forUpdate: true });
    if (ctx.error) {
      await conn.rollback();
      return ctx.error;
    }
    const { account } = ctx;
    const toSeason = account.current_season; // rollover 后账号已处于新赛季

    // 取「目标赛季 == 当前赛季」的封档行
    const [rows] = await conn.query(
      `SELECT * FROM season_settlements
       WHERE account_id = ? AND to_season = ? AND status IN ('confirmed','applied')
       ORDER BY confirmed_at DESC LIMIT 1 FOR UPDATE`,
      [accountId, toSeason]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return fail(404, 'SETTLEMENT_NOT_FOUND', '没有待发放的封档记录');
    }
    const settlement = rows[0];

    if (settlement.status === 'applied') {
      await conn.commit();
      return { data: { status: 'applied', idempotent: true }, message: '继承物品已发放（幂等）' };
    }

    // players 行须已创角
    const [pRows] = await conn.query(`SELECT items FROM players WHERE player_id = ? FOR UPDATE`, [accountId]);
    if (pRows.length === 0) {
      await conn.rollback();
      return fail(409, 'PLAYER_NOT_CREATED', '请先完成创角再领取继承物品');
    }

    const snapshot = parseJson(settlement.player_cards_snapshot_json, []);
    try {
      core.assertSnapshotApplyable(snapshot);
    } catch (e) {
      await conn.rollback();
      return fail(500, 'APPLY_SNAPSHOT_INVALID', e.message);
    }

    // 发放卡牌（保留 instance_id）
    await insertSnapshotRows(conn, snapshot, accountId);

    // 合并徽章道具到 players.items（仅 badge 键，不覆盖其它键）
    const auto = parseJson(settlement.auto_inherited_json, {});
    const badgeItems = auto.seasonBadgeItems && typeof auto.seasonBadgeItems === 'object' ? auto.seasonBadgeItems : {};
    const items = parseJson(pRows[0].items, {}) || {};
    for (const [itemId, cnt] of Object.entries(badgeItems)) {
      const add = Number(cnt) || 0;
      if (add > 0) items[itemId] = (Number(items[itemId]) || 0) + add;
    }
    await conn.query(`UPDATE players SET items = ? WHERE player_id = ?`, [JSON.stringify(items), accountId]);

    await conn.query(
      `UPDATE season_settlements SET status = 'applied', applied_at = NOW()
       WHERE account_id = ? AND from_season = ? AND to_season = ?`,
      [accountId, settlement.from_season, settlement.to_season]
    );

    await conn.commit();
    return {
      data: {
        status: 'applied',
        appliedCardCount: snapshot.length,
        badgeItems,
      },
      message: '继承物品已发放',
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 封档/待发放判定（供写门禁与 status 复用）。只读、极轻。
 * @returns {{ sealed: boolean, code: string|null, status: string|null }}
 */
async function getSealStatus(accountId) {
  const [accRows] = await pool.query(
    `SELECT a.current_season AS accSeason, s.current_season AS srvSeason
     FROM accounts a
     LEFT JOIN config_servers s ON s.server_id = a.serverId
     WHERE a.id = ? AND a.account_type = 'real'`,
    [accountId]
  );
  if (accRows.length === 0 || !accRows[0].srvSeason) {
    return { sealed: false, code: null, status: null };
  }
  const serverSeason = accRows[0].srvSeason;

  const [rows] = await pool.query(
    `SELECT from_season, to_season, status FROM season_settlements
     WHERE account_id = ? AND status = 'confirmed' AND (from_season = ? OR to_season = ?)
     LIMIT 1`,
    [accountId, serverSeason, serverSeason]
  );
  if (rows.length === 0) return { sealed: false, code: null, status: null };

  const row = rows[0];
  if (row.from_season === serverSeason) {
    // 尚未 rollover：本季已封档，禁止继续游戏
    return { sealed: true, code: 'SEASON_SEALED', status: 'confirmed' };
  }
  if (row.to_season === serverSeason) {
    // 已 rollover、未 apply：待发放
    return { sealed: true, code: 'SEASON_SETTLEMENT_APPLY_PENDING', status: 'confirmed' };
  }
  return { sealed: false, code: null, status: null };
}

/**
 * 只读状态查询（pre- 与 post-rollover 均正确）。
 * 返回 `phase`：
 *   - `none`：无相关封档、窗口未开
 *   - `window_open`：结算窗口开启、可主动封档（未封档）
 *   - `sealed`：本季已封档、未 rollover（禁止继续游戏）
 *   - `apply_pending`：已 rollover、confirmed 未 applied（待发放，附 `claim` 摘要）
 *   - `applied`：已发放
 */
async function getStatus(accountId) {
  const [accRows] = await pool.query(
    `SELECT a.serverId AS serverId, s.current_season AS srvSeason,
            s.settlement_window_start AS ws, s.settlement_window_end AS we, s.rollover_target_season AS target
     FROM accounts a
     LEFT JOIN config_servers s ON s.server_id = a.serverId
     WHERE a.id = ? AND a.account_type = 'real'`,
    [accountId]
  );
  if (accRows.length === 0 || !accRows[0].srvSeason) {
    return { data: { phase: 'none', windowOpen: false } };
  }
  const r = accRows[0];
  const serverSeason = r.srvSeason;
  const window = computeWindow({
    settlement_window_start: r.ws,
    settlement_window_end: r.we,
    rollover_target_season: r.target,
  });

  const [rows] = await pool.query(
    `SELECT from_season, to_season, status, auto_inherited_json, player_cards_snapshot_json
     FROM season_settlements
     WHERE account_id = ? AND (from_season = ? OR to_season = ?)
     ORDER BY confirmed_at DESC`,
    [accountId, serverSeason, serverSeason]
  );

  // 已发放
  if (rows.some((x) => x.to_season === serverSeason && x.status === 'applied')) {
    return { data: { phase: 'applied', windowOpen: window.open, toSeason: serverSeason } };
  }
  // 待发放（已 rollover、confirmed 未 apply）
  const pending = rows.find((x) => x.to_season === serverSeason && x.status === 'confirmed');
  if (pending) {
    const auto = parseJson(pending.auto_inherited_json, {});
    const snap = parseJson(pending.player_cards_snapshot_json, []);
    return {
      data: {
        phase: 'apply_pending',
        windowOpen: window.open,
        fromSeason: pending.from_season,
        toSeason: serverSeason,
        claim: {
          cardCount: Array.isArray(snap) ? snap.length : 0,
          badgeItems: auto.seasonBadgeItems && typeof auto.seasonBadgeItems === 'object' ? auto.seasonBadgeItems : {},
        },
      },
    };
  }
  // 本季已封档、未 rollover
  const sealed = rows.find((x) => x.from_season === serverSeason && x.status === 'confirmed');
  if (sealed) {
    return { data: { phase: 'sealed', windowOpen: window.open, fromSeason: serverSeason, toSeason: sealed.to_season } };
  }
  // 窗口开启可封档
  if (window.open && window.target) {
    return { data: { phase: 'window_open', windowOpen: true, fromSeason: serverSeason, toSeason: window.target } };
  }
  return { data: { phase: 'none', windowOpen: false, fromSeason: serverSeason, toSeason: window.target || null } };
}

module.exports = {
  preview,
  confirm,
  apply,
  getStatus,
  getSealStatus,
  // 供 rollover 服务复用（同源封档逻辑）
  sealAccountInTx,
  loadContext,
  loadSeasonBadgeItemIds,
  // 供测试复用
  _internal: { loadContext, computeWindow, selectionEquals, normalizeSelection, insertSnapshotRows },
};
