/**
 * 大地图城池「城备」tooltip 最下方四行：披挂上阵 / 驻地守军 / NPC守军 / 防守系数。
 * 与 `WorldMapCityInfoBlock` 内联块同源，供战略格 tooltip 与 **地图 Tab 缩略图** 复用。
 * `withTopRule={false}`：缩略图浮层标题下已分区，不画上分隔线。
 */

/**
 * @param {{
 *   pvpAttackerBaseCampStrategic?: boolean,
 *   onDutyCount?: number|null,
 *   garrisonSlotCount?: number|null,
 *   garrisonCap?: number|null|string,
 *   npcAlive?: number|null,
 *   npcTotal?: number|string,
 *   cityDefenseCoefficient?: number|null,
 *   className?: string,
 *   withTopRule?: boolean,
 * }} props
 */
export default function WorldMapCityCombatSummaryBlock({
  pvpAttackerBaseCampStrategic = false,
  onDutyCount = null,
  garrisonSlotCount = null,
  garrisonCap = null,
  npcAlive = null,
  npcTotal = '?',
  cityDefenseCoefficient = null,
  className = '',
  withTopRule = true,
}) {
  const dutyNum = typeof onDutyCount === 'number' && Number.isFinite(onDutyCount) ? onDutyCount : null;
  const dutyShown = dutyNum === null ? '—' : String(dutyNum);
  const dutyGreen = dutyNum != null && dutyNum > 0;

  const slotNum =
    typeof garrisonSlotCount === 'number' && Number.isFinite(garrisonSlotCount)
      ? garrisonSlotCount
      : null;
  const slotShown = slotNum === null ? '—' : String(slotNum);

  const defenseShown =
    cityDefenseCoefficient != null && Number.isFinite(Number(cityDefenseCoefficient))
      ? String(cityDefenseCoefficient)
      : '—';

  const ruleCls = withTopRule ? 'border-t border-stone-600 pt-2' : 'pt-1';

  return (
    <div
      className={`text-stone-300 text-xs whitespace-normal ${ruleCls} ${className}`.trim()}
    >
      {pvpAttackerBaseCampStrategic ? (
        <>
          披挂上阵：<span className="text-stone-400">无</span>
          <span className="text-stone-500">（禁止配置）</span>
          <br />
          驻地守军：<span className="text-stone-400">无</span>
          <span className="text-stone-500">（禁止配置）</span>
          <br />
        </>
      ) : (
        <>
          披挂上阵：
          <span className={dutyGreen ? 'text-green-400' : 'text-stone-500'}>{dutyShown}</span>
          <br />
          驻地守军：
          <span className={slotNum === null ? 'text-stone-500' : 'text-cyan-400'}>{slotShown}</span>
          <span className="text-stone-500"> / </span>
          <span className="text-cyan-300/90">{garrisonCap != null ? garrisonCap : '?'}</span>
          <br />
        </>
      )}
      NPC守军：<span className="text-amber-400">{npcAlive ?? '?'}</span> / {npcTotal}
      <br />
      防守系数：<span className="text-stone-200">{defenseShown}</span>
    </div>
  );
}
