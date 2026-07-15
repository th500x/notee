/**
 * 大地图立绘光效：装备成就槽 display_effect → CSS 修饰类
 * @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §5
 */

const KNOWN_DISPLAY_EFFECTS = new Set(['金色', '红色', '绿色', '黑色']);

const EFFECT_TO_TOKEN = {
  金色: 'gold',
  红色: 'red',
  绿色: 'green',
  黑色: 'black',
};

/**
 * 仅读取玩家编组槽（equippedBy=player）的成就光效。
 *
 * @param {object[]|null|undefined} cards
 * @returns {string|null}
 */
export function resolveMapDisplayEffect(cards) {
  const list = cards || [];
  const ach = list.find(
    (c) =>
      c?.cardType === 'achievement' &&
      c?.isEquipped &&
      c?.equippedSlot === 'achievement' &&
      c?.equippedBy === 'player',
  );
  const raw = ach?.config?.displayEffect;
  const effect = typeof raw === 'string' ? raw.trim() : '';
  if (!effect || !KNOWN_DISPLAY_EFFECTS.has(effect)) return null;
  return effect;
}

/**
 * @param {string|null|undefined} displayEffect
 * @returns {string}
 */
export function mapDisplayEffectToAvatarClass(displayEffect) {
  const token = EFFECT_TO_TOKEN[displayEffect];
  return token ? `ws-map-self-pawn__avatar--glow-${token}` : '';
}
