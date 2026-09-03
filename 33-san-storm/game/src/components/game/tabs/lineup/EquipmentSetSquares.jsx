/**
 * 装备卡 4-piece 占位渲染
 *
 * 上阵编组的「选卡抽屉」与「卡牌详情浮层」都需要把一张装备卡（equipmentSet）画成
 * 256×384 的方框，其中四个角各一个 96×96 的占位（武器/守具/速饰/介饰），里面填充
 * 已绑定的装备件名 / 稀有度，或显示「空」。
 *
 * 历史：原本在 `LineupTab.jsx` 内 CardDrawer 与 CardDetailOverlay 各写一份完全相同的
 * 渲染（~80 行），CR C5（2026-04-29）抽到此组件，两个调用点共用。
 *
 * 非目标：驻地编组（`GarrisonLineup`）的装备卡选卡是简化版（仅卡名 + 「装备卡」标签），
 * 与本组件**不同**，按「相异不混用」原则不在此处合并。
 */

import { RARITY_LABEL, RARITY_COLOR_DETAIL, RARITY_TEXT_CLASS } from './lineupSlots';

const PIECE_LAYOUT = [
  { key: 'weaponInstanceId',    tag: '攻', icon: '⚔️', pos: 'left-1/2 top-[14px] -translate-x-1/2' },
  { key: 'accessory1InstanceId', tag: '速', icon: '✨', pos: 'left-[8px] top-1/2 -translate-y-1/2' },
  { key: 'accessory2InstanceId', tag: '介', icon: '✨', pos: 'right-[8px] top-1/2 -translate-y-1/2' },
  { key: 'armorInstanceId',     tag: '守', icon: '🛡️', pos: 'left-1/2 bottom-[14px] -translate-x-1/2' },
];

/**
 * @param {{ card: any, resolveEquipPiece: (instanceId: string|null) => any }} props
 *   - `card`：装备卡实例（含 config.weaponInstanceId 等）
 *   - `resolveEquipPiece(id)`：把绑定的装备件 instance_id 还原为完整卡牌实例（由调用方
 *     从 allCards 里查出来），返回 null 表示槽位空。
 */
export default function EquipmentSetSquares({ card, resolveEquipPiece }) {
  const cfg = card?.config || {};
  const cardRarity = cfg.rarity || card?.rarity || 'common';
  const sideLabelClass = RARITY_TEXT_CLASS[cardRarity] || 'text-white';
  const displayName = cfg.displayName || '装备卡';

  return (
    <div
      className="relative rounded-xl border-[3px] border-stone-500/70
        bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ width: 256, height: 384 }}
    >
      <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />
      <div
        className={`absolute left-[8px] top-[12px] text-[14px] leading-tight tracking-[1px] font-bold ${sideLabelClass}`}
        style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
      >
        {displayName}
      </div>
      {PIECE_LAYOUT.map((s) => {
        const piece = resolveEquipPiece ? resolveEquipPiece(cfg[s.key]) : null;
        const pCfg = piece?.config || {};
        const pName = pCfg.equipmentName || '空';
        const pRarity = pCfg.rarity || piece?.rarity || 'common';
        return (
          <div key={s.key} className={`absolute ${s.pos}`}>
            <div
              className={`rounded-lg border-2 ${
                piece ? 'border-stone-500 bg-stone-700/90' : 'border-dashed border-stone-600 bg-stone-800'
              } w-[96px] h-[96px] flex flex-col items-center justify-center`}
            >
              {piece ? (
                <div className="w-full h-full p-1 flex flex-col items-center justify-between text-center">
                  <span className="text-[12px] text-stone-100 truncate w-full leading-tight">{pName}</span>
                  <span className="text-xl opacity-45 leading-none">{s.icon}</span>
                  <span className={`text-[12px] font-bold leading-tight ${RARITY_COLOR_DETAIL[pRarity] || 'text-gray-300'}`}>
                    {RARITY_LABEL[pRarity] || '普通'}
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-[10px] text-amber-500/90 font-bold leading-none">{s.tag}</span>
                  <span className="text-2xl opacity-40 leading-none mt-1">{s.icon}</span>
                  <span className="text-[10px] text-stone-500 mt-0.5">空</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
