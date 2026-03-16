/**
 * M2验证模块页面
 * 
 * @description 部队编组系统验证测试
 */

import React from 'react';
import TroopFormationSystem from '@/components/verification/TroopFormationSystem';

function M2VerificationPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">M2验证模块</h2>
        <p className="text-gray-600">
          里程碑2核心功能验证 - 部队编组系统测试
        </p>
      </div>
      
      {/* 功能说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">功能特性</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 武将 + 部队卡组合机制</li>
          <li>• 实时战力计算（组合加成10%）</li>
          <li>• 最多支持6个编组</li>
          <li>• 一键自动编组功能</li>
          <li>• 使用emoji临时占位符图标</li>
        </ul>
      </div>

      <TroopFormationSystem />
    </div>
  );
}

export default M2VerificationPage;
