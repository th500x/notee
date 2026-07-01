/**
 * AI 玩家播种服务（Step 1）。
 *
 * 复用真人创角链路：账号建立 → PlayerService.createCharacter（属性/技能/初始部队/城市/道路全部走真人同一函数）
 * → 写 ai_players 行为基线。AI 与真人唯一差异为 accounts.account_type='ai'（禁止登录、不计 max_players）
 * 与「无人工向导、由本服务批量生成」。
 *
 * 设计文档：docs/40-ai/42-1-AI_PLAYER_SYSTEM.md §2/§3，42-2-AI_PLAYER_IMPLEMENTATION.md Step 1。
 */

const bcrypt = require('bcrypt');
const { pool } = require('../database/connection');
const PlayerService = require('./playerService');
const Player = require('../models/Player');
const { getInitialTroopOptions } = require('./playerCreationService');
const { deleteAccount } = require('./accountService');
const { resolveCampaignConfigSeason } = require('../../shared/utils/seasonSettlementCore.cjs');
const { AI_PLAYER_SEED, ELITE_AI_DEFAULTS } = require('../config/aiPlayerBehavior');
const namePool = require('../data/ai-player-names.json');

// AI id 命名空间：首位固定 'A'（真人注册 id 首位为数字，互不冲突），后随 3 位 [A-Z2-9]
const AI_ID_PREFIX = 'A';
const AI_ID_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
// 占位密码哈希；AI 账号在 accountService.login 已被 account_type 拦截，永不参与比对
const NO_LOGIN_PASSWORD_HASH = bcrypt.hashSync('__AI_NO_LOGIN__', 10);
const PLACEHOLDER_IP = '240.0.0.253';

const MAX_ATTEMPTS = 200;

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 生成一个全库唯一的 AI 账号 id（A + 3 位）。
 * @param {Set<string>} usedIds 本次会话已占用集合
 */
async function generateUniqueAiId(usedIds) {
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    let id = AI_ID_PREFIX;
    for (let k = 0; k < 3; k += 1) id += randomFrom([...AI_ID_CHARS]);
    if (usedIds.has(id)) continue;
    const [rows] = await pool.query('SELECT 1 FROM accounts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      usedIds.add(id);
      return id;
    }
  }
  throw new Error('生成唯一 AI id 失败（尝试次数耗尽）');
}

/**
 * 生成一个该服内唯一、且通过 validateCharacterName 的中文角色名（surname + 1~2 given）。
 * @param {string} serverId
 * @param {Set<string>} usedNames 本次会话已占用集合
 */
async function generateUniqueName(serverId, usedNames) {
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const surname = randomFrom(namePool.surnames);
    const givenLen = Math.random() < 0.5 ? 1 : 2;
    let given = '';
    for (let k = 0; k < givenLen; k += 1) given += randomFrom(namePool.givenChars);
    const name = surname + given;

    if (usedNames.has(name)) continue;
    if (!PlayerService.validateCharacterName(name).valid) continue;
    const taken = await Player.isNameTaken(name, serverId);
    if (taken) continue;

    usedNames.add(name);
    return name;
  }
  throw new Error('生成唯一 AI 角色名失败（尝试次数耗尽）');
}

/**
 * 创建单个 elite AI 玩家。失败时回滚已插入的 accounts 行，避免产生孤儿账号。
 * @returns {Promise<string>} 新建的 AI 账号 id
 */
