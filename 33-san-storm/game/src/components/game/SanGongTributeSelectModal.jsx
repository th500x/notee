/**
 * 三公府 · 互动 · 朝贡 — 选卡弹窗（部队 / 将领）
 */

import { useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import { toCharCardData, toTroopCardData } from '@/utils/cardDataTransforms';
import { RARITY_LABEL } from '@/utils/garrisonBarracksTroopPool';
import { MAX_LINEUP_BARRACKS_TROOP_CARDS } from '@/constants/barracksLimits';

/** 与 `LineupCardDrawer` / 朝贡部队缩略口径一致：256×384 卡面 ×0.5 → 128×192 */
const THUMB_W = 128;
const THUMB_H = 192;
const CARD_SCALE = 0.5;

function TributeTroopThumb({ card, skillsMap, baseUrl, isSel, onToggleSelect, onPreviewCard }) {
  const id = card.instanceId;
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSelect(id);
        }
      }}
      style={{ width: THUMB_W, height: THUMB_H }}
      className={`shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors hover:brightness-110 active:scale-95 ${
        isSel
          ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
          : 'border-stone-700/60 hover:border-amber-700/50'
      }`}
      onClick={() => onToggleSelect(id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onPreviewCard(card);
      }}
    >
      <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left', width: 256 }}>
        <TroopCard
          troop={toTroopCardData(card)}
          skillsMap={skillsMap}
          showDetails
          baseUrl={baseUrl}
          disableHoverScale
        />
      </div>
    </div>
  );
}

function TributeCharacterThumb({ card, skillsMap, baseUrl, isSel, onToggleSelect, onPreviewCard }) {
  const id = card.instanceId;
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSelect(id);
        }
      }}
      style={{ width: THUMB_W, height: THUMB_H }}
      className={`shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors hover:brightness-110 active:scale-95 ${
        isSel
          ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
          : 'border-stone-700/60 hover:border-amber-700/50'
      }`}
      onClick={() => onToggleSelect(id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onPreviewCard(card);
      }}
    >
      <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left', width: 256 }}>
        <CharacterCard
          character={toCharCardData(card, {}, skillsMap)}
          skillsMap={skillsMap}
          showDetails
          baseUrl={baseUrl}
          disableHoverScale
        />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   tributeKind: 'troop'|'character',
 *   poolCards: object[],
 *   poolByRarity: { rarity: string, cards: object[] }[],
 *   skillsMap: Record<string, object>,
 *   selected: Set<string>,
 *   onToggleSelect: (instanceId: string) => void,
 *   selectionCap: number,
 *   busy?: boolean,
 *   onConfirm: () => void,
 *   onPreviewCard: (card: object) => void,
 * }} props
 */
export default function SanGongTributeSelectModal({
  open,
  onClose,
  tributeKind = 'troop',
  poolCards,
  poolByRarity,
  skillsMap,
  selected,
  onToggleSelect,
  selectionCap,
  busy = false,
  onConfirm,
  onPreviewCard,
}) {
  const isLandscape = useGameTabLandscape();
  const baseUrl = import.meta.env.BASE_URL;
  const isCharacter = tributeKind === 'character';

  if (!open) return null;

  const panelClass = isLandscape
    ? 'fixed left-1/2 top-1/2 z-[139] flex max-h-[min(86vh,28rem)] w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-amber-700/55 bg-stone-900 shadow-2xl ring-1 ring-stone-950/80'
    : 'fixed inset-x-0 bottom-0 top-[22%] z-[139] flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-amber-700/55 bg-stone-900 shadow-2xl ring-1 ring-stone-950/80';

  const title = isCharacter ? '选择将领朝贡' : '选择部队朝贡';
  const emptyHint = isCharacter ? '军营池内暂无可朝贡的将领卡' : '军营池内暂无可朝贡的部队卡';
  const poolMeta = isCharacter
    ? `军营将领池 · 当前 ${poolCards.length} 张`
    : `军营部队池 · 当前 ${poolCards.length}/${MAX_LINEUP_BARRACKS_TROOP_CARDS} 张`;

  return (
    <>
      <div
        className="fixed inset-0 z-[138] bg-black/70"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <div className={panelClass} role="dialog" aria-modal="true" aria-labelledby="tribute-select-title">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-stone-700/70 px-4 py-3">
          <div className="min-w-0 text-left">
            <h2 id="tribute-select-title" className="text-sm font-bold text-amber-200">
              {title}
            </h2>
            <p className="mt-1 text-[10px] leading-snug text-stone-500">{poolMeta}</p>
            <p className="mt-0.5 text-[10px] text-stone-400">
              本日还可选 {Math.max(0, selectionCap)} 张 · 已选 {selected.size} 张 · 双击卡面可预览
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-0.5 text-lg leading-none text-stone-400 hover:text-stone-100"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 touch-pan-y [-webkit-overflow-scrolling:touch]">
          {poolCards.length === 0 ? (
            <p className="py-8 text-center text-xs text-stone-500">{emptyHint}</p>
          ) : (
            <div className="space-y-3">
              {poolByRarity.map(({ rarity, cards: rCards }) => (
                <div key={`tr-${rarity}`}>
                  <div className="mb-1.5 px-0.5 text-[10px] font-medium text-stone-500">
                    {RARITY_LABEL[rarity] || rarity}（{rCards.length}）
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rCards.map((card) =>
                      isCharacter ? (
                        <TributeCharacterThumb
                          key={card.instanceId}
                          card={card}
                          skillsMap={skillsMap}
                          baseUrl={baseUrl}
                          isSel={selected.has(card.instanceId)}
                          onToggleSelect={onToggleSelect}
                          onPreviewCard={onPreviewCard}
                        />
                      ) : (
                        <TributeTroopThumb
                          key={card.instanceId}
                          card={card}
                          skillsMap={skillsMap}
                          baseUrl={baseUrl}
                          isSel={selected.has(card.instanceId)}
                          onToggleSelect={onToggleSelect}
                          onPreviewCard={onPreviewCard}
                        />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-700/60 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-stone-600 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={onConfirm}
            className="rounded-lg border border-amber-700/50 bg-amber-950/50 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
          >
            {busy ? '处理中…' : '确认朝贡'}
          </button>
        </div>
      </div>
    </>
  );
}
