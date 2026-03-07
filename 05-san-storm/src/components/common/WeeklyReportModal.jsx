/**
 * 周报弹窗组件
 * 
 * @description 展示项目追踪周报
 */

import React from 'react';

function WeeklyReportModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">📊 项目追踪周报</h2>
              <p className="text-purple-100 text-sm">真三風雲 S1赛季开发进度</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* W05 */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h3 className="text-xl font-bold text-gray-900">W05（2月2日-2月8日）</h3>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">M1完成</span>
            </div>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-700 font-medium mb-2">各系统基础设计、数据收集和编排、网站上线</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-2">三大主要模块上线：</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>1. 势力系统（包含官职）</li>
                    <li>2. 将领系统</li>
                    <li>3. 部队系统</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-semibold text-blue-900 mb-2">数据统计：</p>
                <div className="grid grid-cols-2 gap-2 text-blue-800">
                  <div>• 势力数据: 7个</div>
                  <div>• 官职数据: 35个</div>
                  <div>• 将领数据: 180个</div>
                  <div>• 部队数据: 74个</div>
                </div>
              </div>
            </div>
          </div>

          {/* W06 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h3 className="text-xl font-bold text-gray-900">W06（2月9日-2月15日）</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">M2进行中</span>
            </div>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-700 font-medium mb-2">三大主要模块数据优化</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-2">上线模块：</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• M2验证模块-1（部队编组系统）</li>
                    <li>• M2验证模块-2（用户注册系统）</li>
                    <li>• M2验证模块-3（战役地图展示）</li>
                    <li>• 用户管理模块</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-semibold text-blue-900 mb-2">数据统计：</p>
                <div className="grid grid-cols-2 gap-2 text-blue-800">
                  <div>• 技能数据: 64个</div>
                  <div>• 羁绊数据: 21个</div>
                  <div>• 生涯数据: 1260条</div>
                  <div>• 将领字号: 180个（100%）</div>
                  <div>• 将领性格: 180个（100%）</div>
                </div>
              </div>
            </div>
          </div>

          {/* W07 当前周 */}
          <div className="border-l-4 border-purple-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔄</span>
              <h3 className="text-xl font-bold text-gray-900">W07（2月16日-2月22日）</h3>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">进行中</span>
            </div>
            
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-700 font-medium mb-2">开始制作美术资源</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold text-gray-800 mb-2">主要工作：</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 基础模型: SD1.5 → SDXL1.0</li>
                    <li>• 美术模型: TastyRice → GuFengXL</li>
                    <li>• 部队系统数值更新和卡面更换</li>
                    <li>• 资源及文档规范化</li>
                    <li>• 上线项目追踪周报</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-semibold text-blue-900 mb-2">数据统计：</p>
                <div className="grid grid-cols-2 gap-2 text-blue-800">
                  <div>• 整合文档: 13个 → 3个主文档</div>
                  <div>• 删除独立文档: 10个</div>
                  <div>• 新增美术工具: 5个</div>
                  <div>• 文档目录层级: 6个</div>
                </div>
              </div>
            </div>
          </div>

          {/* W08 下周计划 */}
          <div className="border-l-4 border-yellow-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📅</span>
              <h3 className="text-xl font-bold text-gray-900">W08（2月23日-3月1日）</h3>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">计划中</span>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="font-semibold text-yellow-900 mb-2">计划工作：</p>
                <ul className="space-y-1 text-yellow-800">
                  <li>• 战斗地图系统开发</li>
                  <li>• AI随机地图生成算法</li>
                  <li>• 地形系统实现</li>
                  <li>• 战斗界面原型设计</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 总体进度 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
            <h4 className="font-bold text-gray-900 mb-3">📈 总体进度</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-xs text-gray-600">M1 核心原型</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">60%</div>
                <div className="text-xs text-gray-600">M2 战斗系统</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">53%</div>
                <div className="text-xs text-gray-600">总体进度</div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="bg-gray-50 p-4 rounded-b-lg text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeeklyReportModal;
