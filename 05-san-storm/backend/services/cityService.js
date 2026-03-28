/**
 * 城市服务 - 城市管理、NPC守军生成、攻城归属判定
 * 
 * @module backend/services/cityService
 */

const { pool } = require('../database/connection');

// 城市类型 → NPC 最高稀有度
const CITY_MAX_RARITY = {
  city_small: 'rare',
  city_medium: 'epic',
  city_major: 'legendary',
  gate: 'legendary',
  fort: 'epic',
};

// 稀有度权重池（小城：rare 以下）
const RARITY_POOLS = {
  rare:      [{ rarity: 'common', weight: 60 }, { rarity: 'rare', weight: 40 }],
  epic:      [{ rarity: 'common', weight: 30 }, { rarity: 'rare', weight: 40 }, { rarity: 'epic', weight: 30 }],
  legendary: [{ rarity: 'rare', weight: 30 }, { rarity: 'epic', weight: 40 }, { rarity: 'legendary', weight: 30 }],
};

// NPC 部队数量 — 中立城市（无归属）
const NPC_TROOP_COUNT_NEUTRAL = {
  city_small: 400,
  city_medium: 600,
  city_major: 800,
  gate: 600,
  fort: 400,
};

// NPC 部队数量 — 已占领城市（有归属势力）
const NPC_TROOP_COUNT_OWNED = {
  city_small: 40,
  city_medium: 60,
  city_major: 80,
  gate: 60,
  fort: 40,
};

// 击杀 NPC 银两奖励（按稀有度）
const KILL_SILVER_REWARD = {
  core: 50,
  legendary: 40,
  epic: 30,
  rare: 20,
  common: 10,
};

// 胜利声望奖励（按击杀NPC最高稀有度）
const WIN_REPUTATION_REWARD = {
  core: 25,
  legendary: 20,
  epic: 15,
  rare: 10,
  common: 5,
};

// 胜利装备掉落概率
const EQUIPMENT_DROP_RATE = 0.05;

/**
 * 按权重随机选择稀有度
 */
function pickRarity(maxRarity) {
  const rarityPool = RARITY_POOLS[maxRarity] || RARITY_POOLS.rare;
  const totalWeight = rarityPool.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of rarityPool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return rarityPool[0].rarity;
}

/**
 * 为城市生成 NPC 守军
 * 复用事件系统逻辑：按城市对应稀有度从配置池中随机选取将领+部队
 * 
 * @param {string} cityId
 * @returns {Object} { npcGarrison, npcCount }
 */
async function generateNpcGarrison(cityId) {
  // 1. 获取城市信息
  const [cityRows] = await pool.query('SELECT * FROM cities WHERE id = ?', [cityId]);
  if (!cityRows.length) throw new Error(`城市不存在: ${cityId}`);
  const city = cityRows[0];

  const maxRarity = CITY_MAX_RARITY[city.city_type] || 'rare';
  const isOwned = !!city.faction_id;
  const troopCount = isOwned
    ? (NPC_TROOP_COUNT_OWNED[city.city_type] || 40)
    : (NPC_TROOP_COUNT_NEUTRAL[city.city_type] || 400);
  const charCount = Math.ceil(troopCount / 2); // 每2支部队配1个将领

  // 2. 从配置表加载部队和将领池
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [city.season]);
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [city.season]);

  // 3. 生成 NPC 部队
  const npcUnits = [];
  for (let i = 0; i < troopCount; i++) {
    const rarity = pickRarity(maxRarity);
    // 从对应稀有度的部队池中随机选取
    const troopPool = troops.filter(t => t.rarity === rarity);
    const troopSrc = troopPool.length > 0 ? troopPool : troops.filter(t => t.rarity === 'common');
    const troop = troopSrc[Math.floor(Math.random() * troopSrc.length)];

    // 将领：每2支部队共享1个将领
    let character = null;
    if (i % 2 === 0) {
      const charRarity = pickRarity(maxRarity);
      const charPool = chars.filter(c => c.rarity === charRarity);
      const charSrc = charPool.length > 0 ? charPool : chars.filter(c => c.rarity === 'common');
      character = charSrc[Math.floor(Math.random() * charSrc.length)];
    } else if (npcUnits.length > 0) {
      // 复用上一个将领
      character = npcUnits[npcUnits.length - 1].character;
    }

    npcUnits.push({
      index: i,
      troopId: troop.troop_id,
      troopName: troop.troop_name,
      rarity: troop.rarity,
      maxTroops: troop.max_troops,
      attack: troop.attack,
      defense: troop.defense,
      speed: troop.speed,
      movement: troop.movement,
      attackRange: troop.attack_range,
      troopType: troop.troop_type,
      weaponType: troop.weapon_type,
      character: character ? {
        characterId: character.character_id,
        name: character.character_name,
        courtesyName: character.courtesy_name || character.character_name,
        rarity: character.rarity,
        luck: character.luck,
        courage: character.courage,
        combat: character.combat,
        command: character.command,
        intelligence: character.intelligence,
        politics: character.politics,
        charm: character.charm,
        traitModifier: character.trait_modifier || 0,
      } : null,
      alive: true,
    });
  }

  // 4. 更新城市 NPC 守军
  await pool.query(
    `UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ?, npc_max_rarity = ?
     WHERE id = ?`,
    [JSON.stringify(npcUnits), troopCount, maxRarity, cityId]
  );

  return { npcGarrison: npcUnits, npcCount: troopCount };
}

