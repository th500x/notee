import { useCallback, useEffect, useState } from 'react';
import {
  readTimelineSectionCollapse,
  writeTimelineSectionCollapse,
} from '@/utils/timelineSectionCollapse';

/**
 * 按公开页 ownerId 持久化各年份/未知块的收起状态（localStorage）。
 */
export function useTimelineSectionCollapse(ownerAccountId) {
  const ownerId = String(ownerAccountId || '').trim().toUpperCase();

  const [collapsedBySectionId, setCollapsedBySectionId] = useState(() =>
    readTimelineSectionCollapse(ownerId)
  );

  useEffect(() => {
    setCollapsedBySectionId(readTimelineSectionCollapse(ownerId));
  }, [ownerId]);

  const isSectionCollapsed = useCallback(
    (sectionId) => !!collapsedBySectionId[sectionId],
    [collapsedBySectionId]
  );

  const toggleSectionCollapsed = useCallback(
    (sectionId) => {
      const id = String(sectionId || '');
      if (!id) return;
      setCollapsedBySectionId((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id];
        } else {
          next[id] = true;
        }
        writeTimelineSectionCollapse(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  return { isSectionCollapsed, toggleSectionCollapsed };
}
