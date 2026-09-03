import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';

/**
 * 为战斗地图中 imperative 创建的 <img> 绑定多 URL 回退（与 TroopLayer 一致，san_1_battle player/enemy）
 */
export function bindTroopPortraitImg(imgEl, troop, baseUrl) {
  if (!imgEl) return;
  const urls =
    troop.imgPortraitAttempts?.length > 0
      ? troop.imgPortraitAttempts
      : getBattleFieldTroopPortraitUrlAttempts(troop, baseUrl);
  let i = 0;
  imgEl.onerror = () => {
    i += 1;
    if (i < urls.length) imgEl.src = urls[i];
    else imgEl.style.display = 'none';
  };
  imgEl.src = urls[0] || '';
  imgEl.alt = troop.name || '';
}
