import { useState } from 'react';
import TimelineEntryCard from '@/components/timeline/TimelineEntryCard';

export default function TimelineSection({ section, isOwner, onEdit, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="relative pl-6 border-l-2 border-indigo-100">
      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-white" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 -mt-1">
        <h2 className="text-lg font-semibold text-slate-900">
          {section.type === 'year' ? `${section.label}` : section.label}
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-4 pb-8">
          {section.entries.map((entry) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              isOwner={isOwner}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
