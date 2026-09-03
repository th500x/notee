/**

 * 大地图城池「城备」tooltip：驻地守军 / NPC守军（含日恢复说明）。

 * 与 `WorldMapCityInfoBlock` 内联块同源，供战略格 tooltip 与 **地图 Tab 缩略图** 复用。

 * `withTopRule={false}`：缩略图浮层标题下已分区，不画上分隔线。

 * 防守系数已并入城备底部五维双列（见 `WorldMapCityInfoBlock`）。

 */



/**

 * @param {{

 *   pvpAttackerBaseCampStrategic?: boolean,

 *   garrisonSlotCount?: number|null,

 *   garrisonCap?: number|null|string,

 *   npcAlive?: number|null,

 *   npcTotal?: number|string,

 *   className?: string,

 *   withTopRule?: boolean,

 * }} props

 */

export default function WorldMapCityCombatSummaryBlock({

  pvpAttackerBaseCampStrategic = false,

  garrisonSlotCount = null,

  garrisonCap = null,

  npcAlive = null,

  npcTotal = '?',

  className = '',

  withTopRule = true,

}) {

  const slotNum =

    typeof garrisonSlotCount === 'number' && Number.isFinite(garrisonSlotCount)

      ? garrisonSlotCount

      : null;

  const slotShown = slotNum === null ? '—' : String(slotNum);



  const ruleCls = withTopRule ? 'border-t border-stone-600 pt-2' : 'pt-1';



  return (

    <div

      className={`text-stone-300 text-xs whitespace-normal ${ruleCls} ${className}`.trim()}

    >

      {pvpAttackerBaseCampStrategic ? (

        <>

          驻地守军：<span className="text-stone-400">无</span>

          <span className="text-stone-500">（禁止配置）</span>

          <br />

        </>

      ) : (

        <>

          驻地守军：

          <span className={slotNum === null ? 'text-stone-500' : 'text-cyan-400'}>{slotShown}</span>

          {garrisonCap != null ? (

            <>

              <span className="text-stone-500"> / </span>

              <span className="text-cyan-300/90">{garrisonCap}</span>

            </>

          ) : null}

          <br />

        </>

      )}

      NPC守军：<span className="text-amber-400">{npcAlive ?? '?'}</span> / {npcTotal}

      <br />

      <span className="text-stone-500 text-[10px]">

        每天 0:00：有损耗时恢复编制上限的 10%

      </span>

    </div>

  );

}