async function createOneAiPlayer({ factionId, factionName, serverId, currentSeason, usedIds, usedNames }) {
  const id = await generateUniqueAiId(usedIds);
  const characterName = await generateUniqueName(serverId, usedNames);

  await pool.query(
    `INSERT INTO accounts (id, password, birthMonth, serverId, current_season, machineId, clientIP, account_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ai', 'active')`,
    [
      id,
      NO_LOGIN_PASSWORD_HASH,
      1 + Math.floor(Math.random() * 12),
      serverId,
      currentSeason,
      `san-storm-ai-${id}`,
      PLACEHOLDER_IP,
    ],
  );

  try {
    // 属性/技能：走真人创角生成器（common 档），随机选用 3 方案之一，与真人同口径
    const options = await PlayerService.generateAttributeOptions('common');
    const chosen = randomFrom(options);

    // 初始部队：与真人一致恰好 2 个，从势力初始部队选项中随机不重复抽取
    const { troops } = await getInitialTroopOptions(factionId);
    const initialTroops = pickTwoTroopIds(troops);

    await PlayerService.createCharacter({
      playerId: id,
      characterName,
      factionId,
      factionName,
      attributes: chosen.attributesInt,
      skills: chosen.skills,
      serverId,
      initialSilver: 0,
      avatar: null,
      initialTroops,
    });

    await pool.query(
      `INSERT INTO ai_players
         (player_id, ai_type, event_participation_types, pvp_participation,
          chat_frequency, battle_strategy, resource_strategy, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        id,
        ELITE_AI_DEFAULTS.aiType,
        ELITE_AI_DEFAULTS.eventParticipationTypes,
        ELITE_AI_DEFAULTS.pvpParticipation,
        ELITE_AI_DEFAULTS.chatFrequency,
        ELITE_AI_DEFAULTS.battleStrategy,
        ELITE_AI_DEFAULTS.resourceStrategy,
      ],
    );

    return id;
  } catch (err) {
    // 创角失败：清理已写入的账号行，保持账号/角色一致，便于重跑
    await pool.query('DELETE FROM accounts WHERE id = ?', [id]).catch(() => {});
    usedIds.delete(id);
    usedNames.delete(characterName);
    throw err;
  }
}

/**
 * 从初始部队选项中抽取两个不重复的 troop_id。
 */
function pickTwoTroopIds(troops) {
  const ids = (troops || []).map((t) => t.id).filter(Boolean);
  if (ids.length < 2) {
    throw new Error(`初始部队选项不足 2 个（实际 ${ids.length}），无法创建 AI 角色`);
  }
  const first = Math.floor(Math.random() * ids.length);
  let second = Math.floor(Math.random() * ids.length);
  while (second === first) second = Math.floor(Math.random() * ids.length);
  return [ids[first], ids[second]];
}

/**
 * 统计某势力在某服已有的 AI 玩家数量。
 */
async function countAiPlayersInFaction(factionId, serverId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
       FROM players p
       JOIN accounts a ON p.player_id = a.id
      WHERE p.faction_id = ? AND a.serverId = ? AND a.account_type = 'ai'`,
    [factionId, serverId],
  );
  return Number(rows[0]?.cnt) || 0;
}

/**
 * 幂等播种：把目标服每个势力的 elite AI 补齐到 perFaction 人。
 * @param {object} [opts]
 * @param {number} [opts.perFaction] 每势力目标人数（默认取配置）
 * @param {string} [opts.serverId] 目标服务器（默认取配置）
 * @returns {Promise<{ serverId: string, currentSeason: string, campaignSeason: string, perFaction: number, factions: Array, totalCreated: number }>}
 */
async function seedAiPlayers(opts = {}) {
  const perFaction = opts.perFaction || AI_PLAYER_SEED.perFaction;
  const serverId = opts.serverId || AI_PLAYER_SEED.serverId;

  const [serverRows] = await pool.query(
    'SELECT current_season FROM config_servers WHERE server_id = ? LIMIT 1',
    [serverId],
  );
  if (serverRows.length === 0) {
    throw new Error(`目标服务器不存在：${serverId}（请确认 config_servers 已初始化）`);
  }
  const currentSeason = serverRows[0].current_season;
  const campaignSeason = resolveCampaignConfigSeason(currentSeason);

  const allowFactionIds = (opts.factionIds || AI_PLAYER_SEED.factionIds || []).filter(Boolean);
  const [allFactions] = await pool.query(
    'SELECT faction_id, faction_name FROM config_factions WHERE season = ? ORDER BY faction_id ASC',
    [campaignSeason],
  );
  if (allFactions.length === 0) {
    throw new Error(`赛季 ${campaignSeason} 未找到任何势力配置，无法播种`);
  }
  // 仅对白名单内的可玩势力播种；空白名单视为该服全部势力
  const factions = allowFactionIds.length
    ? allFactions.filter((f) => allowFactionIds.includes(f.faction_id))
    : allFactions;
  if (factions.length === 0) {
    throw new Error(`白名单势力均不存在于赛季 ${campaignSeason}：${allowFactionIds.join(', ')}`);
  }

  const usedIds = new Set();
  const usedNames = new Set();
  const summary = [];
  let totalCreated = 0;

  for (const faction of factions) {
    const existing = await countAiPlayersInFaction(faction.faction_id, serverId);
    const toCreate = Math.max(0, perFaction - existing);
    let created = 0;
    for (let i = 0; i < toCreate; i += 1) {
      await createOneAiPlayer({
        factionId: faction.faction_id,
        factionName: faction.faction_name,
        serverId,
        currentSeason,
        usedIds,
        usedNames,
      });
      created += 1;
    }
    totalCreated += created;
    summary.push({
      factionId: faction.faction_id,
      factionName: faction.faction_name,
      existing,
      created,
      total: existing + created,
    });
  }

  return { serverId, currentSeason, campaignSeason, perFaction, factions: summary, totalCreated };
}

/**
 * 清理「不在白名单势力」或「无角色行」的 AI 账号（复用 accountService.deleteAccount 的级联删除）。
 * 用于阶段性收窄可玩势力时移除多余 AI；空白名单时只清理孤儿账号。
 * @param {object} [opts]
 * @param {string[]} [opts.factionIds] 允许保留的势力（默认取配置白名单）
 * @param {string} [opts.serverId] 目标服务器（默认取配置）
 * @returns {Promise<{ serverId: string, deletedIds: string[] }>}
 */
async function pruneAiPlayersOutsideFactions(opts = {}) {
  const serverId = opts.serverId || AI_PLAYER_SEED.serverId;
  const allow = (opts.factionIds || AI_PLAYER_SEED.factionIds || []).filter(Boolean);

  const [rows] = await pool.query(
    `SELECT a.id, p.faction_id
       FROM accounts a
       LEFT JOIN players p ON p.player_id = a.id
      WHERE a.account_type = 'ai' AND a.serverId = ?`,
    [serverId],
  );

  const deletedIds = [];
  for (const row of rows) {
    const outside = allow.length > 0 && row.faction_id && !allow.includes(row.faction_id);
    const orphan = !row.faction_id;
    if (outside || orphan) {
      await deleteAccount(row.id);
      deletedIds.push(row.id);
    }
  }
  return { serverId, deletedIds };
}

/** 读某服 current_season + campaign 赛季（创建/统计共用）。 */
async function resolveServerSeasons(serverId) {
  const [serverRows] = await pool.query(
    'SELECT current_season FROM config_servers WHERE server_id = ? LIMIT 1',
    [serverId],
  );
  if (serverRows.length === 0) {
    throw new Error(`目标服务器不存在：${serverId}（请确认 config_servers 已初始化）`);
  }
  const currentSeason = serverRows[0].current_season;
  return { currentSeason, campaignSeason: resolveCampaignConfigSeason(currentSeason) };
}

/**
 * 把某势力在某服的 AI 人数精确设为 targetCount：不足则按 elite 基线补齐，超出则删除多余。
 * 删除优先级：先删已休眠（is_active=0），再删较新的（player_id 倒序），尽量保留"老"AI。
 * @param {object} opts
 * @param {string} opts.factionId
 * @param {number} opts.targetCount  目标人数（>=0）
 * @param {string} [opts.serverId]
 * @returns {Promise<{factionId:string, factionName:string|null, before:number, after:number, created:number, deleted:number, deletedIds:string[]}>}
 */
async function setFactionAiCount({ factionId, targetCount, serverId } = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) throw new Error('缺少 factionId');
  const target = Math.max(0, Math.min(500, Number.parseInt(targetCount, 10)));
  if (!Number.isFinite(target)) throw new Error('targetCount 非法');
  const srv = serverId || AI_PLAYER_SEED.serverId;

  const { currentSeason, campaignSeason } = await resolveServerSeasons(srv);
  const [factionRows] = await pool.query(
    'SELECT faction_id, faction_name FROM config_factions WHERE season = ? AND faction_id = ? LIMIT 1',
    [campaignSeason, fid],
  );
  const factionName = factionRows[0]?.faction_name || null;
  if (!factionName) {
    throw new Error(`势力不存在于赛季 ${campaignSeason}：${fid}`);
  }

  const before = await countAiPlayersInFaction(fid, srv);
  let created = 0;
  const deletedIds = [];

  if (before < target) {
    const usedIds = new Set();
    const usedNames = new Set();
    for (let i = 0; i < target - before; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createOneAiPlayer({ factionId: fid, factionName, serverId: srv, currentSeason, usedIds, usedNames });
      created += 1;
    }
  } else if (before > target) {
    const removeN = before - target;
    const [rows] = await pool.query(
      `SELECT p.player_id AS playerId
         FROM players p
         INNER JOIN accounts a ON a.id = p.player_id
         LEFT JOIN ai_players ai ON ai.player_id = p.player_id
        WHERE p.faction_id = ? AND a.serverId = ? AND a.account_type = 'ai'
        ORDER BY COALESCE(ai.is_active, 1) ASC, p.player_id DESC
        LIMIT ?`,
      [fid, srv, removeN],
    );
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      await deleteAccount(r.playerId);
      deletedIds.push(r.playerId);
    }
  }

  const after = await countAiPlayersInFaction(fid, srv);
  return { factionId: fid, factionName, before, after, created, deleted: deletedIds.length, deletedIds };
}

