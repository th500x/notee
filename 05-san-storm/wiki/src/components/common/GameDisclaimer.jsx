/**
 * 游戏申明组件
 * 
 * @description 展示游戏申明和版权信息
 * @module components/common/GameDisclaimer
 */

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
              我已阅读并同意以上游戏申明和版权申明
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
                  alert('请先勾选同意选项');
                }
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              同意并继续
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
