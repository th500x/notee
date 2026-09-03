/**
 * 势力 Tab ·「军团」（横屏左下 / 竖屏子 Tab）
 * 纯展示：三公府编制后的本势力活跃军团（只读，无品阶门闸）。
 * 数据：`GET …/faction/overview` 的 `legions`，与「势力信息 · 规模 · 军团数」弹层同源。
 */

import { SectionTitle, Line } from '@/components/game/faction/FactionInfoPanel';

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('zh-CN');
}

/**
 * @param {{ overview?: object|null, loading?: boolean, error?: string|null }} props
 */
export default function FactionLegionSection({ overview, loading = false, error = null }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent"
          aria-hidden
        />
        加载中…
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400/90">{error}</p>;
  }

  const legions = overview?.legions || [];

  return (
    <div className="flex flex-col gap-2 text-left">
      <p className="text-[10px] leading-snug text-stone-500">
        军团编制在三公府进行；此处展示本势力已成立军团（只读）。
      </p>
      <SectionTitle>活跃军团</SectionTitle>
      {legions.length === 0 ? (
        <Line>暂无活跃军团</Line>
      ) : (
        <ul className="max-h-[min(40vh,14rem)] space-y-2 overflow-y-auto pr-0.5">
          {legions.map((lg) => (
            <li
              key={lg.legionId}
              className="border-b border-stone-700/40 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="text-xs font-medium text-stone-100">{lg.legionName}</div>
              <Line>
                <span className="text-stone-500">团长：</span>
                {lg.commanderName || '—'}
              </Line>
              <Line>
                <span className="text-stone-500">成员：</span>
                {fmtNum(lg.memberCount)}
              </Line>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
