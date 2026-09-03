/**
 * 用户协议弹窗组件
 * 
 * @description 显示用户协议内容，用户必须同意后才能继续注册
 * 协议文字内容来自 @/data/texts/agreement.js
 */

import { useState } from 'react';
import { USER_AGREEMENT } from '@/data/texts/agreement';

const UserAgreementModal = ({ isOpen, onAgree, onCancel }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  if (!isOpen) return null;

  // 检测是否滚动到底部
  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 标题 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{USER_AGREEMENT.title}</h2>
          <p className="text-sm text-gray-600 mt-1">{USER_AGREEMENT.subtitle}</p>
        </div>

        {/* 协议内容 */}
        <div 
          className="px-6 py-4 overflow-y-auto flex-1"
          onScroll={handleScroll}
        >
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 mb-4">{USER_AGREEMENT.intro}</p>

            {USER_AGREEMENT.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">{section.title}</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className={item.highlight ? 'text-red-600 font-medium' : ''}
                    >
                      {item.text}
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            <div className="mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-gray-600 font-medium">{USER_AGREEMENT.footer.brand}</p>
              <p className="text-gray-500 text-sm">{USER_AGREEMENT.footer.copyright}</p>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        {!hasScrolledToBottom && (
          <div className="px-6 py-2 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-800 text-center">
              ⬇️ 请滚动到底部阅读完整协议
            </p>
          </div>
        )}

        {/* 按钮 */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={onAgree}
            disabled={!hasScrolledToBottom}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              hasScrolledToBottom
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {hasScrolledToBottom ? '同意并继续' : '请先阅读完整协议'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserAgreementModal;
