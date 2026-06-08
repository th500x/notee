/**
 * 获得称号/成就时全屏展示卡牌；点击屏幕任意位置关闭。
 */

import { createPortal } from 'react-dom';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';

/** 高于 PersonalCatalogModal z-[10080] */
const REVEAL_Z = 'z-[10150]';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {'title'|'achievement'} props.cardType
 * @param {object|null} props.item - TitleAchievementCard item
 * @param {string} [props.headline]
 * @param {() => void} props.onClose
 */
export default function GrantedCardRevealOverlay({
  open,
  cardType,
  item,
  headline = '获得卡牌',
  onClose,
}) {
  if (!open || !item) return null;

  const baseUrl = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';

  return createPortal(
    <div
      className={`fixed inset-0 ${REVEAL_Z} flex flex-col items-center justify-center bg-black/65 px-4 cursor-pointer`}
      role="presentation"
      onClick={onClose}
    >
      <p className="mb-4 text-center text-lg font-bold text-amber-100 pointer-events-none">
        {headline}
      </p>
      <div className="pointer-events-none">
        <TitleAchievementCard item={item} type={cardType} baseUrl={baseUrl} />
      </div>
      <p className="mt-5 text-center text-xs text-white/55 pointer-events-none">
        点击任意位置关闭
      </p>
    </div>,
    document.body,
  );
}
