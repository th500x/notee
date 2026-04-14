/**
 * 将领排名：按服务器 + 槽位 bucket 比较「面板七维 + 加权综合分」
 * @see docs/90-assets/92-1-GAME_UI_DESIGN.md §9.1.2
 */

const { pool } = require('../database/connection');
const garrisonService = require('./garrisonService');

const BUCKETS = {
  mainPlayer: 'main:player',
  mainChar1: 'main:character1',
  mainChar2: 'main:character2',
};

/** 与前端 GarrisonStatsPanel 一致：短 bucket 段，避免 temp_character_ranking_snapshots.bucket VARCHAR(48) 溢出 */
function garrisonBucketCitySeg(cityId) {
  const s = String(cityId || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function mergeBaseAndBonusDisplay(base, bonusRaw) {
  const b = bonusRaw || {};
  const add = (k) => Number(base[k] || 0) + Number(b[k] || 0) / 10;
  return {
    luck: add('luck'),
    courage: add('courage'),
    combat: add('combat'),
    command: add('command'),
    intelligence: add('intelligence'),
    politics: add('politics'),
    charm: add('charm'),
  };
}

/**
 * 加权综合分 + 同分比较用八元组（先比 score，再运气→武→…）
 */
function computeRankTuple(attrs) {
  const luck = Number(attrs.luck) || 0;
  const courage = Number(attrs.courage) || 0;
  const combat = Number(attrs.combat) || 0;
  const command = Number(attrs.command) || 0;
  const intelligence = Number(attrs.intelligence) || 0;
  const politics = Number(attrs.politics) || 0;
  const charm = Number(attrs.charm) || 0;
  const score =
    luck * 1.1 +
    courage +
    combat +
    command +
    intelligence +
    politics * 0.9 +
    charm * 0.9;
  const rounded = Math.round(score * 1e6) / 1e6;
  return {
    score: rounded,
    luck,
    combat,
    courage,
    command,
    intelligence,
    politics,
    charm,
  };
}

async function getServerIdForPlayer(playerId) {
  const [accRows] = await pool.query('SELECT serverId FROM accounts WHERE id = ?', [playerId]);
  return accRows[0]?.serverId || null;
}

async function loadPlayerBaseRow(playerId) {
  const [rows] = await pool.query(
    `SELECT luck, courage, combat, command, intelligence, politics, charm FROM players WHERE player_id = ?`,
    [playerId]
  );
  return rows[0] || null;
}

function playerRowToDisplayBase(row) {
  if (!row) return null;
  return {
    luck: Number(row.luck || 0) / 10,
    courage: Number(row.courage || 0) / 10,
    combat: Number(row.combat || 0) / 10,
    command: Number(row.command || 0) / 10,
    intelligence: Number(row.intelligence || 0) / 10,
    politics: Number(row.politics || 0) / 10,
    charm: Number(row.charm || 0) / 10,
  };
}

async function loadEquippedCharacterBase(poolConn, playerId, equippedBy) {
  const [rows] = await poolConn.query(
    `SELECT cc.luck, cc.courage, cc.combat, cc.command, cc.intelligence, cc.politics, cc.charm
     FROM player_cards pc
     JOIN config_characters cc ON pc.card_id = cc.character_id
     WHERE pc.player_id = ? AND pc.card_type = 'character' AND pc.is_equipped = TRUE
       AND pc.equipped_by = ? AND pc.equipped_slot = 'character'
     LIMIT 1`,
    [playerId, equippedBy]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    luck: Number(r.luck || 0) / 10,
    courage: Number(r.courage || 0) / 10,
    combat: Number(r.combat || 0) / 10,
    command: Number(r.command || 0) / 10,
    intelligence: Number(r.intelligence || 0) / 10,
    politics: Number(r.politics || 0) / 10,
    charm: Number(r.charm || 0) / 10,
  };
}

async function loadGarrisonCharacterBase(poolConn, instanceId, playerId) {
  const [rows] = await poolConn.query(
    `SELECT cc.luck, cc.courage, cc.combat, cc.command, cc.intelligence, cc.politics, cc.charm
     FROM player_cards pc
     JOIN config_characters cc ON pc.card_id = cc.character_id
     WHERE pc.instance_id = ? AND pc.player_id = ? AND pc.card_type = 'character'`,
    [instanceId, playerId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    luck: Number(r.luck || 0) / 10,
    courage: Number(r.courage || 0) / 10,
    combat: Number(r.combat || 0) / 10,
    command: Number(r.command || 0) / 10,
    intelligence: Number(r.intelligence || 0) / 10,
    politics: Number(r.politics || 0) / 10,
    charm: Number(r.charm || 0) / 10,
  };
}

async function upsertSnapshotRow(conn, playerId, serverId, bucket, tuple) {
  await conn.query(
    `INSERT INTO temp_character_ranking_snapshots
     (player_id, server_id, bucket, ranking_score, luck, combat, courage, command, intelligence, politics, charm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       server_id = VALUES(server_id),
       ranking_score = VALUES(ranking_score),
       luck = VALUES(luck),
       combat = VALUES(combat),
       courage = VALUES(courage),
       command = VALUES(command),
       intelligence = VALUES(intelligence),
       politics = VALUES(politics),
       charm = VALUES(charm),
       updated_at = CURRENT_TIMESTAMP`,
    [
      playerId,
      serverId,
      bucket,
      tuple.score,
      tuple.luck,
      tuple.combat,
      tuple.courage,
      tuple.command,
      tuple.intelligence,
      tuple.politics,
      tuple.charm,
    ]
  );
}

/**
 * 重算并写入当前玩家所有槽位快照（先删后插，避免残留旧 bucket）
 */
async function refreshSnapshotsForPlayer(playerId) {
  try {
    const serverId = await getServerIdForPlayer(playerId);
    if (!serverId) return { ok: false, error: 'no_server' };

    const bonusMain = await garrisonService.getMainLineupAttributeBonusBySlot(pool, playerId);
    const pRow = await loadPlayerBaseRow(playerId);
    const basePlayer = playerRowToDisplayBase(pRow);

    const conn = pool;
    await conn.query('DELETE FROM temp_character_ranking_snapshots WHERE player_id = ?', [playerId]);

    if (basePlayer) {
      const eff = mergeBaseAndBonusDisplay(basePlayer, bonusMain.player || {});
      const tuple = computeRankTuple(eff);
      await upsertSnapshotRow(conn, playerId, serverId, BUCKETS.mainPlayer, tuple);
    }

    for (const equippedBy of ['character1', 'character2']) {
      const base = await loadEquippedCharacterBase(conn, playerId, equippedBy);
      if (!base) continue;
      const eff = mergeBaseAndBonusDisplay(base, bonusMain[equippedBy] || {});
      const tuple = computeRankTuple(eff);
      await upsertSnapshotRow(
        conn,
        playerId,
        serverId,
        equippedBy === 'character1' ? BUCKETS.mainChar1 : BUCKETS.mainChar2,
        tuple
      );
    }

    const garrisons = await garrisonService.getPlayerGarrisons(playerId);
    for (const g of garrisons) {
      const slotNum = g.garrison_slot;
      const garBonus = await garrisonService.getGarrisonSlotAttributeBonusByChar(conn, g);

      for (const charKey of ['char1', 'char2']) {
        const cardField = `${charKey}_card`;
        const inst = g[cardField];
        if (!inst) continue;
        const base = await loadGarrisonCharacterBase(conn, inst, playerId);
        if (!base) continue;
        const eff = mergeBaseAndBonusDisplay(base, garBonus[charKey] || {});
        const tuple = computeRankTuple(eff);
        const bucket = `garrison:${garrisonBucketCitySeg(g.city_id)}:${slotNum}:${charKey}`;
        await upsertSnapshotRow(conn, playerId, serverId, bucket, tuple);
      }
    }

    return { ok: true, serverId };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[CharacterRank] temp_character_ranking_snapshots 未创建，请执行 migrations/create-temp-character-ranking-snapshots.sql');
      return { ok: false, error: 'no_table' };
    }
    throw e;
  }
}

/**
 * @param {string} bucket - main:player | main:character1 | main:character2 | garrison:N:char1|char2
 */
async function getCharacterRankForBucket(playerId, bucket) {
  const refresh = await refreshSnapshotsForPlayer(playerId);
  if (!refresh.ok) {
    const err = refresh.error === 'no_table' ? '排名表未初始化' : '无法解析服务器';
    return { success: false, error: err, rank: null, total: 0, score: null };
  }
  const { serverId } = refresh;

  const [mine] = await pool.query(
    `SELECT ranking_score, luck, combat, courage, command, intelligence, politics, charm
     FROM temp_character_ranking_snapshots
     WHERE player_id = ? AND bucket = ?`,
    [playerId, bucket]
  );
  if (!mine.length) {
    const [[{ total = 0 } = {}]] = await pool.query(
      `SELECT COUNT(*) AS total FROM temp_character_ranking_snapshots WHERE server_id = ? AND bucket = ?`,
      [serverId, bucket]
    );
    return {
      success: true,
      rank: null,
      total: Number(total) || 0,
      score: null,
      bucket,
      message: '当前槽位无将领或未生成快照',
    };
  }

  const m = mine[0];
  const [[{ total = 0 } = {}]] = await pool.query(
    `SELECT COUNT(*) AS total FROM temp_character_ranking_snapshots WHERE server_id = ? AND bucket = ?`,
    [serverId, bucket]
  );

  const [higherRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM temp_character_ranking_snapshots t
     WHERE t.server_id = ? AND t.bucket = ?
     AND (t.ranking_score, t.luck, t.combat, t.courage, t.command, t.intelligence, t.politics, t.charm)
     > (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      serverId,
      bucket,
      m.ranking_score,
      m.luck,
      m.combat,
      m.courage,
      m.command,
      m.intelligence,
      m.politics,
      m.charm,
    ]
  );
  const higher = Number(higherRows[0]?.c || 0);
  const rank = higher + 1;

  return {
    success: true,
    rank,
    total: Number(total) || 0,
    score: Number(m.ranking_score),
    bucket,
  };
}

/** 删除超过 TTL 未刷新的快照行（不活跃玩家不再参与排名分母）。由 server 定时调用。 */
async function deleteExpiredSnapshots() {
  try {
    const [r] = await pool.query(
      `DELETE FROM temp_character_ranking_snapshots WHERE updated_at < DATE_SUB(NOW(), INTERVAL 14 DAY)`
    );
    return { affectedRows: r.affectedRows || 0 };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return { affectedRows: 0 };
    throw e;
  }
}

module.exports = {
  BUCKETS,
  computeRankTuple,
  mergeBaseAndBonusDisplay,
  refreshSnapshotsForPlayer,
  getCharacterRankForBucket,
  deleteExpiredSnapshots,
};
