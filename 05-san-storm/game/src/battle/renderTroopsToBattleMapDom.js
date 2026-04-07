/**
 * 小型战术格网（8×10）DOM 上绘制部队预览层。
 * 仅用于 SmallMapBattle 战前展示；战役大型图由引擎贴片直接渲染，不调用此函数。
 */
import { MAP_W, moraleInlineColorForTroopBar } from '@/components/battle/battleConstants';
import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';

export function renderTroopsToBattleMapDom(mapCardRef, battleTroops, baseUrl = '') {
  const card = mapCardRef?.current;
  if (!card) return;
  const tiles = card.querySelectorAll('.map-grid .tile');
  tiles.forEach((tile) => {
    tile.querySelectorAll('.troop-layer').forEach((el) => el.remove());
    tile.removeAttribute('data-troop');
  });
  for (const troop of battleTroops) {
    if (troop.currentTroops <= 0) continue;
    const tile = tiles[troop.y * MAP_W + troop.x];
    if (!tile) continue;
    tile.setAttribute('data-troop', troop.id);
    tile.removeAttribute('data-info');
    const fc = troop.faction === 'player' ? 'player' : 'enemy';
    const cr = troop.commanderRole;
    const isPlayerLordBar = troop.faction === 'player' && troop.lineupSlot === 'player';
    const nameBarClass = [
      'troop-name',
      cr === 'boss' ? 'is-commander-boss' : '',
      cr === 'hero' ? 'is-commander-hero' : '',
      isPlayerLordBar ? 'is-player-lord' : '',
    ].filter(Boolean).join(' ');
    const totalBlocks = Math.ceil(troop.maxTroops / 100);
    const fullBlocks = Math.floor(troop.currentTroops / 100);
    const remainder = troop.currentTroops % 100;
    const hasHalf = remainder >= 50;
    const allBlks = [];
    for (let b = 0; b < totalBlocks; b++) {
      if (b < fullBlocks) allBlks.push(`<div class="troop-hp-block full-${fc}"></div>`);
      else if (b === fullBlocks && hasHalf) allBlks.push(`<div class="troop-hp-block half-${fc}"></div>`);
    }
    const topBlks = allBlks.slice(0, 6).join('');
    const rightBlks = allBlks.slice(6).join('');
    const hpHtml = `<div class="troop-hp-top">${topBlks}</div>${rightBlks ? `<div class="troop-hp-right">${rightBlks}</div>` : ''}`;
    const layer = document.createElement('div');
    layer.className = 'troop-layer';
    const m = Number(troop.morale ?? 0);
    const goldMoraleBar = cr === 'boss' || cr === 'hero' || isPlayerLordBar;
    const moraleColor = moraleInlineColorForTroopBar(m);
    const mrHtml = goldMoraleBar
      ? `<span class="mr">${m}/100</span>`
      : `<span class="mr" style="color:${moraleColor}">${m}/100</span>`;
    layer.innerHTML = `${hpHtml}<div class="troop-glow ${troop.faction}"></div><img class="troop-img" alt=""><div class="${nameBarClass}"><span class="cn">${troop.displayName || troop.name}</span>${mrHtml}</div>`;
    const img = layer.querySelector('.troop-img');
    bindTroopPortraitImg(img, troop, baseUrl);
    tile.appendChild(layer);
  }
}