/**
 * 获取城市信息（含 NPC 守军）
 */
async function getCityInfo(cityId) {
  const [rows] = await pool.query('SELECT * FROM cities WHERE id = ?', [cityId]);
  if (!rows.length) return null;
  const city = rows[0];
  let npcGarrison = null;
  if (city.npc_garrison) {
    npcGarrison = typeof city.npc_garrison === 'string' ? JSON.parse(city.npc_garrison) : city.npc_garrison;
  }
  return { ...city, npc_garrison: npcGarrison };
}

/**
 * 发起攻城战（创建 war 记录，返回 NPC 守军供前端战斗）
 */
async function initiateSiege(cityId, playerId) {
  const city = await getCityInfo(cityId);
  if (!city) throw new Error('城市不存在');

  // 获取玩家势力
  const [playerRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [playerId]);
  if (!playerRows.length) throw new Error('玩家不存在');
  const playerFaction = playerRows[0].faction_id;

  // 如果城市已被自己势力占领，不能攻打
  if (city.faction_id && city.faction_id === playerFaction) {
    throw new Error('不能攻打己方城市');
  }

  // ── 已占领城市：先查玩家防守者 ──
  if (city.status === 'owned' && city.faction_id) {
    const garrisonService = require('./garrisonService');
    const defenders = await garrisonService.getCityDefenders(cityId);

    for (const def of defenders) {
      if (def.player_id === playerId) continue; // 跳过攻城方自己

      const units = await garrisonService.buildDefenseUnits(def);
      // 总兵力 ≥ 800 才参战
      const totalTroops = units.reduce((sum, u) => sum + u.currentTroops, 0);
      if (totalTroops < 800) continue;

      const war = await getOrCreateWar(cityId, city);

      // 构建防守单位（BattleArena格式：属性×10）
      const garrisonUnits = units.map((u, i) => ({
        index: i,
        troopId: u.troop.id,
        troopName: u.troop.name,
        rarity: u.troop.rarity,
        troopType: u.troop.troopType,
        weaponType: u.troop.weaponType,
        attack: Math.round(u.troop.attack * 10),
        defense: Math.round(u.troop.defense * 10),
        speed: u.troop.speed,
        movement: u.troop.movement,
        attackRange: u.troop.range,
        maxTroops: u.troop.maxTroops,
        currentTroops: u.currentTroops,
        character: u.character ? {
          name: u.character.name,
          courtesyName: u.character.courtesyName || u.character.name,
          luck: Math.round(u.character.luck * 10),
          courage: Math.round(u.character.courage * 10),
          combat: Math.round(u.character.combat * 10),
          command: Math.round(u.character.command * 10),
          intelligence: Math.round(u.character.intelligence * 10),
          politics: 50, charm: 50,
          traitModifier: u.character.traitModifier || 0,
        } : null,
        alive: true,
        _isPlayerDefender: true,
        _garrisonPlayerId: u._garrisonPlayerId,
        _garrisonSlot: u._garrisonSlot,
        _troopInstanceId: u.troop.instanceId,
      }));

      // 检查防守者是否在线（最后活跃5分钟内）
      const [activeRows] = await pool.query(
        'SELECT lastActiveAt FROM accounts WHERE id = ?', [def.player_id]
      );
      const isOnline = activeRows.length > 0 &&
        (Date.now() - new Date(activeRows[0].lastActiveAt).getTime()) < 5 * 60 * 1000;

      if (isOnline) {
        // 防守者在线 → 返回 pvp_online，前端走 PVP 挑战流程
        return {
          warId: war.war_id, cityId, cityName: city.city_name, cityType: city.city_type,
          npcGarrison: garrisonUnits, npcAlive: garrisonUnits.length, npcTotal: garrisonUnits.length,
          playerFaction, defenderType: 'pvp_online',
          defenderName: def.character_name, defenderPlayerId: def.player_id,
          defenderGarrisonSlot: def.garrison_slot,
        };
      }

      // 防守者离线 → 异步PVE（驻守卡池作为NPC）
      return {
        warId: war.war_id, cityId, cityName: city.city_name, cityType: city.city_type,
        npcGarrison: garrisonUnits, npcAlive: garrisonUnits.length, npcTotal: garrisonUnits.length,
        playerFaction, defenderType: 'player_garrison',
        defenderName: def.character_name, defenderPlayerId: def.player_id,
      };
    }
    // 所有玩家防守者总兵力不足 → 继续到 NPC 守军
  }

  // ── NPC 守军逻辑（中立城市 或 玩家防守者全部跳过） ──
  // 如果有损耗且已过次日8:00，补满
  let needRefresh = false;
  if (!city.npc_garrison || city.npc_garrison_alive <= 0) {
    needRefresh = true;
  } else if (city.status === 'owned') {
    // 仅已占领城市：检查是否需要每日8点补满（NPC有损耗时）
    const totalNpc = city.npc_garrison.length;
    if (city.npc_garrison_alive < totalNpc) {
      const now = new Date();
      const updatedAt = new Date(city.updated_at);
      // 计算上次更新后的下一个8:00
      const next8am = new Date(updatedAt);
      next8am.setHours(8, 0, 0, 0);
      if (next8am <= updatedAt) next8am.setDate(next8am.getDate() + 1);
      if (now >= next8am) needRefresh = true;
    }
  }
  if (needRefresh) {
    await generateNpcGarrison(cityId);
    const refreshed = await getCityInfo(cityId);
    city.npc_garrison = refreshed.npc_garrison;
    city.npc_garrison_alive = refreshed.npc_garrison_alive;
  }

  // 查找或创建活跃的 war 记录
  const [existingWar] = await pool.query(
    "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active'",
    [cityId]
  );

  let war;
  if (existingWar.length > 0) {
    war = existingWar[0];
  } else {
    const warId = `war_${cityId}_${Date.now()}`;
    await pool.query(
      `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
        faction_kills, status, npc_total, npc_killed)
       VALUES (?, ?, 'siege', ?, ?, '{}', 'active', ?, 0)`,
      [warId, `${city.city_name}攻城战`, cityId, city.city_name, city.npc_garrison_alive]
    );
    war = { war_id: warId, faction_kills: {} };
  }

  // 筛选存活的 NPC 守军，每次战斗出4支，按稀有度平均分配
  const aliveNpc = (city.npc_garrison || []).filter(u => u.alive);
  // 按稀有度分组
  const byRarity = {};
  for (const npc of aliveNpc) {
    if (!byRarity[npc.rarity]) byRarity[npc.rarity] = [];
    byRarity[npc.rarity].push(npc);
  }
  // 轮流从各稀有度中取，确保平均分配
  const rarityKeys = Object.keys(byRarity).sort(); // common, rare 等
  const battleNpc = [];
  let ri = 0;
  while (battleNpc.length < 4 && aliveNpc.length > 0) {
    const key = rarityKeys[ri % rarityKeys.length];
    if (byRarity[key] && byRarity[key].length > 0) {
      battleNpc.push(byRarity[key].shift());
    }
    ri++;
    // 安全退出：如果所有池子都空了
    if (rarityKeys.every(k => !byRarity[k] || byRarity[k].length === 0)) break;
  }

  return {
    warId: war.war_id,
    cityId,
    cityName: city.city_name,
    cityType: city.city_type,
    npcGarrison: battleNpc,
    npcAlive: aliveNpc.length,
    npcTotal: city.npc_garrison?.length || 0,
    playerFaction,
  };
}

