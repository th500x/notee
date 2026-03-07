/**
 * 黄巾之乱剧本介绍页面 (S1赛季)
 * 
 * @description 展示黄巾之乱剧本的特色和玩法介绍
 */

import React from 'react';

function San1Page() {
  // 剧本介绍内容
  const scenarioContent = [
    {
      title: '七大势力',
      content: '七大势力，搅动东汉之末世\n祸起黄巾，敢掀起黄天蔽日？\n诸侯即可匡扶汉室\n亦可称王逐鹿中原',
      color: 'from-green-400 to-green-500',
      borderColor: 'border-green-400'
    },
    {
      title: '丰富内容',
      content: '聚焦东汉核心七州燃烽火\n州内首府，城池，关隘，据点\n官职私领，终有一城归属主公\n上百位黄巾之乱真实武将\n上千条游戏随机组合事件\n预设精彩战役，体验历史',
      color: 'from-yellow-400 to-yellow-500',
      borderColor: 'border-yellow-400'
    },
    {
      title: '游戏特色',
      content: '胜负并不取决于数值比拼\n机缘结合肝度，独挡一方\n高阶官职，挑动风云\n合纵连横，多方外交\n抽卡全免，百分体验\n赛季战令，氪金独苗',
      color: 'from-blue-400 to-blue-500',
      borderColor: 'border-blue-400'
    },
    {
      title: '核心系统',
      content: '武将唯一，将尽其用\n特色部队，驰骋疆场\n多线程动态调整势力强度\n每日生成漫画不虚每一天\n真三风云，书写半生！\n叱咤华夏，就在当下！',
      color: 'from-cyan-400 to-cyan-500',
      borderColor: 'border-cyan-400'
    },
    {
      title: '赛季玩法',
      content: '赛季末进行豪华终局评定\n赛季保留物品：\n称号/成就/宝物\n1套全装装备卡\n所有金色部队卡\n最多10个橙色部队卡\n最多10个紫色部队卡',
      color: 'from-pink-400 to-pink-500',
      borderColor: 'border-pink-400'
    },
    {
      title: '创作团队',
      content: '策划：Notee.vip\n文档：Notee.vip\n测试：Notee.vip + 南阳伙伴\n编程：Kiro AI\n美术：ComfyUI + SDXL 1.0\n音效：TBD\n鸣谢：TBD',
      color: 'from-purple-400 to-purple-500',
      borderColor: 'border-purple-400'
    }
  ];

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
              黄巾之乱剧本
            </h1>
            <p className="text-white/90 text-center mt-2 text-lg">
              S1 赛季 - 东汉末年，群雄并起
            </p>
          </div>
        </div>

        {/* 内容卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {scenarioContent.map((item, index) => (
            <div
              key={index}
              className={`
                bg-white/90 backdrop-blur-sm rounded-2xl p-6 
                border-4 ${item.borderColor}
                shadow-xl hover:shadow-2xl
                transform hover:-translate-y-2 transition-all duration-300
                relative overflow-hidden
              `}
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`
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
              真三風雲，书写半生！
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
