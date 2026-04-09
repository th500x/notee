/**
 * 奖励执行服务
 * 
 * @description 处理事件奖励的解析和发放
 *   - 资源：silver, food, reputation, contribution, morale
 *   - 道具：san_1_item_xxx → players.items JSON
 *   - 具体卡牌：san_1_troop_x001 → player_cards（势力通配符替换）
 *   - 随机卡牌：random:type:rarity:qty → 从config表随机抽取
 * 
 * @module services/rewardService
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');

/** MySQL ENUM / 大小写 / 空值 → 标准稀有度字符串 */
function normalizeEnumRarity(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).toLowerCase().trim();
  return ['common', 'rare', 'epic', 'legendary', 'core'].includes(s) ? s : '';
}

let _troopJsonRarityById = null;
function loadTroopJsonRarityMap() {
  if (_troopJsonRarityById) return _troopJsonRarityById;
  _troopJsonRarityById = new Map();
  try {
    const jsonPath = path.join(__dirname, '../../public/data/shared/troops.json');
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    (j.troops || []).forEach((t) => {
      if (t.id) _troopJsonRarityById.set(t.id, normalizeEnumRarity(t.rarity) || 'common');
    });
  } catch (e) {
    console.warn('[rewardService] troops.json 稀有度回退不可用:', e.message);
  }
  return _troopJsonRarityById;
}

/** 部队配置稀有度：优先 DB，缺失或非标准值时用共享 JSON（避免走错误的「全局 core 上限2」分支） */
async function resolveTroopRarity(connection, troopId) {
  const [cfg] = await connection.query(
    'SELECT rarity FROM config_troops WHERE troop_id = ?',
    [troopId]
  );
  const fromDb = normalizeEnumRarity(cfg[0]?.rarity);
  if (fromDb) return fromDb;
  const map = loadTroopJsonRarityMap();
  return map.get(troopId) || 'common';
}

// ── 运势倍率表 ──────────────────────────────────────────────

const FORTUNE_MULTIPLIERS = {
  '鸿运': 1.5,
  '大吉': 1.2,
  '吉':   1.0,
  '凶':   0.8,
  '大凶': 0.5,
};

// ── 运势等级判定 ─────────────────────────────────────────────

const FORTUNE_LEVELS = [
  { name: '鸿运', min: 120 },
  { name: '大吉', min: 100 },
  { name: '吉',   min: 80 },
  { name: '凶',   min: 60 },
  { name: '大凶', min: 0 },
];

const DICE_TABLE = [
  { dice: 6, multiplier: 1.2 },
  { dice: 5, multiplier: 1.1 },
  { dice: 4, multiplier: 1.0 },
  { dice: 3, multiplier: 0.9 },
  { dice: 2, multiplier: 0.8 },
  { dice: 1, multiplier: 0.7 },
];

function getFortuneByRate(rate) {
  for (const f of FORTUNE_LEVELS) {
    if (rate >= f.min) return f;
  }
  return FORTUNE_LEVELS[4];
}

// ── 副因子计算 ───────────────────────────────────────────────

function calcSubFactor(type, char) {
  if (type === 'military') return (char.courage + char.command + char.combat) / 3;
  if (type === 'strategist') return (char.intelligence + char.politics + char.charm) / 3;
  return (char.courage + char.command + char.combat + char.intelligence + char.politics + char.charm) / 6;
}


// ── 后端重算 multiplier ──────────────────────────────────────

/**
 * 后端重新计算运势倍率（不信任前端传值）
 * 
 * @param {Object} option - 事件选项配置（从config_events解析）
 * @param {Object} playerChar - 玩家角色属性（显示值，个位数）
 * @param {Object} general1 - 将领1属性（显示值）
 * @param {Object} general2 - 将领2属性（显示值）
 * @returns {{ fortuneName: string, multiplier: number, dice: number, finalRate: number }}
 */
