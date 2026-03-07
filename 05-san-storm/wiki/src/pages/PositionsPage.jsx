/**
 * 官职系统页面
 * 
 * @description 展示所有官职，包括等级、加成和特权
 */

import React from 'react';
import { usePositions } from '@/hooks/usePositions';
import { PositionCard } from '@/components/position/PositionCard';

function PositionsPage() {
  const { positions, loading, error } = usePositions();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载官职列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">官职系统</h2>
      <p className="text-gray-600 mb-6">
        官职系统共分为9个等级（Level 0-8），从君主到军候。Level数字越小，官职等级越高。
        Level 0-2 的高级官职每个势力唯一，需要通过竞争获得。
      </p>
      
      {/* 官职统计 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{positions.length}</p>
            <p className="text-sm text-gray-600">官职总数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {positions.filter(p => p.level === 0).length}
            </p>
            <p className="text-sm text-gray-600">君主（Level 0）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {positions.filter(p => p.level >= 0 && p.level <= 2).length}
            </p>
            <p className="text-sm text-gray-600">高级官职（0-2级）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {positions.filter(p => p.level >= 3 && p.level <= 5).length}
            </p>
            <p className="text-sm text-gray-600">中级官职（3-5级）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">
              {positions.filter(p => p.level >= 6 && p.level <= 8).length}
            </p>
            <p className="text-sm text-gray-600">基础官职（6-8级）</p>
          </div>
        </div>
      </div>

      {/* 官职卡牌网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {positions.map(position => (
          <PositionCard
            key={position.id}
            position={position}
            onSelect={(pos) => {
              alert(`选择了官职: ${pos.name}\n等级: ${pos.level}\n排名: #${pos.rank}`);
            }}
          />
        ))}
      </div>

      {/* 设计说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <h3 className="text-base font-semibold text-blue-900 mb-3">设计说明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>卡牌尺寸：</strong>256 × 384 px (2:3比例)</p>
          <p>• <strong>等级配色：</strong>Level 0红色（君主）→ Level 1橙色（三公）→ Level 2黄色（重号将军）→ 低级灰色</p>
          <p>• <strong>等级规则：</strong>Level数字越小，官职等级越高（0=最高，8=最低）</p>
          <p>• <strong>信息展示：</strong>官职名称、等级、排名、加成效果、特殊权限、晋升要求</p>
          <p>• <strong>交互效果：</strong>悬停放大、点击选择</p>
          <p>• <strong>视觉风格：</strong>与部队卡牌、服务器卡牌保持一致的暗色系风格</p>
        </div>
      </div>
    </div>
  );
}

export default PositionsPage;
