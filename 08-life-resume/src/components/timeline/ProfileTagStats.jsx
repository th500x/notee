import { useMemo } from 'react';
import { countEntryTagStats } from '@shared/utils/lifeResumeEntryTags.js';

export default function ProfileTagStats({ entries }) {
  const stats = useMemo(() => countEntryTagStats(entries), [entries]);

  if (!entries?.length) {
    return null;
  }

  return (
    <p
      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-slate-600"
      aria-label="标签统计"
    >
      {stats.map(({ label, count }) => (
        <span key={label} className="whitespace-nowrap">
          <span>{label}</span>
          <span className="ml-1 tabular-nums font-medium text-slate-800">{count}</span>
        </span>
      ))}
    </p>
  );
}