function calculateFortune(option, playerChar, general1, general2) {
  // always 判定 → 直接吉（100%）
  if (option.mainFactor === 'always') {
    return { fortuneName: '吉', multiplier: 1.0, dice: 4, finalRate: 100 };
  }

  // minigame 判定 → 由前端小游戏结果决定，后端默认吉
  // 实际判定在 routes/players.js 中根据 minigameResult 处理
  // 胜利时投骰子：5或6点 → 鸿运（触发bonus_rewards），其余 → 吉
  if (option.mainFactor === 'minigame') {
    return { fortuneName: '吉', multiplier: 1.0, dice: 4, finalRate: 100 };
  }

  // luck 判定 → 完全照抄前端 calcBaseScore 逻辑
  const teamLuck = (playerChar.luck + general1.luck + general2.luck) / 3;
  const mainScore = teamLuck / option.mainRequirement;

  const teamSub = (
    calcSubFactor(option.subFactors, playerChar) +
    calcSubFactor(option.subFactors, general1) +
    calcSubFactor(option.subFactors, general2)
  ) / 3;
  const subScore = teamSub / option.subRequirement;

  const baseScore = (mainScore * 0.6 + subScore * 0.4) * 100;

  // 投掷骰子
  const diceIndex = Math.floor(Math.random() * 6);
  const dice = DICE_TABLE[diceIndex];
  const finalRate = baseScore * dice.multiplier;
  const fortune = getFortuneByRate(finalRate);

  return {
    fortuneName: fortune.name,
    multiplier: FORTUNE_MULTIPLIERS[fortune.name],
    dice: dice.dice,
    diceMultiplier: dice.multiplier,
    baseScore,
    finalRate,
  };
}

// ── 奖励字符串解析 ───────────────────────────────────────────

/**
 * 解析奖励字符串为结构化数组
 * 格式: "silver:500;food:300;san_1_item_taoyuan;random:troop:rare:1;san_1_troop_x001:2"
 * 
 * @param {string} rewardStr - 奖励字符串
 * @returns {Array<Object>} 解析后的奖励项
 */
function parseRewardString(rewardStr) {
  if (!rewardStr) return [];

  return rewardStr.split(';').map(item => {
    const t = item.trim();
    if (!t) return null;

    // 资源类型: silver:N, food:N, reputation:N, contribution:N, morale:N
    const resourceTypes = ['silver', 'food', 'reputation', 'contribution', 'morale'];
    for (const res of resourceTypes) {
      if (t.startsWith(`${res}:`)) {
        return { type: 'resource', resource: res, amount: parseInt(t.split(':')[1]) || 0 };
      }
    }

    // 随机卡牌: random:type:rarity[:qty]
    if (t.startsWith('random:')) {
      const parts = t.split(':');
      return {
        type: 'random_card',
        cardType: parts[1],   // troop/char/equipment
        rarity: parts[2],     // common/rare/epic/legendary
        quantity: parseInt(parts[3]) || 1,
      };
    }

    // 道具: item_xxx[:qty] 或 san_1_item_xxx[:qty]（须先于「具体卡牌」判断：如 item_nanyang_troop_legendary / item_shanhaiguan_troop_core 等 ID 含 _troop_）
    if (t.includes('_item_') || t.startsWith('item_')) {
      const parts = t.split(':');
      return {
        type: 'item',
        itemId: parts[0],
        quantity: parseInt(parts[1]) || 1,
      };
    }

    // 具体卡牌: san_1_troop_x001[:qty] / san_1_char_x001[:qty] / san_1_equip_1_1001[:qty] / san_0_title_1_5001[:qty] / san_1_achi_2_3001[:qty]
    if (t.includes('_troop_') || t.includes('_char_') || t.includes('_equip_') || t.includes('_title_') || t.includes('_achi_')) {
      const parts = t.split(':');
      return {
        type: 'specific_card',
        cardId: parts[0],
        quantity: parseInt(parts[1]) || 1,
      };
    }

    // 官职: san_1_position_junhou
    if (t.includes('_position_')) {
      return {
        type: 'position',
        positionId: t.trim(),
      };
    }

    // 未知类型
    return { type: 'unknown', raw: t };
  }).filter(Boolean);
}

// ── 势力通配符替换 ───────────────────────────────────────────

/**
 * 替换卡牌ID中的势力通配符 x
 * san_1_troop_x001 → san_1_troop_1001（刘备势力）
 * 
 * @param {string} cardId - 含通配符的卡牌ID
 * @param {string} factionId - 玩家势力ID（如 san_1_faction_1001）
 * @returns {string} 替换后的卡牌ID
 */
function replaceFactionWildcard(cardId, factionId) {
  if (!cardId || !cardId.includes('_x')) return cardId;

  // 从 factionId 提取势力编号（千位数字）
  // san_1_faction_1001 → 1
  const factionParts = factionId.split('_');
  const factionNumber = factionParts[3] ? factionParts[3].charAt(0) : '0';

  // 替换 _x 为 _势力编号
  return cardId.replace(/_x/, `_${factionNumber}`);
}


