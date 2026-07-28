/**
 * 随机箱效果（仅玩家开启；敌方不可开）
 * 五种效果等概率。
 */
import { loadSharedData } from '@/services/dataService';
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { resolveBattleUnitKey } from '@shared/utils/battleUnitKeyResolve.js';
import { initialMoraleFromCharacter } from '@/utils/npcMorale';

const EFFECTS = ['tactic_token', 'tactic_jade', 'spawn_enemy', 'heal_100', 'heaven_punish'];

const RARITY_FALLBACK = ['common', 'rare', 'epic', 'legendary'];

function pickEmptyAdjacent(y, x, mapResult, battleTroops) {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const h = mapResult.terrain?.length || 0;
  const w = mapResult.terrain?.[0]?.length || 0;
  for (const [dy, dx] of dirs) {
    const ny = y + dy;
    const nx = x + dx;
    if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
    const t = mapResult.terrain[ny][nx];
    if (t === 'river' || t === 'lake' || t === 'lava') continue;
    const obj = (mapResult.objects || []).find((o) => o.y === ny && o.x === nx && o.isPassable === false);
    if (obj) continue;
    if (battleTroops.some((u) => u.currentTroops > 0 && u.y === ny && u.x === nx)) continue;
    return { y: ny, x: nx };
  }
  return null;
}

function battleDifficultyRarity(mapResult, battleTroops) {
  const fromMeta = mapResult?.meta?.battleRarity;
  if (fromMeta && fromMeta !== 'core') return fromMeta;
  const enemyRarities = battleTroops.filter((t) => t.faction === 'enemy' && t.rarity).map((t) => t.rarity);
  const order = ['legendary', 'epic', 'rare', 'common'];
  return order.find((r) => enemyRarities.includes(r)) || 'common';
}

/**
 * @returns {Promise<object|null>}
 */
export async function resolveRandomBoxEffect(troop, mapResult, battleTroops, opts = {}) {
  if (!troop || troop.currentTroops <= 0 || !mapResult) return null;
  if (troop.faction !== 'player') return null;

  const obj = mapResult.objects.find(
    (o) => o.type === 'random' && !o.isOpen && o.y === troop.y && o.x === troop.x,
  );
  if (!obj) return null;

  obj.isOpen = true;
  const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
  const troopName = troop.character?.courtesyName || troop.name;
  const baseUrl = opts.baseUrl || (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/');

  if (effect === 'tactic_token') {
    return {
      kind: 'random',
      effect,
      troopName,
      label: '获得兵符 ×1',
      itemId: 'item_tactic_token',
      itemAmount: 1,
    };
  }
  if (effect === 'tactic_jade') {
    return {
      kind: 'random',
      effect,
      troopName,
      label: '获得玉牌 ×1',
      itemId: 'item_tactic_jade',
      itemAmount: 1,
    };
  }
  if (effect === 'heal_100') {
    const before = troop.currentTroops;
    const max = troop.maxTroops ?? troop.initialTroops ?? before;
    troop.currentTroops = Math.min(max, before + 100);
    return {
      kind: 'random',
      effect,
      troopName,
      label: `恢复兵力 +${troop.currentTroops - before}`,
      healAmount: troop.currentTroops - before,
    };
  }
  if (effect === 'heaven_punish') {
    const damages = [];
    for (const u of battleTroops) {
      if (!u || u.currentTroops <= 0) continue;
      const dmg = 1 + Math.floor(Math.random() * 50);
      const applied = Math.min(u.currentTroops, dmg);
      u.currentTroops = Math.max(0, u.currentTroops - applied);
      damages.push({ troopId: u.id, name: u.character?.courtesyName || u.name, damage: applied });
    }
    return {
      kind: 'random',
      effect,
      troopName,
      label: '天罚降世！全场部队受到 1～50 伤害',
      damages,
    };
  }

  // spawn_enemy
  const rarity = battleDifficultyRarity(mapResult, battleTroops);
  let troopsJson;
  let charsJson;
  try {
    troopsJson = await loadSharedData('troops');
    charsJson = await loadSharedData('characters');
  } catch (e) {
    console.error('[resolveRandomBoxEffect] load shared failed', e);
    return {
      kind: 'random',
      effect: 'spawn_enemy',
      troopName,
      label: '敌军增援失败（配置缺失）',
    };
  }
  const troopList = (troopsJson?.troops || troopsJson || []).filter(
    (t) => t && (t.rarity === rarity || (rarity === 'common' && !t.rarity)),
  );
  const pool = troopList.length
    ? troopList
    : (troopsJson?.troops || []).filter((t) => RARITY_FALLBACK.includes(t.rarity));
  if (!pool.length) {
    return { kind: 'random', effect: 'spawn_enemy', troopName, label: '敌军增援失败（无可用部队）' };
  }
  const tr = pool[Math.floor(Math.random() * pool.length)];
  const charPool = (charsJson?.characters || charsJson || []).filter((c) => c.rarity === rarity);
  const charSrc = charPool.length ? charPool : charsJson?.characters || [];
  const ch = charSrc.length ? charSrc[Math.floor(Math.random() * charSrc.length)] : null;
  const pos = pickEmptyAdjacent(troop.y, troop.x, mapResult, battleTroops) || {
    y: troop.y,
    x: Math.min((mapResult.terrain[0]?.length || 8) - 1, troop.x + 1),
  };
  const attempts = getBattleFieldTroopPortraitUrlAttempts({ ...tr, faction: 'enemy' }, baseUrl);
  const battleUnitKey = resolveBattleUnitKey(tr);
  const spawned = {
    ...tr,
    id: `${tr.id}_rand_${Date.now()}`,
    faction: 'enemy',
    y: pos.y,
    x: pos.x,
    currentTroops: tr.maxTroops,
    initialTroops: tr.maxTroops,
    displayName: ch ? ch.courtesyName || ch.name : tr.name,
    character: ch
      ? {
          name: ch.courtesyName || ch.name,
          courtesyName: ch.courtesyName || ch.name,
          luck: ch.luck,
          courage: ch.courage,
          combat: ch.combat,
          command: ch.command,
          intelligence: ch.intelligence,
          politics: ch.politics,
          charm: ch.charm,
          trait: ch.trait,
          traitModifier: ch.traitModifier ?? ch.trait_modifier ?? 0,
        }
      : null,
    morale: initialMoraleFromCharacter(ch),
    imgSrc: attempts[0],
    imgPortraitAttempts: attempts,
    imgFallback: attempts[attempts.length - 1],
    ...(battleUnitKey ? { battleUnitKey } : {}),
  };
  battleTroops.push(spawned);

  return {
    kind: 'random',
    effect: 'spawn_enemy',
    troopName,
    label: `敌军增援：${spawned.displayName || spawned.name}`,
    spawnedId: spawned.id,
  };
}

export const RANDOM_BOX_EFFECTS = EFFECTS;
