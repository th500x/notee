/**
 * 用户协议弹窗组件
 * 
 * @description 显示用户协议内容，用户必须同意后才能继续注册
 */

import { useState } from 'react';

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
          <h2 className="text-2xl font-bold text-gray-900">用户协议</h2>
          <p className="text-sm text-gray-600 mt-1">请仔细阅读以下协议内容</p>
        </div>

        {/* 协议内容 */}
        <div 
          className="px-6 py-4 overflow-y-auto flex-1"
          onScroll={handleScroll}
        >
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 mb-4">
              您点击"同意"或登录/使用本游戏，即表示同意本协议全部条款。
            </p>

            <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">一、账户规则</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>账户为用户方所有，享有使用权，可转让、售卖、共享。</li>
              <li>您对账户安全负全责，因被盗、共享导致的损失由您自行承担。</li>
              <li className="text-red-600 font-medium">您对账户ID保存负责，因丢失、遗忘导致的损失由您自行承担。</li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">二、行为规范</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>严禁使用外挂、脚本、破解程序，严禁利用漏洞牟利。</li>
              <li>严禁发布键政、违法、违规、色情、辱骂以及诈骗信息。</li>
              <li className="text-red-600 font-medium">
                违者运营方有权禁言、封号、清空数据。并且实施法律手段。
              </li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">三、付费与服务</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>游戏内虚拟货币、道具等不具备财产属性，仅限游戏内使用，不支持提现或退款。</li>
              <li>运营方有权根据情况调整虚拟物品的产出、价格与内容，已付费项目不予以补偿。</li>
              <li>运营方有权进行服务器维护、更新，不可抗力等导致的服务中断，不承担赔偿责任。</li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">四、免责与终止</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>因您违规导致的损失，由您自行承担，若造成运营方损失，您需予以赔偿。</li>
              <li>若账号连续90天未登录，运营方有权删除账号及所有数据，且不予以恢复。</li>
            </ol>

            <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">五、游戏申明</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>本游戏历史人物，地理，仅作尽可能还原并结合游戏性，并非完全的历史考据游戏。</li>
              <li>本游戏势力设定，综合参考史实和部分约定俗成的记述，一并糅合而成，请勿细究。</li>
            </ol>

            <div className="mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-gray-600 font-medium">Notee.vip</p>
              <p className="text-gray-500 text-sm">Copyright © 2026</p>
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