/**
 * 记录攻城战斗结果（玩家打完一场后调用）
 * 
 * @param {string} warId - 战事ID
 * @param {string} playerId - 玩家ID
 * @param {string} factionId - 玩家势力ID
 * @param {Array<number>} killedIndices - 本场战斗消灭的 NPC 索引列表
 * @param {string} result - 战斗结果 win/lose
 * @param {number} silverSpent - 战斗中消耗的银两（自动战斗费用）
 * @param {object} defenderInfo - 防守者信息
 */
async function recordSiegeResult(warId, playerId, factionId, killedIndices, result, silverSpent = 0, defenderInfo = {}) {
  const { defenderType, defenderPlayerId, garrisonUnits } = defenderInfo || {};

  // ── 玩家防守者：更新驻守部队兵力 ──
  if (defenderType === 'player_garrison' && garrisonUnits && Array.isArray(garrisonUnits)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [warRows] = await conn.query("SELECT * FROM wars WHERE war_id = ? AND status = 'active' FOR UPDATE", [warId]);
      if (!warRows.length) throw new Error('战事不存在或已结束');
      const war = warRows[0];
      let factionKills = war.faction_kills ? (typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills) : {};
      let killCount = 0;
      let silverReward = 0;
      for (const idx of killedIndices) {
        const unit = garrisonUnits[idx];
        if (!unit || !unit._troopInstanceId) continue;
        await conn.query('UPDATE player_cards SET current_troops = 0, last_troops_lost_at = NOW() WHERE instance_id = ?', [unit._troopInstanceId]);
        killCount++;
        silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
      }
      factionKills[factionId] = (factionKills[factionId] || 0) + killCount;
      const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
      if (netSilver !== 0) {
        await conn.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [netSilver, playerId]);
      }
      let reputationReward = 0;
      if (result === 'win' && killCount > 0) {
        const killedRarities = killedIndices.map(i => garrisonUnits[i]?.rarity).filter(Boolean);
        const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'core'];
        const bestRarity = killedRarities.sort((a, b) => rarityOrder.indexOf(b) - rarityOrder.indexOf(a))[0] || 'common';
        reputationReward = WIN_REPUTATION_REWARD[bestRarity] || 5;
        await conn.query('UPDATE players SET reputation = reputation + ? WHERE player_id = ?', [reputationReward, playerId]);
      }
      await conn.query('UPDATE wars SET faction_kills = ?, npc_killed = npc_killed + ? WHERE war_id = ?', [JSON.stringify(factionKills), killCount, warId]);
      await conn.commit();
      return { warId, factionKills, npcKilled: killCount, npcTotal: garrisonUnits.length, siegeCompleted: false, winnerFaction: null, silverReward, reputationReward, equipmentDrop: null, defenderType: 'player_garrison' };
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
  }

  // ── NPC 守军：原有逻辑 ──
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 获取 war 记录
    const [warRows] = await connection.query(
      "SELECT * FROM wars WHERE war_id = ? AND status = 'active' FOR UPDATE",
      [warId]
    );
    if (!warRows.length) throw new Error('战事不存在或已结束');
    const war = warRows[0];

    // 2. 更新势力击杀统计
    let factionKills = {};
    if (war.faction_kills) {
      factionKills = typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills;
    }
    // 3. 更新城市 NPC 守军状态 + 计算银两奖励 + 统计实际击杀数
    let silverReward = 0;
    let actualKillCount = 0;
    const [cityRows] = await connection.query(
      'SELECT npc_garrison, npc_garrison_alive FROM cities WHERE id = ? FOR UPDATE',
      [war.target_city_id]
    );
    if (cityRows.length) {
      let garrison = cityRows[0].npc_garrison;
      if (typeof garrison === 'string') garrison = JSON.parse(garrison);
      if (garrison) {
        for (const idx of killedIndices) {
          if (garrison[idx] && garrison[idx].alive) {
            garrison[idx].alive = false;
            silverReward += KILL_SILVER_REWARD[garrison[idx].rarity] || 10;
            actualKillCount++;
          }
        }
        const aliveCount = garrison.filter(u => u.alive).length;
        await connection.query(
          'UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE id = ?',
          [JSON.stringify(garrison), aliveCount, war.target_city_id]
        );
      }
    }

    // 势力击杀只计算实际从alive变dead的数量（防止重复上报）
    factionKills[factionId] = (factionKills[factionId] || 0) + actualKillCount;

    // 4. 发放银两奖励（扣除战斗消耗后的净值）
    const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
    if (netSilver !== 0) {
      await connection.query(
        'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
        [netSilver, playerId]
      );
    }

    // 4.5 胜利额外奖励：声望 + 装备掉落
    let reputationReward = 0;
    let equipmentDrop = null;
    if (result === 'win' && actualKillCount > 0) {
      // 声望：按本场击杀NPC的最高稀有度计算
      const [cityCheck] = await connection.query('SELECT npc_garrison FROM cities WHERE id = ?', [war.target_city_id]);
      let killedRarities = [];
      if (cityCheck.length) {
        let g = cityCheck[0].npc_garrison;
        if (typeof g === 'string') g = JSON.parse(g);
        if (g) killedRarities = killedIndices.map(i => g[i]?.rarity).filter(Boolean);
      }
      const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'core'];
      const bestRarity = killedRarities.sort((a, b) => rarityOrder.indexOf(b) - rarityOrder.indexOf(a))[0] || 'common';
      reputationReward = WIN_REPUTATION_REWARD[bestRarity] || 5;

      await connection.query(
        'UPDATE players SET reputation = reputation + ? WHERE player_id = ?',
        [reputationReward, playerId]
      );

      // 装备掉落：5%概率，稀有度=本场最高NPC稀有度
      if (Math.random() < EQUIPMENT_DROP_RATE) {
        // 从装备配置表随机选一件对应稀有度的装备（稀有度从equipment_id解析：_X_ 中X=1普通,2稀有,3史诗,4传奇,5核心）
        const rarityDigit = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' }[bestRarity] || '2';
        const [equipRows] = await connection.query(
          `SELECT * FROM config_equipment WHERE equipment_id LIKE ? ORDER BY RAND() LIMIT 1`,
          [`%_${rarityDigit}___`]
        );
        if (equipRows.length) {
          const eq = equipRows[0];
          const instanceId = `equip_${playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          // 从equipment_id解析稀有度
          const eqRarity = { '1':'common','2':'rare','3':'epic','4':'legendary','5':'core' }[eq.equipment_id.match(/_(\d)\d{3}$/)?.[1]] || bestRarity;
          await connection.query(
            `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity)
             VALUES (?, ?, 'equipment', ?, ?)`,
            [instanceId, playerId, eq.equipment_id, eqRarity]
          );
          equipmentDrop = { instanceId, equipmentId: eq.equipment_id, name: eq.equipment_name, rarity: eqRarity };
        }
      }
    }

    // 4. 更新 war 击杀数
    const newNpcKilled = (war.npc_killed || 0) + actualKillCount;
    await connection.query(
      'UPDATE wars SET faction_kills = ?, npc_killed = ? WHERE war_id = ?',
      [JSON.stringify(factionKills), newNpcKilled, warId]
    );

    // 5. 检查是否攻破（所有 NPC 被消灭）
    let siegeCompleted = false;
    let winnerFaction = null;
    if (newNpcKilled >= war.npc_total) {
      // 找出击杀最多的势力
      let maxKills = 0;
      for (const [fid, kills] of Object.entries(factionKills)) {
        if (kills > maxKills) { maxKills = kills; winnerFaction = fid; }
      }

      // 更新 war 为完成
      await connection.query(
        "UPDATE wars SET status = 'completed', winner_faction_id = ?, end_time = NOW() WHERE war_id = ?",
        [winnerFaction, warId]
      );

      // 更新城市归属
      await connection.query(
        "UPDATE cities SET faction_id = ?, status = 'owned', npc_garrison = NULL, npc_garrison_alive = 0 WHERE id = ?",
        [winnerFaction, war.target_city_id]
      );

      siegeCompleted = true;
    }

    await connection.commit();

    // 攻破后立即刷新 NPC 守军（在事务外执行，城市已归属新势力）
    if (siegeCompleted) {
      try {
        await generateNpcGarrison(war.target_city_id);
      } catch (e) {
        console.error('[CityService] 攻破后刷新NPC失败:', e);
      }
    }

    return {
      warId,
      factionKills,
      npcKilled: newNpcKilled,
      npcTotal: war.npc_total,
      siegeCompleted,
      winnerFaction,
      silverReward,
      reputationReward,
      equipmentDrop,
      defenderType: 'npc',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * 查找或创建活跃的 war 记录
 */
async function getOrCreateWar(cityId, city) {
  const [existingWar] = await pool.query(
    "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active'",
    [cityId]
  );
  if (existingWar.length > 0) return existingWar[0];
  const warId = `war_${cityId}_${Date.now()}`;
  await pool.query(
    `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
      faction_kills, status, npc_total, npc_killed)
     VALUES (?, ?, 'siege', ?, ?, '{}', 'active', ?, 0)`,
    [warId, `${city.city_name}攻城战`, cityId, city.city_name, city.npc_garrison_alive || 0]
  );
  return { war_id: warId, faction_kills: {} };
}

/**
 * 获取战事状态
 */
async function getWarStatus(warId) {
  const [rows] = await pool.query('SELECT * FROM wars WHERE war_id = ?', [warId]);
  if (!rows.length) return null;
  const war = rows[0];
  let factionKills = {};
  if (war.faction_kills) {
    factionKills = typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills;
  }
  return { ...war, faction_kills: factionKills };
}

module.exports = {
  generateNpcGarrison,
  getCityInfo,
  initiateSiege,
  recordSiegeResult,
  getWarStatus,
  CITY_MAX_RARITY,
  NPC_TROOP_COUNT_NEUTRAL,
  NPC_TROOP_COUNT_OWNED,
};