// ── 从稀有度获取 max_battle_count ────────────────────────────

function getMaxBattleCount(rarity) {
  const map = { common: 20, rare: 28, epic: 36, legendary: 44, core: 60 };
  return map[rarity] || 20;
}

// ── 将领卡唯一性：重复补偿银两 ──────────────────────────────
const CHARACTER_DUPLICATE_COMPENSATION = { common: 20, rare: 40, epic: 60, legendary: 80, core: 100 };

/**
 * 检查玩家是否已持有该将领卡，已持有则补偿银两
 * @returns {boolean} true=已持有（已补偿），false=未持有（可插入）
 */
async function checkCharacterDuplicate(connection, playerId, cardId, rarity, details) {
  const rar = normalizeEnumRarity(rarity) || 'common';
  const [cntRows] = await connection.query(
    "SELECT COUNT(*) AS cnt FROM player_cards WHERE player_id = ? AND card_id = ? AND card_type = 'character'",
    [playerId, cardId]
  );
  const cnt = Number(cntRows[0]?.cnt || 0);
  // 核心将领卡同 ID 可持有 2 张，其余稀有度仍 1 张
  const maxSame = rar === 'core' ? 2 : 1;
  if (cnt < maxSame) return false;
  const compensation = CHARACTER_DUPLICATE_COMPENSATION[rar] || 20;
  await connection.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [compensation, playerId]);
  details.push({ type: 'character_duplicate', cardId, rarity: rar, compensation });
  console.log(`[Rewards] 将领重复: ${cardId} → 补偿 ${compensation} 银两`);
  return true;
}

// ── 将领卡：按稀有度总张数上限（与 docs 21-CHARACTER_SYSTEM §2.2 一致）──
const CHARACTER_LIMIT_BY_RARITY = { legendary: 8, epic: 12, rare: 12, common: 8 };
const CHARACTER_OVER_LIMIT_COMPENSATION = { legendary: 80, epic: 60, rare: 40, common: 20 };

/**
 * 该稀有度将领卡实例数已达上限则补偿银两，不插入
 * @returns {boolean} true=已满（已补偿），false=可继续发放
 */
async function checkCharacterRarityLimit(connection, playerId, rarity, details, cardId = null, cardName = null) {
  const rar = normalizeEnumRarity(rarity) || 'common';
  const limit = CHARACTER_LIMIT_BY_RARITY[rar];
  if (limit == null) return false;

  const [countRows] = await connection.query(
    "SELECT COUNT(*) AS cnt FROM player_cards WHERE player_id = ? AND card_type = 'character' AND rarity = ?",
    [playerId, rar]
  );
  if (Number(countRows[0]?.cnt || 0) < limit) return false;

  const compensation = CHARACTER_OVER_LIMIT_COMPENSATION[rar] || 20;
  await connection.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [compensation, playerId]);
  details.push({
    type: 'character_rarity_limit',
    cardId,
    cardName,
    rarity: rar,
    compensation,
  });
  console.log(`[Rewards] 将领稀有度栏位已满: ${rar} (${countRows[0].cnt}/${limit}) → 补偿 ${compensation} 银两`);
  return true;
}

// ── 唯一卡牌检查（称号/成就每个ID只能持有一张）──────────────
const UNIQUE_CARD_COMPENSATION = { common: 20, rare: 40, epic: 60, legendary: 80, core: 100 }; // 银两

async function checkUniqueCardDuplicate(connection, playerId, cardType, cardId, rarity, details) {
  const rar = normalizeEnumRarity(rarity) || 'common';
  const [existing] = await connection.query(
    'SELECT instance_id FROM player_cards WHERE player_id = ? AND card_id = ? AND card_type = ?',
    [playerId, cardId, cardType]
  );
  if (existing.length === 0) return false;
  const compensation = UNIQUE_CARD_COMPENSATION[rar] || 20;
  await connection.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [compensation, playerId]);
  details.push({ type: 'card_duplicate', cardType, cardId, compensation });
  console.log(`[Rewards] ${cardType}重复: ${cardId} → 补偿 ${compensation} 银两`);
  return true;
}

