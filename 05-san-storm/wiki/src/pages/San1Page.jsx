/**
 * 黄巾之乱剧本介绍页面 (S1赛季)
 *
 * @description 展示黄巾之乱剧本的特色和玩法介绍；文案见 game/src/data/texts/san1Scenario.js
 */

import React from 'react';
import { san1ScenarioPage, san1ScenarioCards } from '@game-texts/san1Scenario';

function San1Page() {
  const { pageTitle, pageSubtitle, footerTagline } = san1ScenarioPage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-blue-50 to-cyan-100 relative overflow-hidden">
      {/* 背景装饰 - 云朵 */}
      <div className="absolute top-20 right-10 w-32 h-16 bg-white rounded-full opacity-60 blur-sm"></div>
      <div className="absolute top-32 right-32 w-24 h-12 bg-white rounded-full opacity-50 blur-sm"></div>
      <div className="absolute top-40 left-20 w-28 h-14 bg-white rounded-full opacity-55 blur-sm"></div>
      <div className="absolute bottom-40 right-16 w-36 h-18 bg-white rounded-full opacity-50 blur-sm"></div>

      {/* 背景装饰 - 城市剪影 */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-cyan-200/40 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
          <div className="absolute bottom-0 left-10 w-16 h-24 bg-cyan-400"></div>
          <div className="absolute bottom-0 left-32 w-12 h-32 bg-cyan-500"></div>
          <div className="absolute bottom-0 left-48 w-20 h-20 bg-cyan-400"></div>
          <div className="absolute bottom-0 left-72 w-14 h-28 bg-cyan-500"></div>
          <div className="absolute bottom-0 right-72 w-18 h-26 bg-cyan-400"></div>
          <div className="absolute bottom-0 right-48 w-16 h-30 bg-cyan-500"></div>
          <div className="absolute bottom-0 right-32 w-12 h-24 bg-cyan-400"></div>
          <div className="absolute bottom-0 right-10 w-20 h-28 bg-cyan-500"></div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        {/* 标题横幅 */}
        <div className="mb-12 relative">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-2xl p-8 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
            <h1 className="text-5xl font-bold text-white text-center drop-shadow-lg">
              {pageTitle}
            </h1>
            <p className="text-white/90 text-center mt-2 text-lg">
              {pageSubtitle}
            </p>
          </div>
        </div>

        {/* 内容卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {san1ScenarioCards.map((item, index) => (
            <div
              key={item.title}
              className={`
                bg-white/90 backdrop-blur-sm rounded-2xl p-6 
                border-4 ${item.borderColor}
                shadow-xl hover:shadow-2xl
                transform hover:-translate-y-2 transition-all duration-300
                relative overflow-hidden
              `}
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
              }}
            >
              {/* 渐变背景装饰 */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.color} opacity-10 rounded-bl-full`}></div>

              {/* 标题 */}
              <div className={`inline-block bg-gradient-to-r ${item.color} text-white px-4 py-2 rounded-lg mb-4 font-bold text-lg shadow-md`}>
                {item.title}
              </div>

              {/* 内容 */}
              <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm relative z-10">
                {item.content}
              </div>
            </div>
          ))}
        </div>

        {/* 底部装饰文字 */}
        <div className="text-center py-8">
          <div className="inline-block bg-white/80 backdrop-blur-sm rounded-full px-8 py-4 shadow-lg">
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
              {footerTagline}
            </p>
          </div>
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default San1Page;
