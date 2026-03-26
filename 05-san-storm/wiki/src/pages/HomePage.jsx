/**
 * 首页组件
 * 
 * @description 游戏首页，展示功能导航
 */

import React from 'react';
import { Link } from 'react-router-dom';
import FeatureCard from '@/components/common/FeatureCard';

function HomePage() {
  return (
    <div className="space-y-8">
      {/* 游戏标题和介绍 */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          真三風雲书写半生
        </h2>
        <p className="text-3xl font-bold text-gray-900">
          三国策略战棋游戏
        </p>
      </div>

      {/* 功能导航 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <FeatureCard 
          icon="📜"
          title="黄巾之乱剧本"
          description="了解S1赛季剧本背景和玩法"
          link="/san_1"
        />
        <FeatureCard 
          icon="🏛️"
          title="势力系统"
          description="了解七大势力，选择你的阵营"
          link="/factions"
        />
        <FeatureCard 
          icon="🎖️"
          title="官职设定"
          description="查看官职等级和特权"
          link="/positions"
        />
        <FeatureCard 
          icon="👤"
          title="将领系统"
          description="浏览所有将领，查看生涯详情"
          link="/characters"
        />
        <FeatureCard 
          icon="🛡️"
          title="部队系统"
          description="查看所有部队卡牌和属性"
          link="/troops"
        />
        <FeatureCard 
          icon="⚔️"
          title="装备件系统"
          description="查看所有装备件，包含武器、防具、辅助"
          link="/equipment"
        />
        <FeatureCard 
          icon="🏆"
          title="称号/成就系统"
          description="查看所有称号和成就，包含属性加成和特效"
          link="/titles-achievements"
        />
      </div>
    </div>
  );
}

export default HomePage;