// ── 部队卡持有上限检查 ──────────────────────────────────────
// core 的「每种配置 ID 最多 2 张」由 checkTroopLimit 首分支处理；此处 core 勿再用全局 2（否则会统计全账号所有 core 混同上限）
const TROOP_LIMIT_BY_RARITY = { common: 20, rare: 40, epic: 40, legendary: 20, core: 999 };
const TROOP_OVER_LIMIT_COMPENSATION = { common: 100, rare: 200, epic: 300, legendary: 400, core: 500 }; // 粮草

/**
 * 检查部队卡是否超过持有上限，超过则补偿粮草
 * - 核心(core)：按「同 card_id」最多 2 张（与金卡纪念规则一致）
 * - 其他稀有度：仍按「该稀有度部队卡总数」上限（见 TROOP_LIMIT_BY_RARITY）
 * @param {string|null} troopCardId - 待插入的部队配置 ID（core 时必传，用于同卡计数）
 * @returns {boolean} true=超限（已补偿），false=未超限（可插入）
 */
async function checkTroopLimit(connection, playerId, rarity, details, troopCardId = null) {
  const rar = normalizeEnumRarity(rarity);
  if (rar === 'core' && troopCardId) {
    const maxPerCard = 2;
    // 按配置 ID 计数，不依赖 player_cards.rarity 是否与 'core' 一致（避免 ENUM/历史数据导致漏计）
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM player_cards WHERE player_id = ? AND card_type = 'troop' AND card_id = ?",
      [playerId, troopCardId]
    );
    if (Number(countRows[0].cnt) < maxPerCard) return false;
    const compensation = TROOP_OVER_LIMIT_COMPENSATION.core;
    await connection.query('UPDATE players SET food = food + ? WHERE player_id = ?', [compensation, playerId]);
    let cardName = troopCardId;
    const [nr] = await connection.query(
      'SELECT troop_name FROM config_troops WHERE troop_id = ?',
      [troopCardId]
    );
    if (nr[0]?.troop_name) cardName = nr[0].troop_name;
    details.push({
      type: 'troop_over_limit',
      rarity: 'core',
      cardId: troopCardId,
      cardName,
      compensation,
      compensationType: 'food',
      scope: 'per_card'
    });
    console.log(`[Rewards] 核心部队同卡已满: ${troopCardId} → 补偿 ${compensation} 粮草`);
    return true;
  }

  const limit = TROOP_LIMIT_BY_RARITY[rar] || 20;
  const [countRows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM player_cards WHERE player_id = ? AND card_type = 'troop' AND rarity = ?",
    [playerId, rar]
  );
  if (countRows[0].cnt < limit) return false;
  const compensation = TROOP_OVER_LIMIT_COMPENSATION[rar] || 100;
  await connection.query('UPDATE players SET food = food + ? WHERE player_id = ?', [compensation, playerId]);
  details.push({ type: 'troop_over_limit', rarity: rar, compensation, compensationType: 'food', scope: 'global' });
  console.log(`[Rewards] 部队卡超限: ${rar} (${countRows[0].cnt}/${limit}) → 补偿 ${compensation} 粮草`);
  return true;
}

// ── 随机卡牌抽取 ─────────────────────────────────────────────

/**
 * 从config表随机抽取卡牌
 * 
 * @param {string} cardType - troop/char/equipment
 * @param {string} rarity - common/rare/epic/legendary
 * @param {string} factionId - 玩家势力ID
 * @param {number} quantity - 数量
 * @returns {Promise<Array<Object>>} 抽取到的卡牌配置
 */
