/**
 * 古风弹框 Demo 页面
 * 
 * @description 展示各种古风弹框/对话框样式
 * 路由：/demo/ancient-modal
 */

import { useState } from 'react';
import AncientModal, { Divider } from '@/components/common/AncientModal';

const AncientModalDemo = () => {
  const [openModal, setOpenModal] = useState(null);

  const close = () => setOpenModal(null);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">古风弹框 Demo</h1>
        <p className="text-gray-500 text-sm">点击按钮预览不同类型的弹框效果</p>
      </div>

      {/* 触发按钮 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setOpenModal('info')}
          className="p-4 rounded-lg bg-amber-50 border-2 border-amber-300 hover:bg-amber-100 transition-colors"
        >
          <div className="text-2xl mb-2">📜</div>
          <div className="font-bold text-amber-900">信息弹框</div>
          <div className="text-xs text-amber-700 mt-1">通用信息提示</div>
        </button>

        <button
          onClick={() => setOpenModal('confirm')}
          className="p-4 rounded-lg bg-amber-50 border-2 border-amber-300 hover:bg-amber-100 transition-colors"
        >
          <div className="text-2xl mb-2">⚔️</div>
          <div className="font-bold text-amber-900">确认弹框</div>
          <div className="text-xs text-amber-700 mt-1">需要确认/取消</div>
        </button>

        <button
          onClick={() => setOpenModal('warning')}
          className="p-4 rounded-lg bg-red-50 border-2 border-red-300 hover:bg-red-100 transition-colors"
        >
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-bold text-red-900">警告弹框</div>
          <div className="text-xs text-red-700 mt-1">危险操作警告</div>
        </button>

        <button
          onClick={() => setOpenModal('reward')}
          className="p-4 rounded-lg bg-yellow-50 border-2 border-yellow-300 hover:bg-yellow-100 transition-colors"
        >
          <div className="text-2xl mb-2">🎁</div>
          <div className="font-bold text-yellow-900">奖励弹框</div>
          <div className="text-xs text-yellow-700 mt-1">获得奖励通知</div>
        </button>

        <button
          onClick={() => setOpenModal('battle')}
          className="p-4 rounded-lg bg-blue-50 border-2 border-blue-300 hover:bg-blue-100 transition-colors"
        >
          <div className="text-2xl mb-2">🗡️</div>
          <div className="font-bold text-blue-900">战斗结算</div>
          <div className="text-xs text-blue-700 mt-1">复杂内容示例</div>
        </button>

        <button
          onClick={() => setOpenModal('event')}
          className="p-4 rounded-lg bg-purple-50 border-2 border-purple-300 hover:bg-purple-100 transition-colors"
        >
          <div className="text-2xl mb-2">📖</div>
          <div className="font-bold text-purple-900">事件对话</div>
          <div className="text-xs text-purple-700 mt-1">剧情事件示例</div>
        </button>
      </div>

      {/* ===== 信息弹框 ===== */}
      <AncientModal
        isOpen={openModal === 'info'}
        onClose={close}
        type="info"
        title="系统公告"
        confirmText="知道了"
        onConfirm={close}
      >
        <p>各位将军，赛季1【黄巾之乱】将于三月二十日正式开启。</p>
        <p className="mt-2 text-gray-600">届时请各位将军做好准备，共赴沙场！</p>
      </AncientModal>

      {/* ===== 确认弹框 ===== */}
      <AncientModal
        isOpen={openModal === 'confirm'}
        onClose={close}
        type="confirm"
        title="出征确认"
        confirmText="出征"
        cancelText="取消"
        showCancel
        onConfirm={close}
        onCancel={close}
      >
        <div className="text-center">
          <p>确定要率军出征<span className="font-bold text-amber-800">【邺城】</span>吗？</p>
          <Divider />
          <div className="flex justify-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">消耗粮草</span>
              <div className="font-bold text-amber-800">🌾 500</div>
            </div>
            <div>
              <span className="text-gray-500">预计行军</span>
              <div className="font-bold text-amber-800">⏱️ 30分钟</div>
            </div>
            <div>
              <span className="text-gray-500">出征兵力</span>
              <div className="font-bold text-amber-800">⚔️ 1,200</div>
            </div>
          </div>
        </div>
      </AncientModal>

      {/* ===== 警告弹框 ===== */}
      <AncientModal
        isOpen={openModal === 'warning'}
        onClose={close}
        type="warning"
        title="危险操作"
        confirmText="确认放弃"
        cancelText="返回"
        showCancel
        onConfirm={close}
        onCancel={close}
      >
        <div className="text-center">
          <p className="text-red-800 font-medium">确定要放弃当前势力吗？</p>
          <p className="mt-2 text-gray-600 text-xs">
            放弃势力后，你将失去所有官职、城市和军团关系。<br />
            此操作不可撤销！
          </p>
        </div>
      </AncientModal>

      {/* ===== 奖励弹框 ===== */}
      <AncientModal
        isOpen={openModal === 'reward'}
        onClose={close}
        type="reward"
        title="事件奖励"
        confirmText="领取"
        onConfirm={close}
      >
        <div className="text-center">
          <p className="text-amber-800 font-medium mb-3">完成事件【桃园结义】</p>
          <div className="inline-flex flex-col gap-2 text-left bg-amber-50/80 rounded-lg p-4 border border-amber-200/60">
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">💰</span>
              <span className="text-sm">银两 +500</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">🌾</span>
              <span className="text-sm">粮草 +1,000</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">🎖️</span>
              <span className="text-sm">声望 +20</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">⚔️</span>
              <span className="text-sm text-purple-700 font-medium">精锐步兵 ×1（紫色）</span>
            </div>
          </div>
        </div>
      </AncientModal>

      {/* ===== 战斗结算 ===== */}
      <AncientModal
        isOpen={openModal === 'battle'}
        onClose={close}
        type="info"
        title="战斗结算"
        confirmText="确定"
        onConfirm={close}
        width="max-w-lg"
      >
        <div>
          {/* 胜负标题 */}
          <div className="text-center mb-3">
            <span className="text-2xl font-bold text-green-700">胜利</span>
          </div>

          {/* 双方对比 */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
            <div>
              <div className="text-xs text-gray-500">我方</div>
              <div className="font-bold text-blue-700">刘备军</div>
            </div>
            <div className="text-gray-400 self-center">VS</div>
            <div>
              <div className="text-xs text-gray-500">敌方</div>
              <div className="font-bold text-red-700">黄巾军</div>
            </div>
          </div>

          <Divider />

          {/* 战损统计 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">我方战损</div>
              <div>阵亡：<span className="text-red-600 font-medium">120</span></div>
              <div>负伤：<span className="text-amber-600 font-medium">80</span></div>
              <div>剩余：<span className="text-green-600 font-medium">800</span></div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">敌方战损</div>
              <div>阵亡：<span className="text-red-600 font-medium">350</span></div>
              <div>负伤：<span className="text-amber-600 font-medium">150</span></div>
              <div>溃逃：<span className="text-gray-600 font-medium">500</span></div>
            </div>
          </div>

          <Divider />

          {/* 获得奖励 */}
          <div className="text-xs text-gray-500 font-medium mb-2">战利品</div>
          <div className="flex gap-4 text-sm">
            <span>💰 +200</span>
            <span>🌾 +500</span>
            <span>🎖️ +10</span>
          </div>
        </div>
      </AncientModal>

      {/* ===== 事件对话 ===== */}
      <AncientModal
        isOpen={openModal === 'event'}
        onClose={close}
        type="info"
        title="桃园结义"
        confirmText="继续"
        onConfirm={close}
      >
        <div>
          {/* 角色头像区 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-xl border-2 border-amber-600/40 shadow-sm">
              👤
            </div>
            <div>
              <div className="font-bold text-amber-900">刘备</div>
              <div className="text-xs text-gray-500">涿郡涿县</div>
            </div>
          </div>

          {/* 对话内容 */}
          <div className="relative pl-4 border-l-2 border-amber-300/60">
            <p className="text-gray-700 leading-relaxed" style={{ fontStyle: 'italic' }}>
              "不求同年同月同日生，但求同年同月同日死。皇天后土，实鉴此心。背义忘恩，天人共戮！"
            </p>
          </div>

          <Divider />

          <p className="text-xs text-gray-500 text-center">
            刘备、关羽、张飞三人在桃园中结为兄弟，誓同生死。
          </p>
        </div>
      </AncientModal>
    </div>
  );
};

export default AncientModalDemo;
