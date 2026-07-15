import { useCallback, useEffect, useState } from 'react';
import {
  readTimelineSectionCollapse,
  writeTimelineSectionCollapse,
} from '@/utils/timelineSectionCollapse';

/**
 * 按公开页 ownerId + 当前系列持久化置顶 / 年份 / 未知各块的收起状态。
 */
export function useTimelineSectionCollapse(ownerAccountId, entrySeriesId = null) {
  const ownerId = String(ownerAccountId || '').trim().toUpperCase();

  const [collapsedBySectionId, setCollapsedBySectionId] = useState(() =>
    readTimelineSectionCollapse(ownerId, entrySeriesId)
  );

  useEffect(() => {
    setCollapsedBySectionId(readTimelineSectionCollapse(ownerId, entrySeriesId));
  }, [ownerId, entrySeriesId]);

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
        writeTimelineSectionCollapse(ownerId, entrySeriesId, next);
        return next;
      });
    },
    [ownerId, entrySeriesId]
  );

  return { isSectionCollapsed, toggleSectionCollapsed };
}
