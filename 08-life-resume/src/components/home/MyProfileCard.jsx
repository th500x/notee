import { Link } from 'react-router-dom';

export default function MyProfileCard({ accountId, displayName, username, isDefaultUsername }) {
  const label = displayName || username || accountId;

  return (
    <Link
      to={`/u/${accountId}`}
      className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
    >
      <div
        className="w-14 h-14 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-lg font-semibold shrink-0"
        aria-hidden="true"
      >
        {label.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-indigo-700 mb-0.5">我的片段</p>
        <p className="font-semibold text-slate-900 truncate">{label}</p>
        <p className="text-sm text-slate-500 font-mono">{accountId}</p>
        {isDefaultUsername && (
          <p className="text-xs text-slate-500 mt-1">可在设置中修改展示名</p>
        )}
      </div>
      <span className="text-sm text-indigo-700 shrink-0">进入编辑 →</span>
    </Link>
  );
}
