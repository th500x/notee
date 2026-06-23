import { Link } from 'react-router-dom';

export default function SharedAccessCard({ accountId, username, accessibleEntryCount = 0 }) {
  const displayName = username || accountId;
  const countLabel =
    accessibleEntryCount > 0 ? `${accessibleEntryCount} 条分享给我` : '分享给我看的';

  return (
    <Link
      to={`/u/${accountId}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow transition-colors"
    >
      <div
        className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold mb-3"
        aria-hidden="true"
      >
        {displayName.slice(0, 1).toUpperCase()}
      </div>
      <p className="font-semibold text-slate-900 truncate">{displayName}</p>
      <p className="text-xs text-slate-500 font-mono mt-0.5">{accountId}</p>
      <p className="text-xs text-slate-500 mt-2">{countLabel}</p>
    </Link>
  );
}