async function randomDrawCards(cardType, rarity, factionId, quantity, excludeIds = []) {
  // 从 factionId 提取势力编号
  const factionParts = factionId.split('_');
  const factionNumber = factionParts[3] ? factionParts[3].charAt(0) : '0';
  const season = factionParts.slice(0, 2).join('_'); // san_1

  let table, idField, nameField, idPattern;

  if (cardType === 'troop') {
    table = 'config_troops';
    idField = 'troop_id';
    nameField = 'troop_name';
    // 匹配本势力 + 通用势力(0)
    idPattern = `${season}_troop_${factionNumber}%`;
  } else if (cardType === 'char') {
    table = 'config_characters';
    idField = 'character_id';
    nameField = 'character_name';
    idPattern = `${season}_char_${factionNumber}%`;
  } else if (cardType === 'equipment') {
    table = 'config_equipment';
    idField = 'equipment_id';
    nameField = 'equipment_name';
    // 装备不按势力区分，稀有度从ID解析（序号首位：1=common,2=rare,3=epic,4=legendary,5=core）
    idPattern = null;
  } else {
    return [];
  }

  // 稀有度→序号首位映射
  const rarityDigitMap = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' };

  // 构建查询
  let query, params;
  const excludeClause = excludeIds.length > 0
    ? ` AND ${idField} NOT IN (${excludeIds.map(() => '?').join(',')})`
    : '';
  const excludeParams = excludeIds.length > 0 ? excludeIds : [];

  if (idPattern) {
    query = `SELECT ${idField} as card_id, ${nameField} as card_name, rarity 
             FROM ${table} 
             WHERE rarity = ? AND (${idField} LIKE ? OR ${idField} LIKE ?)${excludeClause}
             ORDER BY RAND() LIMIT ?`;
    params = [rarity, idPattern, `${season}_${cardType === 'troop' ? 'troop' : 'char'}_0%`, ...excludeParams, quantity];
  } else {
    const rarityDigit = rarityDigitMap[rarity] || '1';
    query = `SELECT ${idField} as card_id, ${nameField} as card_name, ? as rarity 
             FROM ${table} 
             WHERE season = ? AND ${idField} REGEXP ?${excludeClause}
             ORDER BY RAND() LIMIT ?`;
    params = [rarity, season, `_${rarityDigit}[0-9]{3}$`, ...excludeParams, quantity];
  }

  const [rows] = await pool.query(query, params);
  
  // 如果可选种类少于需求数量，允许重复（同一种卡牌可以给多张）
  if (rows.length === 0) return [];
  if (rows.length >= quantity) return rows;
  // 不够的部分从已有结果中随机补充
  const result = [...rows];
  while (result.length < quantity) {
    result.push(rows[Math.floor(Math.random() * rows.length)]);
  }
  return result;
}

// ── 核心：执行奖励发放 ──────────────────────────────────────

/**
 * 执行奖励发放（所有类型一起处理）
 * 
 * @param {string} playerId - 玩家ID
 * @param {string} rewardStr - 奖励字符串
 * @param {number} multiplier - 运势倍率
 * @param {string} factionId - 玩家势力ID
 * @returns {Promise<Object>} 发放结果
 */
