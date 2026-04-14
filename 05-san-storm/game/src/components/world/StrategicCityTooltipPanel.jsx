/**
 * 战略格「城池」tooltip：仅渲染 WorldMapCityInfoBlock（攻城配额等）。
 * 「势力战况」由 WorldStrategicMapGrid 内独立浮层 StrategicSiegeWarFloatingPanel 负责，不介入本组件 DOM。
 */
import { useMemo, memo } from 'react';
import WorldMapCityInfoBlock from '@/components/world/WorldMapCityInfoBlock';
import { useSiegeQuota } from '@/hooks/useSiegeQuota';

function StrategicCityTooltipPanel({ content }) {
  const cityId = content?.cityId ?? null;
  const playerId = content?.playerId ?? null;
  const siegeQuotaHook = useSiegeQuota(playerId, cityId);
  const siegeQuota = cityId && playerId ? siegeQuotaHook : content?.siegeQuota ?? null;

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
      return '攻城次数不足';
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
