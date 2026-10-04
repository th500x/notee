import { useMemo } from 'react';
import { countEntryTagStats } from '@shared/utils/lifeResumeEntryTags.js';

export default function ProfileTagStats({ entries, onTagClick }) {
  const stats = useMemo(() => countEntryTagStats(entries), [entries]);

  if (!entries?.length) {
    return null;
  }

  return (
    <p
      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-slate-600"
      aria-label="标签统计"
    >
      {stats.map(({ label, count }) => {
        const clickable = typeof onTagClick === 'function' && count > 0;
        if (!clickable) {
          return (
            <span key={label} className="whitespace-nowrap">
              <span>{label}</span>
              <span className="ml-1 tabular-nums font-medium text-slate-800">{count}</span>
            </span>
          );
        }
        return (
          <button
            key={label}
            type="button"
            className="whitespace-nowrap rounded-md px-1 -mx-1 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={() => onTagClick(label)}
            aria-label={`查看标签「${label}」的 ${count} 条片段`}
          >
            <span>{label}</span>
            <span className="ml-1 tabular-nums font-medium text-slate-800">{count}</span>
          </button>
        );
      })}
    </p>
  );
}
