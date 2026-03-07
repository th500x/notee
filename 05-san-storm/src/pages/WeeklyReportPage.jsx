/**
 * 项目周报页面
 * 
 * @description 展示真三風雲项目的开发进度周报
 */

import React from 'react';

function WeeklyReportPage() {
  // 周报内容
  const weeklyReports = [
    {
      week: 'W01',
      date: '2月2日-2月8日',
      content: `建立新文件夹
官方网站上线
四大模块上线
• 势力系统（7个）
• 官职设定（35个）
• 将领系统（180个）
• 部队系统（74个）`,
      color: 'from-blue-400 to-blue-500',
      borderColor: 'border-blue-400'
    },
    {
      week: 'W02',
      date: '2月9日-2月15日',
      content: `将领系统加入生涯/特性/技能/羁绊/传记/字号
四大模块数据优化中
M1完成，进入M2阶段
• M2验证模块-1（部队编组系统）
• M2验证模块-2（用户注册系统）
• M2验证模块-3（战役地图展示）
• 用户管理模块`,
      color: 'from-green-400 to-green-500',
      borderColor: 'border-green-400'
    },
    {
      week: 'W03',
      date: '2月16日-2月22日',
      content: `完善核心文档
测试美术资源
• 基础模型: SD1.5 → SDXL1.0
• 美术模型: TastyRice → GuFengXL
• 部队系统卡面更新
• 上线初版项目周报`,
      color: 'from-purple-400 to-purple-500',
      borderColor: 'border-purple-400'
    },
    {
      week: 'W04',
      date: '2月23日-3月1日',
      content: `制作美术资源
主要瓦片完成
部队图标完成（70+）
制作第一张战役地图`,
      color: 'from-yellow-400 to-yellow-500',
      borderColor: 'border-yellow-400'
    },
    {
      week: 'W05(归乡中)',
      date: '3月2日-3月8日',
      content: `完善核心文档v2
网站架构改版
剧本介绍上线
项目周报改版`,
      color: 'from-pink-400 to-pink-500',
      borderColor: 'border-pink-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-100 relative overflow-hidden">
      {/* 背景装饰 - 云朵 */}
      <div className="absolute top-20 right-10 w-32 h-16 bg-white rounded-full opacity-60 blur-sm"></div>
      <div className="absolute top-32 right-32 w-24 h-12 bg-white rounded-full opacity-50 blur-sm"></div>
      <div className="absolute top-40 left-20 w-28 h-14 bg-white rounded-full opacity-55 blur-sm"></div>
      <div className="absolute bottom-40 right-16 w-36 h-18 bg-white rounded-full opacity-50 blur-sm"></div>
      
      {/* 背景装饰 - 城市剪影 */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-purple-200/40 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
          <div className="absolute bottom-0 left-10 w-16 h-24 bg-purple-400"></div>
          <div className="absolute bottom-0 left-32 w-12 h-32 bg-purple-500"></div>
          <div className="absolute bottom-0 left-48 w-20 h-20 bg-purple-400"></div>
          <div className="absolute bottom-0 left-72 w-14 h-28 bg-purple-500"></div>
          <div className="absolute bottom-0 right-72 w-18 h-26 bg-purple-400"></div>
          <div className="absolute bottom-0 right-48 w-16 h-30 bg-purple-500"></div>
          <div className="absolute bottom-0 right-32 w-12 h-24 bg-purple-400"></div>
          <div className="absolute bottom-0 right-10 w-20 h-28 bg-purple-500"></div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        {/* 标题横幅 */}
        <div className="mb-12 relative">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg shadow-2xl p-8 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
            <h1 className="text-5xl font-bold text-white text-center drop-shadow-lg">
              项目周报
            </h1>
            <p className="text-white/90 text-center mt-2 text-lg">
              真三風雲 - 开发进度追踪
            </p>
          </div>
        </div>

        {/* 周报卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {weeklyReports.map((report, index) => (
            <div
              key={index}
              className={`
                bg-white/90 backdrop-blur-sm rounded-2xl p-6 
                border-4 ${report.borderColor}
                shadow-xl hover:shadow-2xl
                transform hover:-translate-y-2 transition-all duration-300
                relative overflow-hidden
              `}
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
              }}
            >
              {/* 渐变背景装饰 */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${report.color} opacity-10 rounded-bl-full`}></div>
              
              {/* 标题 */}
              <div className={`inline-block bg-gradient-to-r ${report.color} text-white px-4 py-2 rounded-lg mb-2 font-bold text-lg shadow-md`}>
                {report.week}
              </div>
              
              {/* 日期 */}
              <div className="text-gray-500 text-sm mb-4">
                {report.date}
              </div>
              
              {/* 内容 */}
              <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm relative z-10">
                {report.content}
              </div>
            </div>
          ))}
        </div>

        {/* 底部装饰文字 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* 测试奖励文字框 */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg border-2 border-yellow-300">
            <div className="space-y-2 text-left">
              <p className="text-xl font-bold text-orange-600">[测试奖励P1阶段]</p>
              <p className="text-base text-gray-700 font-semibold mt-3">条件：</p>
              <p className="text-base text-gray-600 ml-4">1. [参与M2测试]</p>
              <p className="text-base text-gray-600 ml-4">2. [参与M3测试]</p>
              <p className="text-base text-gray-700 font-semibold mt-3">名额：10人</p>
              <p className="text-base text-gray-600 ml-4">• 测试积分最高入选5人</p>
              <p className="text-base text-gray-600 ml-4">• 通过抽奖程序入选5人</p>
              <p className="text-base text-gray-700 font-semibold mt-3">奖池：合计500RMB</p>
              <p className="text-sm text-gray-500 italic ml-4">*具体奖励内容待定</p>
            </div>
          </div>

          {/* 里程碑概览文字框 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg">
            <div className="space-y-2 text-left">
              <p className="text-xl font-bold text-gray-800">[里程碑概览]</p>
              <p className="text-lg text-green-600 font-semibold">1. [M1 - 基础框架与数据]（DONE）</p>
              <p className="text-lg text-blue-600 font-semibold">2. [M2 - 基础系统简化版]（IN PROGRESS）</p>
              <p className="text-lg text-gray-500">3. [M3 - 地图系统简化版]（TBD）</p>
              <p className="text-lg text-gray-500">4. [M4 - AI系统简化版]（TBD）</p>
              <p className="text-lg text-purple-600 font-semibold">5. [MVP - 最小可玩版本]（TBD）</p>
            </div>
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

export default WeeklyReportPage;
