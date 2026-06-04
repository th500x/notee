/**
 * 势力 Tab「势力信息」象限：官职要员、人数统计、城市摘要、五维+档位、储备
 *
 * 五维势力标量（与 `01-database-split/30-tables-world` §3.2.10、`13-3-CARD_POOL_SYSTEM` §2.4.1 一致）：
 * - 参与集合 `C`：**仅** `city_major` / `city_medium` / `city_small` 且 `status = 'owned'`；
 *   **`gate` / `fort` 不计入** 五维与 `n`。
 * - `n = |C|`；`n = 0` → 五维全 0。
 * - 各维：`avg = (Σ 各城该维) / n`，**势力标量** `total = avg * (1 + 0.05 * n)`（非简单 SUM）。
 * 聚合 SQL 只用 `cities` 单表，避免对 config 表 JOIN 后重复计城。
 * **「规模」城市数**：`status='owned'` 的 **全部 `city_type` 行数**（含关隘/据点），与公式 **`n` 分开**。
 * **列表字段**（供势力信息 UI 弹层）：`playersReal` / `playersNpc`（`[官职]名`，按 **品阶 `position_level` 升序** 即高→低，同阶按 **`config_positions.position_rank`**、角色名）；`legions` / `citiesList`（与四项计数同源）。
 */

const { pool } = require('../database/connection');
const { computeSupplyTier } = require('./factionSupplyTierService');
const { estimateDailyReserveRecovery } = require('./factionReserveRecoveryService');
const factionReserveService = require('./factionReserveService');
const kingDasikongRankingService = require('./kingDasikongRankingService');
const { SAN_1_PLAYABLE_FACTION_IDS } = require('../../shared/utils/san1PlayableFactions.cjs');

/** 参与势力五维标量计算的 `cities.city_type`（关隘、据点排除） */
const CITY_TYPES_FOR_FACTION_FIVE_STATS = ['city_major', 'city_medium', 'city_small'];

/**
 * @param {{ sum_population: unknown, sum_trading: unknown, sum_farming: unknown, sum_military: unknown, sum_culture: unknown }} sums
 * @param {number} n
 */
function computeFactionFiveScalarsFromSums(sums, n) {
  const count = Math.floor(Number(n)) || 0;
  if (count <= 0) {
    return { population: 0, trading: 0, farming: 0, military: 0, culture: 0 };
  }
  const coef = 1 + 0.05 * count;
  const dim = (sumRaw) => Math.round(((Number(sumRaw) || 0) / count) * coef);
  return {
    population: dim(sums.sum_population),
    trading: dim(sums.sum_trading),
    farming: dim(sums.sum_farming),
    military: dim(sums.sum_military),
    culture: dim(sums.sum_culture),
  };
}

/** 与 config_positions / positions.json 对齐的要职展示顺序（含四安/四平/四镇/四征）。君主名见 config_factions.faction_leader → config_characters */
const OFFICE_SLOTS = [
  { positionId: 'san_1_position_junzhu', label: '君主' },
  { positionId: 'san_1_position_dajiangjun', label: '大将军' },
  { positionId: 'san_1_position_dasima', label: '大司马' },
  { positionId: 'san_1_position_dasikong', label: '大司空' },
  { positionId: 'san_1_position_piaoqi', label: '骠骑将军' },
  { positionId: 'san_1_position_cheqi', label: '车骑将军' },
  { positionId: 'san_1_position_sian', label: '四安将军' },
  { positionId: 'san_1_position_siping', label: '四平将军' },
  { positionId: 'san_1_position_sizhen', label: '四镇将军' },
  { positionId: 'san_1_position_sizheng', label: '四征将军' },
];

/** 玩家任官查询：不含君主槽（君主展示为 `faction_leader` 对应将领名） */
const PLAYER_HELD_POSITION_IDS = OFFICE_SLOTS.filter((s) => s.positionId !== 'san_1_position_junzhu').map(
  (s) => s.positionId,
);

function buildEmptyFactionOverview() {
  return {
    factionId: null,
    factionName: null,
    reserveSilver: 0,
    reserveFood: 0,
    reserveTroopLegendary: 0,
    reserveCharacterLegendary: 0,
    totals: { population: 0, trading: 0, farming: 0, military: 0, culture: 0 },
    supplyTier: null,
    playerCountReal: 0,
    playerCountNpc: 0,
    legionCount: 0,
    cityCount: 0,
    officeHolders: OFFICE_SLOTS.map((s) => ({ positionId: s.positionId, label: s.label, characterName: null })),
    citiesMajorLines: [],
    citiesMediumLines: [],
    citiesSmallByZhou: [],
    citiesGateByZhou: [],
    citiesFortByZhou: [],
    playersReal: [],
    playersNpc: [],
    legions: [],
    citiesList: [],
    reserveLedgerSummary: null,
    legendaryLedgerSummary: null,
    dailyActivityRanking: [],
  };
}

