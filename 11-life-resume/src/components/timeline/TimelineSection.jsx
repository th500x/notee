import TimelineEntryCard from '@/components/timeline/TimelineEntryCard';

export default function TimelineSection({ section, isOwner, onEdit, onDelete }) {
  return (
    <section className="relative pl-6 border-l-2 border-indigo-100">
      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-white" />
      <h2 className="text-lg font-semibold text-slate-900 mb-4 -mt-1">
        {section.type === 'year' ? `${section.label}` : section.label}
      </h2>
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
    </section>
  );
}
