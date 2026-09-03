/** 事件 UI 用玩家/将领显示值（原 useEventSystem.js） */

export const DEFAULT_GENERAL = {
  name: '无将领',
  luck: 5.0,
  courage: 5.0,
  command: 5.0,
  combat: 5.0,
  intelligence: 5.0,
  politics: 5.0,
  charm: 5.0,
};

/** 将 PlayerContext 的 player（×10 存储）转为显示值 */
export function toDisplayAttrs(player) {
  if (!player) return null;
  return {
    name: player.characterName,
    luck: player.luck / 10,
    courage: player.courage / 10,
    command: player.command / 10,
    combat: player.combat / 10,
    intelligence: player.intelligence / 10,
    politics: player.politics / 10,
    charm: player.charm / 10,
  };
}

/** 从 cards 提取已装备将领配置属性（显示值） */
export function getEquippedGenerals(cards) {
  if (!cards || cards.length === 0) return [];
  const equipped = cards.filter((c) => c.cardType === 'character' && c.isEquipped);
  return equipped.map((c) => {
    const cfg = c.config;
    if (cfg) {
      return {
        name: cfg.name || '将领',
        luck: cfg.luck ?? 5.0,
        courage: cfg.courage ?? 5.0,
        command: cfg.command ?? 5.0,
        combat: cfg.combat ?? 5.0,
        intelligence: cfg.intelligence ?? 5.0,
        politics: cfg.politics ?? 5.0,
        charm: cfg.charm ?? 5.0,
      };
    }
    return {
      name: '未知将领',
      luck: 5.0,
      courage: 5.0,
      command: 5.0,
      combat: 5.0,
      intelligence: 5.0,
      politics: 5.0,
      charm: 5.0,
    };
  });
}