async function executeRewards(playerId, rewardStr, multiplier, factionId) {
  const rewards = parseRewardString(rewardStr);
  if (rewards.length === 0) return { success: true, details: [] };

  const details = [];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ── 1. 资源奖励 ──
    const resourceUpdates = {};
    const moraleAmount = { value: 0 };

    for (const r of rewards.filter(r => r.type === 'resource')) {
      const amount = Math.floor(r.amount * multiplier);
      if (r.resource === 'morale') {
        moraleAmount.value += amount;
        details.push({ type: 'morale', amount });
      } else {
        resourceUpdates[r.resource] = (resourceUpdates[r.resource] || 0) + amount;
        details.push({ type: 'resource', resource: r.resource, amount });
      }
    }

    // 更新 players 表资源
    if (Object.keys(resourceUpdates).length > 0) {
      const setClauses = [];
      const params = [];
      for (const [field, amount] of Object.entries(resourceUpdates)) {
        setClauses.push(`${field} = ${field} + ?`);
        params.push(amount);
      }
      params.push(playerId);
      await connection.query(
        `UPDATE players SET ${setClauses.join(', ')} WHERE player_id = ?`,
        params
      );

      await statisticsDeltaService.applyResourceDelta(playerId, resourceUpdates, connection);
    }

    // 更新士气（玩家角色 + 已装备部队卡 + 已装备将领卡）
    if (moraleAmount.value !== 0) {
      await connection.query(
        `UPDATE players SET morale = LEAST(120, GREATEST(0, morale + ?)) WHERE player_id = ?`,
        [moraleAmount.value, playerId]
      );
      // 同步更新已装备部队卡和将领卡的士气
      await connection.query(
        `UPDATE player_cards SET morale = LEAST(120, GREATEST(0, IFNULL(morale, 100) + ?))
         WHERE player_id = ? AND is_equipped = TRUE AND card_type IN ('troop', 'character')`,
        [moraleAmount.value, playerId]
      );
    }

    // ── 2. 道具奖励 → players.items JSON ──
    for (const r of rewards.filter(r => r.type === 'item')) {
      const qty = r.quantity;
      // 读取当前 items
      const [playerRows] = await connection.query(
        'SELECT items FROM players WHERE player_id = ?',
        [playerId]
      );
      let items = {};
      if (playerRows[0]?.items) {
        items = typeof playerRows[0].items === 'string'
          ? JSON.parse(playerRows[0].items)
          : playerRows[0].items;
      }
      items[r.itemId] = (items[r.itemId] || 0) + qty;
      await connection.query(
        'UPDATE players SET items = ? WHERE player_id = ?',
        [JSON.stringify(items), playerId]
      );
      // 查询道具名称
      const [itemConfig] = await connection.query(
        'SELECT item_name FROM config_items WHERE item_id = ?',
        [r.itemId]
      );
      const itemName = itemConfig[0]?.item_name || r.itemId;
      details.push({ type: 'item', itemId: r.itemId, itemName, quantity: qty });
    }

    // ── 2.5 官职奖励 → 更新 players 表的官职字段 ──
    for (const r of rewards.filter(r => r.type === 'position')) {
      const [posRows] = await connection.query(
        'SELECT position_id, position_name, position_level FROM config_positions WHERE position_id = ?',
        [r.positionId]
      );
      if (posRows[0]) {
        const pos = posRows[0];
        await connection.query(
          'UPDATE players SET current_position_id = ?, current_position_name = ?, position_level = ? WHERE player_id = ?',
          [pos.position_id, pos.position_name, pos.position_level, playerId]
        );
        details.push({ type: 'position', positionId: pos.position_id, positionName: pos.position_name, positionLevel: pos.position_level });
        console.log(`[Rewards] 授予官职: ${pos.position_name} (Lv.${pos.position_level}) → ${playerId}`);
      }
    }

    // ── 3. 具体卡牌 → player_cards（势力通配符替换）──
    for (const r of rewards.filter(r => r.type === 'specific_card')) {
      const realCardId = replaceFactionWildcard(r.cardId, factionId);
      const cardType = realCardId.includes('_troop_') ? 'troop'
        : realCardId.includes('_char_') ? 'character'
        : realCardId.includes('_title_') ? 'title'
        : realCardId.includes('_achi_') ? 'achievement'
        : 'equipment';

      // 查询配置表获取稀有度（部队用 resolveTroopRarity，避免 DB ENUM/缺行导致误判全局上限）
      let rarity = 'common';
      if (cardType === 'troop') {
        rarity = await resolveTroopRarity(connection, realCardId);
      } else if (cardType === 'character') {
        const [cfg] = await connection.query(
          'SELECT rarity FROM config_characters WHERE character_id = ?', [realCardId]
        );
        if (cfg[0]) rarity = normalizeEnumRarity(cfg[0].rarity) || 'common';
      } else if (cardType === 'title' || cardType === 'achievement' || cardType === 'equipment') {
        // 从ID解析稀有度：san_1_title_1_4001 → 第5段首位=稀有度编号
        const rarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
        const parts = realCardId.split('_');
        const seqStr = parts[parts.length - 1] || '';
        rarity = rarityMap[seqStr.charAt(0)] || 'common';
      }

      // 查询卡牌名称（用于前端显示）
      let cardName = realCardId;
      const nameTableMap = {
        troop: { table: 'config_troops', idField: 'troop_id', nameField: 'troop_name' },
        character: { table: 'config_characters', idField: 'character_id', nameField: 'character_name' },
        title: { table: 'config_titles', idField: 'title_id', nameField: 'title_name' },
        equipment: { table: 'config_equipment', idField: 'equipment_id', nameField: 'equipment_name' },
      };
      const nameMap = nameTableMap[cardType];
      if (nameMap) {
        const [nameRows] = await connection.query(
          `SELECT ${nameMap.nameField} as name FROM ${nameMap.table} WHERE ${nameMap.idField} = ?`, [realCardId]
        );
        if (nameRows[0]) cardName = nameRows[0].name;
      }

      for (let i = 0; i < r.quantity; i++) {
        // 将领卡唯一性检查：已持有则补偿银两
        if (cardType === 'character') {
          const isDuplicate = await checkCharacterDuplicate(connection, playerId, realCardId, rarity, details);
          if (isDuplicate) continue;
          const isRarityFull = await checkCharacterRarityLimit(connection, playerId, rarity, details, realCardId, cardName);
          if (isRarityFull) continue;
        }
        // 称号/成就唯一性检查：已持有则补偿银两
        if (cardType === 'title' || cardType === 'achievement') {
          const isDuplicate = await checkUniqueCardDuplicate(connection, playerId, cardType, realCardId, rarity, details);
          if (isDuplicate) continue;
        }
        // 部队卡持有上限检查：超限则补偿粮草
        if (cardType === 'troop') {
          const isOverLimit = await checkTroopLimit(connection, playerId, rarity, details, realCardId);
          if (isOverLimit) continue;
        }
        const instanceId = `${realCardId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const insertData = {
          instance_id: instanceId,
          player_id: playerId,
          card_type: cardType,
          card_id: realCardId,
          rarity,
        };
        if (cardType === 'troop') {
          // 查询 max_troops 作为 current_troops 初始值
          const [troopCfg] = await connection.query(
            'SELECT max_troops FROM config_troops WHERE troop_id = ?', [realCardId]
          );
          insertData.current_troops = troopCfg[0]?.max_troops || 100;
          insertData.max_battle_count = getMaxBattleCount(rarity);
        }
        if (cardType === 'character') {
          // 查询 trait_modifier 计算初始士气
          const [charCfg] = await connection.query(
            'SELECT trait_modifier FROM config_characters WHERE character_id = ?', [realCardId]
          );
          insertData.morale = 70 + (charCfg[0]?.trait_modifier ?? 0);
        }
        await connection.query('INSERT INTO player_cards SET ?', [insertData]);
        details.push({ type: 'card', cardType, cardId: realCardId, cardName, instanceId });
      }
    }

    // ── 4. 随机卡牌 → 从config表随机抽取后 INSERT player_cards ──
    const drawnCardIdsByType = {}; // 按类型跟踪已抽到的卡牌ID，避免同类型重复
    for (const r of rewards.filter(r => r.type === 'random_card')) {
      const typeKey = r.cardType + '_' + r.rarity;
      if (!drawnCardIdsByType[typeKey]) drawnCardIdsByType[typeKey] = [];
      const drawn = await randomDrawCards(r.cardType, r.rarity, factionId, r.quantity, drawnCardIdsByType[typeKey]);
      for (const card of drawn) {
        const cardType = r.cardType === 'troop' ? 'troop'
          : r.cardType === 'char' ? 'character'
          : 'equipment';
        const drawRarity = normalizeEnumRarity(card.rarity || r.rarity) || 'common';
        const troopRarityResolved = cardType === 'troop'
          ? await resolveTroopRarity(connection, card.card_id)
          : drawRarity;
        // 将领卡唯一性检查：已持有则补偿银两
        if (cardType === 'character') {
          const isDuplicate = await checkCharacterDuplicate(connection, playerId, card.card_id, drawRarity, details);
          if (isDuplicate) { drawnCardIdsByType[typeKey].push(card.card_id); continue; }
          const isRarityFull = await checkCharacterRarityLimit(
            connection, playerId, drawRarity, details, card.card_id, card.card_name
          );
          if (isRarityFull) { drawnCardIdsByType[typeKey].push(card.card_id); continue; }
        }
        // 部队卡持有上限检查：超限则补偿粮草
        if (cardType === 'troop') {
          const isOverLimit = await checkTroopLimit(connection, playerId, troopRarityResolved, details, card.card_id);
          if (isOverLimit) { drawnCardIdsByType[typeKey].push(card.card_id); continue; }
        }
        const instanceId = `${card.card_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const insertData = {
          instance_id: instanceId,
          player_id: playerId,
          card_type: cardType,
          card_id: card.card_id,
          rarity: cardType === 'troop' ? troopRarityResolved : drawRarity,
        };
        if (cardType === 'troop') {
          const [troopCfg] = await connection.query(
            'SELECT max_troops FROM config_troops WHERE troop_id = ?', [card.card_id]
          );
          insertData.current_troops = troopCfg[0]?.max_troops || 100;
          insertData.max_battle_count = getMaxBattleCount(troopRarityResolved);
        }
        if (cardType === 'character') {
          const [charCfg] = await connection.query(
            'SELECT trait_modifier FROM config_characters WHERE character_id = ?', [card.card_id]
          );
          insertData.morale = 70 + (charCfg[0]?.trait_modifier ?? 0);
        }
        await connection.query('INSERT INTO player_cards SET ?', [insertData]);
        drawnCardIdsByType[typeKey].push(card.card_id);
        details.push({ type: 'random_card', cardType, cardId: card.card_id, cardName: card.card_name, instanceId });
      }
    }

    // ── 5. 更新 statistics.total_events_completed ──
    await connection.query(
      'UPDATE statistics SET total_events_completed = total_events_completed + 1 WHERE player_id = ?',
      [playerId]
    );

    await connection.commit();
    return { success: true, details };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * 在已有事务 connection 上发放具体卡牌（与事件奖励 specific_card 分支一致，用于传书领取等）
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string[]} cardIds - 配置表卡牌 ID，每张发 1 张
 */
async function grantSpecificCardsOnConnection(connection, playerId, factionId, cardIds, details = []) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) return;

  for (const raw of cardIds) {
    const r = { type: 'specific_card', cardId: String(raw).trim(), quantity: 1 };
    if (!r.cardId) continue;

    const realCardId = replaceFactionWildcard(r.cardId, factionId);
    const cardType = realCardId.includes('_troop_') ? 'troop'
      : realCardId.includes('_char_') ? 'character'
      : realCardId.includes('_title_') ? 'title'
      : realCardId.includes('_achi_') ? 'achievement'
      : 'equipment';

    let rarity = 'common';
    if (cardType === 'troop') {
      rarity = await resolveTroopRarity(connection, realCardId);
    } else if (cardType === 'character') {
      const [cfg] = await connection.query(
        'SELECT rarity FROM config_characters WHERE character_id = ?', [realCardId]
      );
      if (cfg[0]) rarity = normalizeEnumRarity(cfg[0].rarity) || 'common';
    } else if (cardType === 'title' || cardType === 'achievement' || cardType === 'equipment') {
      const rarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
      const parts = realCardId.split('_');
      const seqStr = parts[parts.length - 1] || '';
      rarity = rarityMap[seqStr.charAt(0)] || 'common';
    }

    let cardName = realCardId;
    const nameTableMap = {
      troop: { table: 'config_troops', idField: 'troop_id', nameField: 'troop_name' },
      character: { table: 'config_characters', idField: 'character_id', nameField: 'character_name' },
      title: { table: 'config_titles', idField: 'title_id', nameField: 'title_name' },
      achievement: { table: 'config_achievements', idField: 'achievement_id', nameField: 'achievement_name' },
      equipment: { table: 'config_equipment', idField: 'equipment_id', nameField: 'equipment_name' },
    };
    const nameMap = nameTableMap[cardType];
    if (nameMap) {
      const [nameRows] = await connection.query(
        `SELECT ${nameMap.nameField} as name FROM ${nameMap.table} WHERE ${nameMap.idField} = ?`, [realCardId]
      );
      if (nameRows[0]) cardName = nameRows[0].name;
    }

    for (let i = 0; i < r.quantity; i++) {
      if (cardType === 'character') {
        const isDuplicate = await checkCharacterDuplicate(connection, playerId, realCardId, rarity, details);
        if (isDuplicate) continue;
        const isRarityFull = await checkCharacterRarityLimit(connection, playerId, rarity, details, realCardId, cardName);
        if (isRarityFull) continue;
      }
      if (cardType === 'title' || cardType === 'achievement') {
        const isDuplicate = await checkUniqueCardDuplicate(connection, playerId, cardType, realCardId, rarity, details);
        if (isDuplicate) continue;
      }
      if (cardType === 'troop') {
        const isOverLimit = await checkTroopLimit(connection, playerId, rarity, details, realCardId);
        if (isOverLimit) continue;
      }
      const instanceId = `${realCardId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const insertData = {
        instance_id: instanceId,
        player_id: playerId,
        card_type: cardType,
        card_id: realCardId,
        rarity,
      };
      if (cardType === 'troop') {
        const [troopCfg] = await connection.query(
          'SELECT max_troops FROM config_troops WHERE troop_id = ?', [realCardId]
        );
        insertData.current_troops = troopCfg[0]?.max_troops || 100;
        insertData.max_battle_count = getMaxBattleCount(rarity);
      }
      if (cardType === 'character') {
        const [charCfg] = await connection.query(
          'SELECT trait_modifier FROM config_characters WHERE character_id = ?', [realCardId]
        );
        insertData.morale = 70 + (charCfg[0]?.trait_modifier ?? 0);
      }
      await connection.query('INSERT INTO player_cards SET ?', [insertData]);
      details.push({ type: 'card', cardType, cardId: realCardId, cardName, instanceId });
    }
  }
}

module.exports = {
  calculateFortune,
  parseRewardString,
  replaceFactionWildcard,
  getMaxBattleCount,
  grantSpecificCardsOnConnection,
  executeRewards,
  FORTUNE_MULTIPLIERS,
};
