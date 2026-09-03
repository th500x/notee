/**
 * 真三日报 · 签到奖励卡牌预览（点击遮罩关闭）
 */

import { useEffect } from 'react';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';

const BASE_URL = import.meta.env.BASE_URL || '/';

/**
 * @param {{
 *   preview: { type: string, data: object }|null,
 *   skillsMap?: Record<string, object>,
 *   onClose: () => void,
 * }} props
 */
export default function DailyReportCheckinCardPreview({ preview, skillsMap = {}, onClose }) {
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-[10090] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="签到奖励卡牌预览"
        onClick={(e) => e.stopPropagation()}
      >
        {preview.type === 'troop' ? (
          <TroopCard
            troop={preview.data}
            skillsMap={skillsMap}
            showDetails
            baseUrl={BASE_URL}
            disableHoverScale
          />
        ) : null}
        {preview.type === 'character' ? (
          <CharacterCard
            character={preview.data}
            skillsMap={skillsMap}
            showDetails
            baseUrl={BASE_URL}
            disableHoverScale
          />
        ) : null}
        {preview.type === 'equipment' || preview.type === 'treasure' ? (
          <EquipmentCard equipment={preview.data} baseUrl={BASE_URL} disableHoverScale />
        ) : null}
        {preview.type === 'title' ? (
          <TitleAchievementCard item={preview.data} type="title" baseUrl={BASE_URL} />
        ) : null}
      </div>
    </div>
  );
}