/**
 * @param {string} factionId
 * @returns {Promise<{ data: object }>}
 */
async function getFactionOverviewByFactionId(factionId) {
  const fid = String(factionId || '').trim();
  if (!fid) return { data: buildEmptyFactionOverview() };

  const [fRows] = await pool.query(
    `SELECT id, season, faction_name, COALESCE(player_count, 0) AS player_count
     FROM factions WHERE id = ? LIMIT 1`,
    [fid]
  );
  const f = fRows[0] || {};
  const factionName = f.faction_name || null;
  const poolBal = await factionReserveService.getPoolBalance(pool, fid);
  const factionSeason = String(f.season || 'san_1').trim() || 'san_1';

  let monarchDisplayName = null;
  try {
    const [cfgRows] = await pool.query(
      `SELECT cc.character_name AS monarchCharacterName
       FROM factions f
       INNER JOIN config_factions cf ON cf.faction_id = f.id AND cf.season = f.season
       LEFT JOIN config_characters cc ON cc.character_id = cf.faction_leader AND cc.season = cf.season
       WHERE f.id = ?
       LIMIT 1`,
      [fid]
    );
    monarchDisplayName = cfgRows[0]?.monarchCharacterName || null;
  } catch (_) {
    monarchDisplayName = null;
  }

  const posPlaceholders = PLAYER_HELD_POSITION_IDS.map(() => '?').join(',');
  const [holderRows] = await pool.query(
    `SELECT p.current_position_id AS positionId, MIN(p.character_name) AS characterName
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
     WHERE p.faction_id = ?
       AND p.player_id <> 'sys1'
       AND p.current_position_id IN (${posPlaceholders})
     GROUP BY p.current_position_id`,
    [fid, ...PLAYER_HELD_POSITION_IDS]
  );
  const holderByPos = {};
  for (const row of holderRows) {
    holderByPos[row.positionId] = row.characterName || null;
  }
  const officeHolders = OFFICE_SLOTS.map((s) => ({
    positionId: s.positionId,
    label: s.label,
    characterName:
      s.positionId === 'san_1_position_junzhu' ? monarchDisplayName : holderByPos[s.positionId] ?? null,
  }));

  const [countRows] = await pool.query(
    `SELECT
       SUM(CASE WHEN a.account_type = 'real' THEN 1 ELSE 0 END) AS realCount,
       SUM(CASE WHEN a.account_type = 'ai' THEN 1 ELSE 0 END) AS aiCount
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
     WHERE p.faction_id = ? AND p.player_id <> 'sys1'`,
    [fid]
  );
  const playerCountReal = Number(countRows[0]?.realCount) || 0;
  const playerCountNpc = Number(countRows[0]?.aiCount) || 0;

  const [realPlayerRows] = await pool.query(
    `SELECT p.player_id AS playerId, p.character_name AS characterName,
            COALESCE(NULLIF(TRIM(p.current_position_name), ''), cp.position_name) AS positionName,
            COALESCE(p.position_level, cp.position_level) AS positionLevel
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id AND cp.season = ?
     WHERE p.faction_id = ? AND p.player_id <> 'sys1' AND a.account_type = 'real'
     ORDER BY COALESCE(COALESCE(p.position_level, cp.position_level), 999) ASC,
              COALESCE(cp.position_rank, 999999) ASC,
              p.character_name`,
    [factionSeason, fid],
  );
  const playersReal = (realPlayerRows || []).map((r) => ({
    playerId: r.playerId,
    characterName: r.characterName || r.playerId,
    positionName: r.positionName || null,
  }));

  const [npcPlayerRows] = await pool.query(
    `SELECT p.player_id AS playerId, p.character_name AS characterName,
            COALESCE(NULLIF(TRIM(p.current_position_name), ''), cp.position_name) AS positionName,
            COALESCE(p.position_level, cp.position_level) AS positionLevel
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id AND cp.season = ?
     WHERE p.faction_id = ? AND p.player_id <> 'sys1' AND a.account_type = 'ai'
     ORDER BY COALESCE(COALESCE(p.position_level, cp.position_level), 999) ASC,
              COALESCE(cp.position_rank, 999999) ASC,
              p.character_name`,
    [factionSeason, fid],
  );
  const playersNpc = (npcPlayerRows || []).map((r) => ({
    playerId: r.playerId,
    characterName: r.characterName || r.playerId,
    positionName: r.positionName || null,
  }));

  let legionCount = 0;
  let legions = [];
  try {
    const [legionRows] = await pool.query(
      "SELECT COUNT(*) AS c FROM legions WHERE faction_id = ? AND status = 'active'",
      [fid]
    );
    legionCount = Number(legionRows[0]?.c) || 0;
    const [legionListRows] = await pool.query(
      `SELECT l.legion_id AS legionId, l.legion_name AS legionName, l.member_count AS memberCount,
              pc.character_name AS commanderName
       FROM legions l
       LEFT JOIN players pc ON pc.player_id = l.commander_id
       WHERE l.faction_id = ? AND l.status = 'active'
       ORDER BY l.legion_name`,
      [fid],
    );
    legions = (legionListRows || []).map((r) => ({
      legionId: r.legionId,
      legionName: r.legionName || r.legionId,
      memberCount: Number(r.memberCount) || 0,
      commanderName: r.commanderName || null,
    }));
  } catch (_) {
    legionCount = 0;
    legions = [];
  }

  const typePh = CITY_TYPES_FOR_FACTION_FIVE_STATS.map(() => '?').join(', ');
  const [aggRows] = await pool.query(
    `SELECT
       COUNT(*) AS n_supply_cities,
       COALESCE(SUM(c.population), 0) AS sum_population,
       COALESCE(SUM(c.final_trading), 0) AS sum_trading,
       COALESCE(SUM(c.final_farming), 0) AS sum_farming,
       COALESCE(SUM(c.military), 0) AS sum_military,
       COALESCE(SUM(c.culture), 0) AS sum_culture
     FROM cities c
     WHERE c.faction_id = ? AND c.status = 'owned'
       AND c.city_type IN (${typePh})`,
    [fid, ...CITY_TYPES_FOR_FACTION_FIVE_STATS]
  );
  const aggRow = aggRows[0] || {};
  const nSupply = Number(aggRow.n_supply_cities) || 0;

  const [allOwnedCountRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM cities c WHERE c.faction_id = ? AND c.status = 'owned'`,
    [fid]
  );
  const cityCount = Number(allOwnedCountRows[0]?.c) || 0;

  const [cityRows] = await pool.query(
    `SELECT c.city_id, c.city_type, c.city_name, c.season,
            c.population, c.final_trading, c.final_farming, c.military, c.culture,
            z.zhou_name AS zhouName,
            j.jun_name AS junName
     FROM cities c
     LEFT JOIN config_zhou z ON z.zhou_id = c.zhou_id AND z.season = c.season
     LEFT JOIN config_jun j ON j.jun_id = c.jun_id AND j.season = c.season
     WHERE c.faction_id = ? AND c.status = 'owned'`,
    [fid]
  );

  const citiesMajorLines = [];
  const citiesMediumLines = [];
  const smallByZhou = {};
  const gateByZhou = {};
  const fortByZhou = {};
  let cityRecoveryCounts = { small: 0, medium: 0, major: 0 };
  /** JOIN 可能重复同一 city_id；列表与州计数只认一城一行 */
  const cityRowById = new Map();
  for (const row of cityRows) {
    if (!cityRowById.has(row.city_id)) cityRowById.set(row.city_id, row);
  }
  for (const c of cityRowById.values()) {
    if (c.city_type === 'city_small') cityRecoveryCounts.small += 1;
    else if (c.city_type === 'city_medium') cityRecoveryCounts.medium += 1;
    else if (c.city_type === 'city_major') cityRecoveryCounts.major += 1;
    const zhou = c.zhouName || '—';
    const jun = c.junName || '—';
    const name = c.city_name || c.city_id;
    if (c.city_type === 'city_major') {
      citiesMajorLines.push(`${zhou}-${name}`);
    } else if (c.city_type === 'city_medium') {
      citiesMediumLines.push(`${jun}-${name}`);
    } else if (c.city_type === 'city_small') {
      smallByZhou[zhou] = (smallByZhou[zhou] || 0) + 1;
    } else if (c.city_type === 'gate') {
      gateByZhou[zhou] = (gateByZhou[zhou] || 0) + 1;
    } else if (c.city_type === 'fort') {
      fortByZhou[zhou] = (fortByZhou[zhou] || 0) + 1;
    }
  }
  const sortZhouCounts = (m) =>
    Object.entries(m)
      .map(([zhouName, count]) => ({ zhouName, count }))
      .sort((a, b) => a.zhouName.localeCompare(b.zhouName, 'zh-Hans-CN'));
  const citiesSmallByZhou = sortZhouCounts(smallByZhou);
  const citiesGateByZhou = sortZhouCounts(gateByZhou);
  const citiesFortByZhou = sortZhouCounts(fortByZhou);

  const citiesList = Array.from(cityRowById.values())
    .map((c) => ({
      cityId: c.city_id,
      cityName: c.city_name || c.city_id,
      cityType: c.city_type,
      zhouName: c.zhouName || null,
      junName: c.junName || null,
    }))
    .sort((a, b) => {
      const ja = String(a.junName || a.zhouName || '').localeCompare(String(b.junName || b.zhouName || ''), 'zh-Hans-CN');
      if (ja !== 0) return ja;
      return String(a.cityName || '').localeCompare(String(b.cityName || ''), 'zh-Hans-CN');
    });

  const totals = computeFactionFiveScalarsFromSums(
    {
      sum_population: aggRow.sum_population,
      sum_trading: aggRow.sum_trading,
      sum_farming: aggRow.sum_farming,
      sum_military: aggRow.sum_military,
      sum_culture: aggRow.sum_culture,
    },
    nSupply
  );
  const { tier: supplyTier } = computeSupplyTier(totals);
  const reserveRecoveryEstimate = estimateDailyReserveRecovery(supplyTier, cityRecoveryCounts);
  const reserveLedgerSummary = await factionReserveService.getLedgerSummaryForFaction(fid, {
    reserveRecoveryEstimate,
  });
  const legendaryLedgerSummary = await factionReserveService.getLegendaryLedgerSummaryForFaction(fid, {
    factionTotals: totals,
  });
  let dailyActivityRanking = [];
  try {
    dailyActivityRanking = await kingDasikongRankingService.listDailyActivityRanking(fid, 10);
  } catch (e) {
    console.warn('[factionOverview] dailyActivityRanking failed:', e.message);
  }

  return {
    data: {
      factionId: fid,
      factionName,
      reserveSilver: poolBal?.silver ?? 0,
      reserveFood: poolBal?.food ?? 0,
      reserveTroopLegendary: poolBal?.troopLegendary ?? 0,
      reserveCharacterLegendary: poolBal?.characterLegendary ?? 0,
      totals,
      supplyTier,
      playerCountReal,
      playerCountNpc,
      legionCount,
      cityCount,
      officeHolders,
      citiesMajorLines,
      citiesMediumLines,
      citiesSmallByZhou,
      citiesGateByZhou,
      citiesFortByZhou,
      playersReal,
      playersNpc,
      legions,
      citiesList,
      cityRecoveryCounts,
      reserveRecoveryEstimate,
      reserveLedgerSummary,
      legendaryLedgerSummary,
      dailyActivityRanking,
    },
  };
}

/**
 * @param {string} playerId
 * @returns {Promise<{ notFound: true } | { data: object }>}
 */
async function getFactionOverviewForPlayer(playerId) {
  const [pRows] = await pool.query(
    'SELECT player_id, faction_id, faction_name FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  if (!pRows.length) return { notFound: true };
  const { faction_id: factionId } = pRows[0];
  if (!factionId) return { data: buildEmptyFactionOverview() };
  return getFactionOverviewByFactionId(factionId);
}

/**
 * 地图 Tab 右侧：san_1 七势力概览（与势力 Tab「势力信息」同源）。
 * @returns {Promise<{ factions: Array<{ factionId: string, overview: object }> }>}
 */
async function listSan1PlayableFactionOverviews() {
  const factions = await Promise.all(
    SAN_1_PLAYABLE_FACTION_IDS.map(async (factionId) => {
      const { data: overview } = await getFactionOverviewByFactionId(factionId);
      return { factionId, overview };
    }),
  );
  return { factions };
}

module.exports = {
  getFactionOverviewForPlayer,
  getFactionOverviewByFactionId,
  listSan1PlayableFactionOverviews,
  OFFICE_SLOTS,
};
