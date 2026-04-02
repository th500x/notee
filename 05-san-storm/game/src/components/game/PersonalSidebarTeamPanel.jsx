/**
 * 个人中心内「团队」子页：百科外链 + 分组人员列表
 */

import { useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { introSegments, groups, wikiBaseUrl } from '@/data/texts/teamContent';

function resolveWikiHref(pathOrEmpty) {
  const p = pathOrEmpty === undefined || pathOrEmpty === null ? '' : String(pathOrEmpty);
  const trimmed = p.replace(/^\/+/, '');
  return `${wikiBaseUrl}${trimmed}`;
}

const PersonalSidebarTeamPanel = forwardRef(function PersonalSidebarTeamPanel(
  { onBack },
  ref
) {
  const [detailGroupId, setDetailGroupId] = useState(null);
  const detailGroup = detailGroupId ? groups.find((g) => g.id === detailGroupId) : null;

  useImperativeHandle(ref, () => ({
    /** @returns {boolean} true 表示已消费（留在团队子页） */
    handleEscape() {
      if (detailGroupId) {
        setDetailGroupId(null);
        return true;
      }
      return false;
    },
  }), [detailGroupId]);

  const openHref = useCallback((href) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  if (detailGroup) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-50/90 flex items-center gap-2 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setDetailGroupId(null)}
            className="text-amber-900 font-medium text-sm hover:text-amber-700"
          >
            ← 返回
          </button>
          <span className="text-gray-800 font-bold text-sm">{detailGroup.title}</span>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700">
          {detailGroup.description && (
            <p className="text-xs text-gray-500 mb-3">{detailGroup.description}</p>
          )}
          <p className="text-xs text-gray-500 mb-2">成员</p>
          <ul className="list-disc pl-5 space-y-1">
            {detailGroup.members.map((member, index) => {
              const memberName = typeof member === 'string' ? member : member?.name || '';
              const memberScore = typeof member === 'string' ? '' : member?.score || '';
              const key = `${memberName}-${memberScore}-${index}`;

              return (
                <li key={key}>
                  <div className="flex items-center gap-3">
                    <span className="min-w-0">{memberName}</span>
                    {memberScore ? (
                      <span className="ml-auto mr-10 w-28 pr-10 tabular-nums text-right text-gray-500">{memberScore}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-amber-200/80 bg-amber-50/90 flex items-center gap-2 sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          className="text-amber-900 font-medium text-sm hover:text-amber-700"
        >
          ← 返回
        </button>
        <span className="text-gray-800 font-bold text-sm">团队</span>
      </div>

      <div className="px-4 py-3 space-y-3 text-sm text-gray-700 leading-relaxed">
        <div className="whitespace-pre-wrap break-words">
          {introSegments.map((seg, i) => {
            if (seg.type === 'text') {
              const v = seg.value;
              return v ? <span key={i}>{v}</span> : <br key={i} />;
            }
            if (seg.type === 'link') {
              const href = seg.url ? seg.url : resolveWikiHref(seg.path);
              return (
                <span key={i}>
                  <button
                    type="button"
                    onClick={() => openHref(href)}
                    className="text-amber-800 underline underline-offset-2 hover:text-amber-950 font-medium"
                  >
                    {seg.label}
                  </button>
                </span>
              );
            }
            return null;
          })}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">分组（点击标题查看成员）</p>
          <ul className="space-y-1">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setDetailGroupId(g.id)}
                  className="w-full text-left py-2 px-2 rounded-lg hover:bg-amber-100/80 transition-colors border border-transparent hover:border-amber-200"
                >
                  <span className="font-semibold text-amber-900">{g.title}</span>
                  {g.description && (
                    <span className="block text-xs text-gray-500 mt-0.5">{g.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});

PersonalSidebarTeamPanel.displayName = 'PersonalSidebarTeamPanel';

export default PersonalSidebarTeamPanel;
