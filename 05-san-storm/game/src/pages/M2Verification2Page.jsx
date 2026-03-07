/**
 * M2验证模块-2页面
 * 
 * @description 游戏注册登录系统验证测试
 */

import React from 'react';
import GameAuthSystem from '@/components/auth/GameAuthSystem';

function M2Verification2Page() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">M2验证模块-2</h2>
        <p className="text-gray-600">
          游戏注册登录系统验证测试
        </p>
      </div>
      
      {/* 功能说明 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">系统特性</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• 4位随机ID注册系统（36^4 = 167万+组合）</li>
          <li>• 防重复注册（基于机器指纹和IP）</li>
          <li>• 简化注册流程（无需手机/邮箱）</li>
          <li>• 服务器选择集成</li>
          <li>• 本地存储模拟数据库</li>
        </ul>
      </div>

      <GameAuthSystem />
    </div>
  );
}

export default M2Verification2Page;
