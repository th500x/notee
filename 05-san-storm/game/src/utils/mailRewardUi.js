/**
 * 传书附件预览、领取结算文案（与事件 RewardDisplay 的 details 语义对齐）
 */

const RESOURCE_LABEL = {
  silver: '💰 银两',
  food: '🌾 粮草',
  reputation: '🎖️ 声望',
  contribution: '🤝 贡献',
  morale: '💪 士气'
};

const CARD_TYPE_LABEL = {
  troop: '⚔️ 部队',
  character: '👤 将领',
  equipment: '🛡️ 装备',
  title: '🎖️ 称号',
  achievement: '🏅 成就'
};

/**
 * 根据共享 JSON 构建 id -> name 映射
 */
export function buildCardItemMaps({ troops, characters, equipment, items } = {}) {
  const troopById = {};
  (troops?.troops || []).forEach((t) => {
    if (t.id) troopById[t.id] = t.name || t.id;
  });
  const charById = {};
  (characters?.characters || []).forEach((c) => {
    if (c.id) charById[c.id] = c.name || c.id;
  });
  const equipById = {};
  (equipment?.equipment || []).forEach((e) => {
    if (e.id) equipById[e.id] = e.name || e.id;
  });
  const itemById = {};
  (items?.items || []).forEach((it) => {
    if (it.id) itemById[it.id] = it.name || it.id;
  });
  return { troopById, charById, equipById, itemById };
}

/**
 * 奖励传书「附件」可读描述（未领取前展示）
 */
export function describeMailAttachments(attachments, maps = {}) {
  const { troopById, charById, equipById, itemById } = maps;
  if (!attachments || typeof attachments !== 'object') return [];
  const lines = [];
  for (const key of ['silver', 'food', 'reputation', 'contribution', 'morale']) {
    if (attachments[key] != null && Number.isFinite(Number(attachments[key]))) {
      const n = Math.floor(Number(attachments[key]));
      if (n !== 0) {
        lines.push(`${RESOURCE_LABEL[key] || key}：${n > 0 ? '+' : ''}${n}`);
      }
    }
  }
  if (attachments.items && typeof attachments.items === 'object' && !Array.isArray(attachments.items)) {
    const itemEntries = Object.entries(attachments.items).sort(([a], [b]) => a.localeCompare(b));
    for (const [id, qty] of itemEntries) {
      const q = Math.floor(Number(qty)) || 0;
      if (!id || !q) continue;
      const name = itemById?.[id] || id;
      lines.push(`🔑 ${name} ×${q}`);
    }
  }
  if (attachments.positionId) {
    lines.push('👑 大司空任命（领取后授官并卸旧职）');
  }
  if (attachments.grantKingStipend === true) {
    lines.push('💰 君主封赏俸禄（按势力国力档与官职加成结算）');
  }
  if (attachments.grantDailyStipend === true) {
    lines.push('💰 今日俸禄（按国力档结算，领取后计入当日日领）');
  }
  if (Array.isArray(attachments.cards)) {
    for (const raw of attachments.cards) {
      const id = String(raw).trim();
      if (!id) continue;
      let name = id;
      let prefix = '📦 卡牌';
      if (id.includes('_troop_')) {
        name = troopById?.[id] || id;
        prefix = CARD_TYPE_LABEL.troop;
      } else if (id.includes('_char_')) {
        name = charById?.[id] || id;
        prefix = CARD_TYPE_LABEL.character;
      } else if (id.includes('_equip_')) {
        name = equipById?.[id] || id;
        prefix = CARD_TYPE_LABEL.equipment;
      }
      lines.push(`${prefix}「${name}」×1`);
    }
  }
  return lines;
}

/**
 * 后端 claim 返回的 details → 展示行（与 ExplorePanel buildRewardsFromDetails 一致）
 * @param {object} names - 可选：itemNameMap / itemById / charById / troopById / equipById（id→显示名）
 */
export function linesFromClaimDetails(details, names = {}) {
  const itemMap = names.itemNameMap || names.itemById || {};
  const charById = names.charById || {};
  const troopById = names.troopById || {};
  const equipById = names.equipById || {};

  if (!details || !details.length) return ['（无额外物品）'];
  const out = [];
  details.forEach((d) => {
    if (d.type === 'resource') {
      const label = RESOURCE_LABEL[d.resource] || d.resource;
      out.push(`${label} +${d.amount}`);
    } else if (d.type === 'morale') {
      out.push(`💪 士气 +${d.amount}`);
    } else if (d.type === 'card' || d.type === 'random_card') {
      if (d.cardId && String(d.cardId).startsWith('item_')) {
        const name = itemMap[d.cardId] || d.cardName || d.cardId;
        out.push(`🔑 ${name} ×${d.quantity || 1}`);
      } else {
        const lab = CARD_TYPE_LABEL[d.cardType] || '📦 卡牌';
        out.push(`${lab}「${d.cardName || d.cardId}」×${d.quantity || 1}`);
      }
    } else if (d.type === 'position') {
      out.push(`👑 官职「${d.positionName}」`);
    } else if (d.type === 'stipend_skip') {
      out.push(`💰 日俸未发放：${d.reason || '不可领取'}`);
    } else if (d.type === 'item') {
      out.push(`🔑 ${d.itemName || itemMap[d.itemId] || d.itemId} ×${d.quantity || 1}`);
    } else if (d.type === 'character_duplicate') {
      const nm = charById[d.cardId] || d.cardName || d.cardId;
      out.push(`💰 将领「${nm}」重复（已在背包），补偿 ${d.compensation} 银两`);
    } else if (d.type === 'character_rarity_limit') {
      const nm = charById[d.cardId] || d.cardName || d.cardId;
      const lim = d.rarityLimit ? ` ${d.rarityLimit.owned}/${d.rarityLimit.max}` : '';
      out.push(`💰 将领「${nm}」本稀有度栏位已满${lim}，补偿 ${d.compensation} 银两（同重复）`);
    } else if (d.type === 'card_duplicate') {
      const lab = d.cardType === 'title' ? '称号' : d.cardType === 'achievement' ? '成就' : d.cardType === 'troop' ? '部队' : d.cardType === 'character' ? '将领' : d.cardType === 'equipment' ? '装备' : '卡牌';
      let nm = d.cardName || d.cardId;
      if (d.cardType === 'troop') nm = troopById[d.cardId] || d.cardName || d.cardId;
      else if (d.cardType === 'character') nm = charById[d.cardId] || d.cardName || d.cardId;
      else if (d.cardType === 'equipment') nm = equipById[d.cardId] || d.cardName || d.cardId;
      if (d.discarded || d.cardType === 'title' || d.cardType === 'achievement') {
        out.push(`🎖️ ${lab}「${nm}」已拥有，重复奖励已丢弃`);
      } else {
        out.push(`💰 ${lab}「${nm}」已达持有上限，补偿 ${d.compensation} 银两`);
      }
    } else if (d.type === 'troop_over_limit') {
      if (d.scope === 'per_card' && d.cardName) {
        out.push(`🌾 「${d.cardName}」同卡已达上限（核心最多2张），补偿 ${d.compensation} 粮草`);
      } else {
        const lim = d.rarityLimit ? ` ${d.rarityLimit.owned}/${d.rarityLimit.max}` : '';
        out.push(`🌾 ${d.rarity || ''} 品部队栏位已满${lim}，补偿 ${d.compensation} 粮草`);
      }
    }
  });
  return out.length ? out : ['（无额外物品）'];
}
