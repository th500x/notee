import { Link } from 'react-router-dom';
import { useState } from 'react';
import { appConfig } from '@/config/appConfig';
import { useLifePathGenerateCooldown } from '@/hooks/useLifePathGenerateCooldown';

export default function ProfileHeader({
  accountId,
  displayName,
  username,
  isOwner,
  onCreateClick,
  onGenerateLifePathClick,
  onPreviewLifePathClick,
  generatingLifePath = false,
  lifePathStatus = 'none',
  lifePathGeneratedAt = null,
  lifePathGenerateAvailableAt = null,
  lifePathCooldownHours,
  lifePathGenerateAllowed = true,
}) {
  const [copied, setCopied] = useState(false);
  const [showCooldownHint, setShowCooldownHint] = useState(false);
  const label = displayName || username || accountId;
  const publicPath = `/u/${accountId}`;

  const { onCooldown, remainingText } = useLifePathGenerateCooldown({
    generatedAt: lifePathGeneratedAt,
    availableAt: lifePathGenerateAvailableAt,
    cooldownHours: lifePathCooldownHours,
  });

  const generateDisabled = generatingLifePath;
  const cooldownActive = onCooldown || lifePathGenerateAllowed === false;

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

  const handleGenerateClick = () => {
    if (generatingLifePath) return;
    if (cooldownActive) {
      setShowCooldownHint((value) => !value);
      return;
    }
    setShowCooldownHint(false);
    onGenerateLifePathClick?.();
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
        {isOwner && lifePathStatus === 'published' && (
          <p className="text-xs text-emerald-700">轨迹已发布</p>
        )}
        {isOwner && lifePathStatus === 'draft' && (
          <button
            type="button"
            className="text-xs text-amber-700 hover:underline"
            onClick={onPreviewLifePathClick}
          >
            有未发布轨迹草稿 · 点击预览
          </button>
        )}
      </div>
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          {onGenerateLifePathClick && (
            <div
              className="relative"
              onMouseEnter={() => cooldownActive && setShowCooldownHint(true)}
              onMouseLeave={() => setShowCooldownHint(false)}
            >
              <button
                type="button"
                className={
                  cooldownActive
                    ? 'inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'inline-flex items-center px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60'
                }
                onClick={handleGenerateClick}
                disabled={generateDisabled}
                aria-disabled={generateDisabled || cooldownActive}
              >
                {generatingLifePath ? '生成中…' : '生成轨迹'}
              </button>
              {cooldownActive && showCooldownHint && (
                <div
                  role="tooltip"
                  className="absolute z-10 right-0 top-full mt-2 w-max max-w-[16rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg"
                >
                  {remainingText}
                </div>
              )}
            </div>
          )}
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
