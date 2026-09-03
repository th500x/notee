/**
 * 与开局介绍 IntroCard 同源的羊皮纸卡片壳（木纹外框 + 内页 + 标题条 + 可滚动正文）
 * @see GameIntroOverlay.jsx
 */
import { gameIntroContentParagraphClass } from '@/data/texts/gameIntroMessages';

/**
 * @param {object} props
 * @param {string} [props.icon]
 * @param {string} props.title
 * @param {string} props.content - 支持 \n 分段，样式与开局介绍一致
 * @param {import('react').ReactNode} props.footer
 * @param {string} [props.className] - 加在最外层木纹框上（如 h-full min-h-0）
 */
export function ParchmentMessageCard({ icon, title, content, footer, className = '' }) {
  return (
    <div
      className={`rounded-lg border-2 border-amber-700/60 shadow-2xl overflow-hidden flex flex-col min-h-0 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #3a2a1a 0%, #4a3828 50%, #3a2a1a 100%)',
      }}
    >
      <div
        className="m-1.5 min-h-0 flex-1 rounded overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #f5edd6 0%, #efe4c8 30%, #f0e6cc 100%)',
        }}
      >
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 flex-shrink-0">
          <div className="flex items-center gap-2 text-amber-100">
            {icon ? <span className="text-lg">{icon}</span> : null}
            <span className="text-sm font-bold tracking-wider">{title}</span>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-700/30 to-transparent flex-shrink-0" />

        <div className="flex-1 min-h-0 px-3 py-3 overflow-y-auto">
          {content.split('\n').map((paragraph, i, arr) => (
            <div key={i}>
              <p className={gameIntroContentParagraphClass}>{paragraph}</p>
              {i < arr.length - 1 && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
                  <div className="w-1 h-1 rotate-45 bg-amber-600/60" />
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 text-center flex-shrink-0 border-t border-amber-800/15">
          {footer}
        </div>
      </div>
    </div>
  );
}
