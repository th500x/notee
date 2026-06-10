/**
 * 角色创建流程服务
 *
 * 封装角色创建向导中全部 SQL 与业务逻辑：
 *   - 可用势力查询（带玩家数与推荐标记）
 *   - 初始部队选项
 *   - 创建进度草稿（temp_character_creation）CRUD
 *   - 属性批次生成
 */

const { pool } = require('../database/connection');
const PlayerService = require('./playerService');
const { formatTroopData, CONFIG_TROOPS_SELECT_COLUMNS } = require('./configService');
const { getFactionFromTroopId } = require('./troopIdHelpers');
const { attachBalanceBonusPreviewToFactions } = require('./factionBalanceBonusService');
const { resolveCampaignConfigSeason } = require('../../shared/utils/seasonSettlementCore.cjs');

// ── 势力 ──────────────────────────────────────────────────────────────────────

/** MySQL JSON 列在部分驱动/版本下以字符串返回，统一解析为数组 */
function parseFactionBonuses(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * 获取当前账号可选的势力列表（含当前玩家数与推荐标记）。
 * @returns {{ notFound: true } | { factions: Array }}
 */
async function getAvailableFactions(playerId) {
  const [accounts] = await pool.query(
    'SELECT current_season, serverId FROM accounts WHERE id = ?',
    [playerId],
  );
  if (accounts.length === 0) return { notFound: true };

  const { current_season, serverId } = accounts[0];
  const targetSeason = resolveCampaignConfigSeason(current_season);

  const [factions] = await pool.query(
    `SELECT
       f.faction_id, f.faction_name, f.faction_leader, f.initial_city_id, f.icon, f.color,
       f.style, f.max_players, f.faction_bonuses, f.description, f.difficulty,
       c.character_name AS leader_name
     FROM config_factions f
     LEFT JOIN config_characters c ON f.faction_leader = c.character_id
     WHERE f.season = ?
     ORDER BY f.faction_id ASC`,
    [targetSeason],
  );

  for (const f of factions) {
    f.faction_bonuses = parseFactionBonuses(f.faction_bonuses);
    const ic = f.initial_city_id;
    if (ic != null && String(ic).trim() !== '') {
      f.initialCityId = String(ic).trim();
    }
    delete f.initial_city_id;
  }

  for (const faction of factions) {
    const [counts] = await pool.query(
      `SELECT COUNT(*) AS player_count
       FROM players p
       JOIN accounts a ON p.player_id = a.id
       WHERE p.faction_id = ? AND a.serverId = ?`,
      [faction.faction_id, serverId],
    );
    faction.current_players = counts[0].player_count;
    faction.is_full        = faction.current_players >= faction.max_players;
    faction.recommended    = faction.difficulty === '简单';
  }

  attachBalanceBonusPreviewToFactions(factions);

  return { factions };
}

// ── 初始部队选项 ──────────────────────────────────────────────────────────────

/**
 * 获取角色创建时初始部队选项（势力专属 rare + 通用 rare）。
 * @returns {{ troops: Array }}
 */
async function getInitialTroopOptions(factionId) {
  const season = factionId.split('_').slice(0, 2).join('_');
  // 从 san_1_faction_1001 提取 1001，取第一位得到 "1"
  const factionNumber  = factionId.split('_')[3];
  const factionPrefix  = `${season}_troop_${factionNumber.charAt(0)}`;

  const [factionTroops] = await pool.query(
    `SELECT ${CONFIG_TROOPS_SELECT_COLUMNS} FROM config_troops
     WHERE season = ? AND rarity = 'rare' AND troop_id LIKE ?
     ORDER BY troop_id ASC`,
    [season, `${factionPrefix}%`],
  );

  const [commonTroops] = await pool.query(
    `SELECT ${CONFIG_TROOPS_SELECT_COLUMNS} FROM config_troops
     WHERE season = ? AND rarity = 'rare' AND troop_id LIKE ?
     ORDER BY troop_id ASC`,
    [season, `${season}_troop_0%`],
  );

  const troops = [...factionTroops, ...commonTroops].map((troop) => {
    const formatted = formatTroopData(troop);
    formatted.faction = getFactionFromTroopId(troop.troop_id);
    return formatted;
  });

  return { troops };
}

// ── 创建进度草稿（temp_character_creation） ───────────────────────────────────

/**
 * 读取创建进度草稿。返回 null 表示尚未开始。
 */
async function getCreationProgress(playerId) {
  const [rows] = await pool.query(
    'SELECT * FROM temp_character_creation WHERE player_id = ?',
    [playerId],
  );
  if (rows.length === 0) return null;

  const progress = rows[0];
  if (progress.random_batches && typeof progress.random_batches === 'string') {
    progress.random_batches = JSON.parse(progress.random_batches);
  }
  if (progress.selected_troops && typeof progress.selected_troops === 'string') {
    progress.selected_troops = JSON.parse(progress.selected_troops);
  }
  return progress;
}

/**
 * 保存（upsert）创建进度草稿。
 */
async function saveCreationProgress(playerId, progressData) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const data = {
    player_id:              playerId,
    current_step:           progressData.current_step           || 1,
    selected_faction_id:    progressData.selected_faction_id    || null,
    selected_faction_name:  progressData.selected_faction_name  || null,
    selected_avatar:        progressData.selected_avatar        || null,
    character_name:         progressData.character_name         || null,
    remaining_silver:       progressData.remaining_silver !== undefined ? progressData.remaining_silver : 50,
    random_cost:            progressData.random_cost            || 10,
    current_batch:          progressData.current_batch          || 1,
    random_batches:         progressData.random_batches         ? JSON.stringify(progressData.random_batches) : null,
    selected_option_batch:  progressData.selected_option_batch  || null,
    selected_option_index:  progressData.selected_option_index  || null,
    selected_troops:        progressData.selected_troops        ? JSON.stringify(progressData.selected_troops) : null,
    expires_at:             expiresAt,
  };

  await pool.query(
    `INSERT INTO temp_character_creation SET ?
     ON DUPLICATE KEY UPDATE
       current_step           = VALUES(current_step),
       selected_faction_id    = VALUES(selected_faction_id),
       selected_faction_name  = VALUES(selected_faction_name),
       selected_avatar        = VALUES(selected_avatar),
       character_name         = VALUES(character_name),
       remaining_silver       = VALUES(remaining_silver),
       random_cost            = VALUES(random_cost),
       current_batch          = VALUES(current_batch),
       random_batches         = VALUES(random_batches),
       selected_option_batch  = VALUES(selected_option_batch),
       selected_option_index  = VALUES(selected_option_index),
       selected_troops        = VALUES(selected_troops),
       updated_at             = CURRENT_TIMESTAMP`,
    [data],
  );
}

