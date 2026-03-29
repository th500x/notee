import { getTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';

/**
 * 为战斗地图中 imperative 创建的 <img> 绑定多 URL 回退（与 TroopLayer / TroopCard 一致）
 */
export function bindTroopPortraitImg(imgEl, troop, baseUrl) {
  if (!imgEl) return;
  const urls =
    troop.imgPortraitAttempts?.length > 0
      ? troop.imgPortraitAttempts
      : getTroopPortraitUrlAttempts(troop, baseUrl);
  let i = 0;
  imgEl.onerror = () => {
    i += 1;
    if (i < urls.length) imgEl.src = urls[i];
    else imgEl.style.display = 'none';
  };
  imgEl.src = urls[0] || '';
  imgEl.alt = troop.name || '';
}
