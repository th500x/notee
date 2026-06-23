import { Link } from 'react-router-dom';
import { useState } from 'react';
import { appConfig } from '@/config/appConfig';

export default function ProfileHeader({
  accountId,
  displayName,
  username,
  isOwner,
  onCreateClick,
}) {
  const [copied, setCopied] = useState(false);
  const label = displayName || username || accountId;
  const publicPath = `/u/${accountId}`;

  const handleCopyLink = async () => {
    const base = appConfig.routerBasename.replace(/\/$/, '');
    const url = `${window.location.origin}${base}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('复制此链接', url);
    }
  };

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{label} 的人生片段</h1>
        <p className="text-sm text-slate-500 font-mono">{accountId}</p>
        <button
          type="button"
          onClick={handleCopyLink}
          className="text-sm text-indigo-600 hover:underline"
        >
          {copied ? '已复制链接' : `复制链接 ${publicPath}`}
        </button>
      </div>
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={onCreateClick}
          >
            + 新建片段
          </button>
          <Link
            to="/settings"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            设置
          </Link>
        </div>
      )}
    </header>
  );
}