/**
 * 删除创建进度草稿（角色创建完成后调用）。
 */
async function deleteCreationProgress(playerId) {
  await pool.query(
    'DELETE FROM temp_character_creation WHERE player_id = ?',
    [playerId],
  );
}

// ── 属性批次生成 ──────────────────────────────────────────────────────────────

/**
 * 生成下一批属性方案，扣除银两，返回新批次数据。
 * @returns {{ notFound: true } | { insufficientSilver: true, cost: number } | { data: object }}
 */
async function generateAttributesBatch(playerId, rarity = 'common') {
  const [rows] = await pool.query(
    'SELECT remaining_silver, random_cost, random_batches FROM temp_character_creation WHERE player_id = ?',
    [playerId],
  );
  if (rows.length === 0) return { notFound: true };

  const { remaining_silver, random_cost, random_batches } = rows[0];
  const batches     = random_batches
    ? (typeof random_batches === 'string' ? JSON.parse(random_batches) : random_batches)
    : [];
  const batchNumber = batches.length + 1;
  const cost        = batchNumber === 1 ? 0 : random_cost; // 第一批免费

  if (remaining_silver < cost) return { insufficientSilver: true, cost };

  const options = await PlayerService.generateAttributeOptions(rarity);
  const newBatch = {
    batch:     batchNumber,
    timestamp: new Date().toISOString(),
    cost,
    options,
  };
  batches.push(newBatch);

  const newRemainingSilver = remaining_silver - cost;
  await pool.query(
    `UPDATE temp_character_creation
     SET remaining_silver = ?, current_batch = ?, random_batches = ?, updated_at = CURRENT_TIMESTAMP
     WHERE player_id = ?`,
    [newRemainingSilver, batchNumber, JSON.stringify(batches), playerId],
  );

  return {
    data: {
      batch:            batchNumber,
      timestamp:        newBatch.timestamp,
      cost,
      options,
      remaining_silver: newRemainingSilver,
    },
  };
}

/**
 * 记录玩家在创建流程中选中的属性方案。
 */
async function selectAttributeOption(playerId, batch, index) {
  await pool.query(
    `UPDATE temp_character_creation
     SET selected_option_batch = ?, selected_option_index = ?, updated_at = CURRENT_TIMESTAMP
     WHERE player_id = ?`,
    [batch, index, playerId],
  );
}

module.exports = {
  getAvailableFactions,
  getInitialTroopOptions,
  getCreationProgress,
  saveCreationProgress,
  deleteCreationProgress,
  generateAttributesBatch,
  selectAttributeOption,
};
