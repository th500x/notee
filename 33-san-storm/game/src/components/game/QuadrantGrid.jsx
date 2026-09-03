/**
 * 横屏 2×2 四象限容器（仅布局壳，与编组 Tab 网格线风格一致）
 *
 * @param {{ id: string, title: string, content: import('react').ReactNode }[]} cells 须恰好 4 项，顺序：左上 → 右上 → 左下 → 右下
 */

export default function QuadrantGrid({ cells }) {
  if (!Array.isArray(cells) || cells.length !== 4) {
    throw new Error('QuadrantGrid: cells must be an array of length 4');
  }

  const cornerClass = [
    'border-r border-b border-stone-700/40 overflow-y-auto min-h-0 p-2 flex flex-col',
    'border-b border-stone-700/40 overflow-y-auto min-h-0 p-2 flex flex-col',
    'border-r border-stone-700/40 overflow-y-auto min-h-0 p-2 flex flex-col',
    'overflow-y-auto min-h-0 p-2 flex flex-col',
  ];

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-2 grid-rows-2">
      {cells.map((cell, index) => (
        <div key={cell.id} className={cornerClass[index]}>
          <div className="mb-2 shrink-0 text-xs font-semibold text-amber-500/90">{cell.title}</div>
          <div className="min-h-0 flex-1 text-sm text-stone-400">{cell.content}</div>
        </div>
      ))}
    </div>
  );
}
