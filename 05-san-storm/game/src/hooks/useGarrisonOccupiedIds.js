/**
 * 拉取本玩家全部驻地配置中已占用的卡牌实例 ID 集合，供"上阵编组 / 驻地编组"等场景
 * 在选卡时排除已被驻守占用的实例，保持与后端 `garrisonService` 冲突检测一致。
 *
 * 历史：
 *   - `LineupTab.jsx` 自己内联拉 `garrisonAPI.getAll(playerId)` 后只扫 8 个字段
 *     （char1/2 的 card / troop1 / troop2 / title），漏 `equipment_card / achievement / treasure`，
 *     与 `GarrisonLineup` 通过 `collectGarrisonOccupiedInstanceIds` 扫的 14 字段不一致 →
 *     装备卡装到驻地后仍可能在上阵选卡列表里出现，前后端语义错位。
 *   - CR C5（2026-04-29）改走此 hook，统一到 `garrisonScopeUtils.GARRISON_OCCUPIED_INSTANCE_FIELDS`
 *     的 14 字段口径。
 *
 * 使用：
 *   const occupiedIds = useGarrisonOccupiedIds(player?.playerId, [cards]);
 *
 * 第二参数 `dependencies` 是触发重拉的依赖（通常传 `[cards]`，让"装备 / 卸下后 cards 变化"
 * 重新拉取，与原 `LineupTab` 行为一致）。失败时返回空 `Set`。
 *
 * @param {string | undefined} playerId
 * @param {any[]} [dependencies=[]]
 * @returns {Set<string>}
 */
import { useState, useEffect } from 'react';
import { garrisonAPI } from '@/services/garrisonApi';
import { collectGarrisonOccupiedInstanceIds } from '@/utils/garrisonScopeUtils';

export function useGarrisonOccupiedIds(playerId, dependencies = []) {
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());

  useEffect(() => {
    if (!playerId) {
      setOccupiedIds(new Set());
      return undefined;
    }
    let cancelled = false;
    garrisonAPI
      .getAll(playerId)
      .then((res) => {
        if (cancelled) return;
        if (res && res.success) {
          setOccupiedIds(collectGarrisonOccupiedInstanceIds(res.garrisons || []));
        }
      })
      .catch(() => {
        // 后端失败时保持上一次值；调用方表现为"暂时按旧 occupied 列表过滤"
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, ...dependencies]);

  return occupiedIds;
}

export default useGarrisonOccupiedIds;
