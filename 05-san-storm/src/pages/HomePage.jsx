/**
 * 主页组件
 * 
 * @description 真三風雲主引导页，提供wiki和game的入口
 */

import React from 'react';

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
        {/* 第一个卡片 - 项目周报 */}
        <a 
          href="/05-san-storm/weekly-report" 
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">项目周报</h3>
          <p className="text-sm text-gray-600">查看开发进度和周报更新</p>
        </a>

        {/* 第二个卡片 - Wiki页面 */}
        <a 
          href="/05-san-storm/wiki/" 
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">游戏百科</h3>
          <p className="text-sm text-gray-600">查看游戏资料和系统说明</p>
        </a>

        {/* 第三个卡片 - Game页面 */}
        <a 
          href="/05-san-storm/game/" 
          className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">游戏系统</h3>
          <p className="text-sm text-gray-600">体验游戏功能模块</p>
        </a>
      </div>

      {/* 版权申明 */}
      <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-4">© 版权申明</h3>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-line">
{`真三風雲 (San Storm)
版本：0.1.0
作者：CHRIS🇹🇭
Copyright © 2026 Notee.vip
保留所有权利`}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
