/**
 * 自动解锁称号（非事件链）：依次展示 TitleAchievementCard，点屏关闭。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCards } from '@/contexts/PlayerContext';
import { resolveTitleAchievementReveal } from '@/utils/cardDataTransforms';
import GrantedCardRevealOverlay from '@/components/game/GrantedCardRevealOverlay';

/**
 * @param {object[]} [grants] - milestoneUnlockPending.titles
 * @param {() => void} [onComplete] - 全部展示完毕后清空 pending
 */
export default function GrantedTitleRevealFlow({ grants, onComplete }) {
  const cards = useCards();
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const list = Array.isArray(grants) ? grants.filter(Boolean) : [];
    if (!list.length) {
      setQueue([]);
      setIndex(0);
      return;
    }
    setQueue(list);
    setIndex(0);
  }, [grants]);

  const currentGrant = queue.length > 0 && index < queue.length ? queue[index] : null;

  const reveal = useMemo(
    () => (currentGrant ? resolveTitleAchievementReveal(currentGrant, cards, 'title') : null),
    [currentGrant, cards],
  );

  const handleClose = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      return;
    }
    setQueue([]);
    setIndex(0);
    onComplete?.();
  }, [index, queue.length, onComplete]);

  return (
    <GrantedCardRevealOverlay
      open={!!reveal}
      cardType="title"
      item={reveal?.item}
      headline="获得称号"
      onClose={handleClose}
    />
  );
}
