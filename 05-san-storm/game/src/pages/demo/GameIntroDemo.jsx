/**
 * 游戏特色介绍 Demo 页面
 * 
 * @description 预览步骤1.5的游戏特色介绍对话框效果
 * 路由：/demo/game-intro
 */

import { useState } from 'react';
import GameIntroOverlay from '@/components/tutorial/GameIntroOverlay';

const GameIntroDemo = () => {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">游戏特色介绍 Demo</h1>
        <p className="text-gray-500 text-sm">步骤1.5：角色创建完成后的游戏介绍对话框</p>
      </div>

      <div className="text-center">
        <button
          onClick={() => setShowOverlay(true)}
          className="px-8 py-4 rounded-lg text-white font-bold text-lg shadow-lg
            hover:shadow-xl active:shadow-md transition-all
            bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700
            hover:from-amber-600 hover:via-amber-500 hover:to-amber-600"
        >
          🎬 启动游戏介绍
        </button>
      </div>

      <div className="bg-gray-100 rounded-lg p-6 text-sm text-gray-600 space-y-2">
        <p>📌 操作说明：</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>点击任意处 / 按 Enter / 空格 → 下一条</li>
          <li>按 Esc / 点击右上角"跳过全部" → 直接退出</li>
          <li>横屏（≥768px）：四象限轮转布局</li>
          <li>竖屏（&lt;768px）：上下交替布局</li>
        </ul>
      </div>

      {showOverlay && (
        <GameIntroOverlay onComplete={() => setShowOverlay(false)} />
      )}
    </div>
  );
};

export default GameIntroDemo;