/**
 * 势力级 AI 休眠/唤醒（不删档）：批量置 `ai_players.is_active`。
 * @returns {Promise<{factionId:string, active:boolean, affected:number}>}
 */
async function setFactionAiActive({ factionId, active, serverId } = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) throw new Error('缺少 factionId');
  const srv = serverId || AI_PLAYER_SEED.serverId;
  const [res] = await pool.query(
    `UPDATE ai_players ai
       INNER JOIN players p ON p.player_id = ai.player_id
       INNER JOIN accounts a ON a.id = p.player_id
        SET ai.is_active = ?
      WHERE p.faction_id = ? AND a.serverId = ? AND a.account_type = 'ai'`,
    [active ? 1 : 0, fid, srv],
  );
  return { factionId: fid, active: !!active, affected: res.affectedRows || 0 };
}

/**
 * 各势力 AI 人数总览（total + 在岗 active）。默认覆盖播种白名单势力（即使为 0 也列出），
 * 并追加库中存在但不在白名单的势力，便于发现历史遗留。
 * @returns {Promise<{serverId:string, factions:Array<{factionId:string, factionName:string|null, total:number, active:number, whitelisted:boolean}>}>}
 */
async function getFactionAiOverview({ serverId } = {}) {
  const srv = serverId || AI_PLAYER_SEED.serverId;
  const { campaignSeason } = await resolveServerSeasons(srv);
  const whitelist = (AI_PLAYER_SEED.factionIds || []).filter(Boolean);

  const [countRows] = await pool.query(
    `SELECT p.faction_id AS factionId,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(ai.is_active, 1) = 1 THEN 1 ELSE 0 END) AS active
       FROM players p
       INNER JOIN accounts a ON a.id = p.player_id
       LEFT JOIN ai_players ai ON ai.player_id = p.player_id
      WHERE a.serverId = ? AND a.account_type = 'ai'
      GROUP BY p.faction_id`,
    [srv],
  );
  const countByFaction = new Map(countRows.map((r) => [String(r.factionId), r]));

  const [nameRows] = await pool.query(
    'SELECT faction_id, faction_name FROM config_factions WHERE season = ?',
    [campaignSeason],
  );
  const nameByFaction = new Map(nameRows.map((r) => [String(r.faction_id), r.faction_name]));

  const factionIds = new Set([...whitelist, ...countByFaction.keys()]);
  const factions = [...factionIds].sort().map((fid) => {
    const row = countByFaction.get(fid);
    return {
      factionId: fid,
      factionName: nameByFaction.get(fid) || null,
      total: Number(row?.total) || 0,
      active: Number(row?.active) || 0,
      whitelisted: whitelist.includes(fid),
    };
  });
  return { serverId: srv, campaignSeason, factions };
}

module.exports = {
  seedAiPlayers,
  pruneAiPlayersOutsideFactions,
  createOneAiPlayer,
  countAiPlayersInFaction,
  generateUniqueAiId,
  generateUniqueName,
  setFactionAiCount,
  setFactionAiActive,
  getFactionAiOverview,
};
