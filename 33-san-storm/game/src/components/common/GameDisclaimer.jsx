/**
 * 游戏申明组件
 * 
 * @description 展示游戏申明、版权信息和S1赛季介绍
 * @module components/common/GameDisclaimer
 */

import { useState } from 'react';
import AncientModal from '@/components/common/AncientModal';

/**
 * 游戏申明组件
 */
export function GameDisclaimer({ showFull = false }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">📜 游戏申明</h3>
      
      <div className="space-y-3 text-sm text-gray-700">
        <p>• 本游戏历史人物，地理，仅作尽可能还原并结合游戏性，并非完全历史考据游戏，请勿细究。</p>
        <p>• 本游戏势力设定，综合参考史实和部分约定俗成中战力，管辖区域等，糅合而成，请勿细究。</p>
        <p>• 玩家拥有数据的所有权，如果本游戏不幸倒闭了，同样会生成一份赛博墓志铭资料以作纪念。</p>
        <p>• 游戏管理员有权对非法或者利用BUG等非正常手段获利的玩家进行制裁，并且实施法律手段。</p>
      </div>

      {showFull && (
        <>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-bold text-gray-900 mb-3">🎮 S1赛季介绍</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* 左侧2列：赛季介绍 */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">抽卡全免，真爱无私</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">武将唯一，你即唯一</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">赛季战令，氪金独苗</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">精彩日常，绝不长草</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">结合史实，地图考究</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">战役系统，战至终章</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">七大势力，特色各异(S1)</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">聚焦东汉核心七州燃烽火</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">摒弃无聊比拼武将纯数值</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">多线程动态调整势力强度</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">上百位黄巾之乱真实武将</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">上千条游戏随机组合事件</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">每日生成漫画不虚度每一天</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-sm text-gray-700">赛季末进行豪华的终局评定</span>
                  </div>
                </div>
              </div>
              
              {/* 右侧2列：预留空间 */}
              <div className="md:col-span-2">
                {/* 这里可以放其他内容，比如图片、视频等 */}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-bold text-gray-900 mb-3">© 版权申明</h4>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-line">
{`真三風雲 (San Storm)
版本：0.1.0
Copyright © 2026 Notee.vip
保留所有权利

本游戏为原创作品，受版权法保护。
游戏中的创意、机制、数据均为原创。`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 注册确认弹窗组件
 */
export function DisclaimerModal({ isOpen, onAccept, onCancel }) {
  const [agreeHintOpen, setAgreeHintOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            欢迎来到真三風雲
          </h2>
          
          <p className="text-gray-600 mb-6">
            在开始游戏之前，请仔细阅读并同意以下游戏申明：
          </p>

          <GameDisclaimer showFull={true} />

          <div className="mt-6 flex items-start space-x-3">
            <input
              type="checkbox"
              id="agree-checkbox"
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="agree-checkbox" className="text-sm text-gray-700">
              我已阅读并同意以上游戏申明、S1赛季介绍和版权申明
            </label>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                const checkbox = document.getElementById('agree-checkbox');
                if (checkbox && checkbox.checked) {
                  onAccept();
                } else {
                  setAgreeHintOpen(true);
                }
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              同意并继续
            </button>
          </div>
        </div>
      </div>

      <AncientModal
        isOpen={agreeHintOpen}
        type="warning"
        title="提示"
        confirmText="确定"
        onConfirm={() => setAgreeHintOpen(false)}
        onClose={() => setAgreeHintOpen(false)}
      >
        <p className="text-center text-gray-800 text-sm">请先勾选同意选项</p>
      </AncientModal>
    </div>
  );
}
