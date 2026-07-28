/**
 * 小型战术格网（8×10）DOM 上绘制部队预览层。
 * 仅用于 SmallMapBattle 战前展示；战役大型图由引擎贴片直接渲染，不调用此函数。
 */
import { MAP_W } from '@/components/battle/battleConstants';
import { attachBattleUnitSprite, destroyBattleSpriteOnLayer } from '@/utils/battleUnitSpriteDom';
import { resolveTroopGlowClass } from '@/battle/troopFactionDisplay';
import { troopHpTopHtml } from '@/utils/troopHpBlocks';
import { troopRarityStarsHtml } from '@/utils/troopRarityStars';

export function renderTroopsToBattleMapDom(mapCardRef, battleTroops, baseUrl = '') {
  const card = mapCardRef?.current;
  if (!card) return;
  const tiles = card.querySelectorAll('.map-grid .tile');
  tiles.forEach((tile) => {
    tile.querySelectorAll('.troop-layer').forEach((el) => {
      destroyBattleSpriteOnLayer(el);
      el.remove();
    });
    tile.removeAttribute('data-troop');
  });
  for (const troop of battleTroops) {
    if (troop.currentTroops <= 0) continue;
    const tile = tiles[troop.y * MAP_W + troop.x];
    if (!tile) continue;
    tile.setAttribute('data-troop', troop.id);
    tile.removeAttribute('data-info');
    const fc = resolveTroopGlowClass(troop);
    const cr = troop.commanderRole;
    const isPlayerLordBar = troop.faction === 'player' && troop.lineupSlot === 'player';
    const nameBarClass = [
      'troop-name',
      cr === 'boss' ? 'is-commander-boss' : '',
      cr === 'hero' ? 'is-commander-hero' : '',
      isPlayerLordBar ? 'is-player-lord' : '',
    ].filter(Boolean).join(' ');
    const hpHtml = troopHpTopHtml(troop.currentTroops, troop.maxTroops, fc);
    const layer = document.createElement('div');
    layer.className = 'troop-layer';
    const starsHtml = troopRarityStarsHtml(troop.rarity);
    layer.innerHTML = `${hpHtml}<div class="troop-glow ${fc}"></div><img class="troop-img" alt=""><div class="${nameBarClass}"><span class="cn">${troop.displayName || troop.name}</span>${starsHtml}</div>`;
    const img = layer.querySelector('.troop-img');
    layer._spriteReady = attachBattleUnitSprite(img, troop, baseUrl).then((ctrl) => {
      if (ctrl) layer._battleSprite = ctrl;
      return ctrl;
    });
    tile.appendChild(layer);
  }
}
