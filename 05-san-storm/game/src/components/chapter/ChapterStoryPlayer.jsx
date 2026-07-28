/**
 * 章节剧情播放：逐条 lines → complete-node
 */
import { useState } from 'react';

/**
 * @param {{
 *   title?: string|null,
 *   lines: Array<{ speaker?: string, text?: string }>,
 *   onDone: () => void|Promise<void>,
 *   busy?: boolean,
 * }} props
 */
export default function ChapterStoryPlayer({ title, lines, onDone, busy = false }) {
  const list = Array.isArray(lines) ? lines : [];
  const [idx, setIdx] = useState(0);
  const line = list[idx] || null;
  const isLast = idx >= list.length - 1;

  return (
    <div className="fixed inset-0 z-[245] flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-700/40 bg-[#1a1520] p-5 text-stone-100 shadow-xl space-y-4">
        {title ? <h2 className="text-base font-semibold text-amber-200 text-center">{title}</h2> : null}
        <div className="min-h-[5.5rem] rounded-lg bg-black/30 border border-stone-700/50 px-3 py-3">
          {line ? (
            <>
              {line.speaker ? (
                <div className="text-[11px] text-amber-300/90 mb-1.5">{line.speaker}</div>
              ) : null}
              <p className="text-sm leading-relaxed text-stone-100 whitespace-pre-wrap">{line.text || ''}</p>
            </>
          ) : (
            <p className="text-sm text-stone-500">（无对白）</p>
          )}
        </div>
        <div className="flex justify-between items-center text-[10px] text-stone-500">
          <span>
            {list.length ? `${Math.min(idx + 1, list.length)} / ${list.length}` : '0 / 0'}
          </span>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-amber-800 px-4 py-1.5 text-xs text-amber-50 disabled:opacity-50"
            onClick={() => {
              if (!isLast && list.length > 0) {
                setIdx((i) => i + 1);
                return;
              }
              void onDone?.();
            }}
          >
            {list.length === 0 || isLast ? '继续' : '下一句'}
          </button>
        </div>
      </div>
    </div>
  );
}
