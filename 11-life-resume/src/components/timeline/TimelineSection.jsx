import TimelineEntryCard from '@/components/timeline/TimelineEntryCard';

export default function TimelineSection({
  section,
  isOwner,
  accountId,
  profileDisplayName,
  collapsed = false,
  onToggleCollapse,
  onEdit,
  onDelete,
}) {
  const isPinned = section.type === 'pinned';

  return (
    <section
      className={
        isPinned ? 'mb-6 space-y-4' : 'relative pl-6 border-l-2 border-indigo-100'
      }
    >
      {!isPinned && (
        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-white" />
      )}
      <div
        className={
          isPinned
            ? 'flex flex-wrap items-center gap-x-3 gap-y-1'
            : 'flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 -mt-1'
        }
      >
        <h2
          className={
            isPinned
              ? 'text-sm font-semibold text-indigo-700 tracking-wide'
              : 'text-lg font-semibold text-slate-900'
          }
        >
          {section.label}
        </h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>
      {!collapsed && (
        <div className={isPinned ? 'space-y-4' : 'space-y-4 pb-8'}>
          {section.entries.map((entry) => (
            <TimelineEntryCard
              key={entry.id}
              entry={entry}
              isOwner={isOwner}
              accountId={accountId}
              profileDisplayName={profileDisplayName}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
