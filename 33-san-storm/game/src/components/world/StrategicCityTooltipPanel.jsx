/**
 * 战略格「城池」tooltip：WorldMapCityInfoBlock；攻城消耗兵符（与匪寨同源）。
 */
import { useMemo, memo } from 'react';
import WorldMapCityInfoBlock from '@/components/world/WorldMapCityInfoBlock';
import { useSiegeQuota } from '@/hooks/useSiegeQuota';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';

function StrategicCityTooltipPanel({ content }) {
  const quotaCityId =
    content?.pvpAttackerBaseCampStrategic && content?.siegeQuotaCityId
      ? content.siegeQuotaCityId
      : content?.cityId ?? null;
  const playerId = content?.playerId ?? null;
  const skipSiegeQuota =
    content?.isBanditStronghold === true ||
    !!(content?.banditPoiId && isBanditMapObjectId(content.banditPoiId));
  const siegeQuotaHook = useSiegeQuota(
    skipSiegeQuota ? null : playerId,
    skipSiegeQuota ? null : quotaCityId || 'siege-token',
  );
  const siegeQuota =
    playerId && !skipSiegeQuota ? siegeQuotaHook : content?.siegeQuota ?? null;

  const {
    type: _t,
    interactive: _i,
    factionDisplayMap: _fd,
    siegeQuota: _sq,
    ...blockProps
  } = content;

  const subtitleTextEffective = useMemo(() => {
    const base = blockProps.subtitleText;
    if (base) return base;
    if (
      playerId &&
      siegeQuota?.loaded &&
      !siegeQuota.canSiege &&
      !blockProps.showOwnCityActions
    ) {
      return '兵符不足';
    }
    return null;
  }, [playerId, siegeQuota, blockProps.subtitleText, blockProps.showOwnCityActions]);

  return (
    <WorldMapCityInfoBlock
      {...blockProps}
      subtitleText={subtitleTextEffective}
      siegeQuota={siegeQuota}
    />
  );
}

export default memo(StrategicCityTooltipPanel);
