/**
 * 个人中心内「机制」子页：多块核心介绍（文案见 personalCenterContent）
 */

import { mechanicsBlocks } from '@/data/texts/personalCenterContent';

export default function PersonalSidebarMechanicsPanel({ onBack }) {
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
        <span className="text-gray-800 font-bold text-sm">机制</span>
      </div>

      <div className="px-4 py-3 space-y-3 text-sm text-gray-700 leading-relaxed">
        {mechanicsBlocks.map((block) => (
          <section
            key={block.id}
            className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0"
          >
            <h3 className="text-xs font-bold text-amber-900/90 mb-2">{block.title}</h3>
            <p className="whitespace-pre-wrap break-words text-gray-700">{block.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
