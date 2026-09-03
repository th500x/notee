/**
 * 项目周报页面（游戏子站）
 * 文案见 @/data/texts/weeklyReport
 */

import React from 'react';
import {
  weeklyReportPageTitle,
  weeklyReportPageSubtitle,
  weeklyReports,
  weeklyReportTestRewardP1,
  weeklyReportMilestones,
} from '../data/texts/weeklyReport';

const milestoneVariantClass = {
  done: 'text-lg text-green-600 font-semibold',
  progress: 'text-lg text-blue-600 font-semibold',
  tbd: 'text-lg text-gray-500',
  mvp: 'text-lg text-purple-600 font-semibold',
};

function WeeklyReportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-100 relative overflow-hidden">
      <div className="absolute top-20 right-10 w-32 h-16 bg-white rounded-full opacity-60 blur-sm" />
      <div className="absolute top-32 right-32 w-24 h-12 bg-white rounded-full opacity-50 blur-sm" />
      <div className="absolute top-40 left-20 w-28 h-14 bg-white rounded-full opacity-55 blur-sm" />
      <div className="absolute bottom-40 right-16 w-36 h-18 bg-white rounded-full opacity-50 blur-sm" />

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-purple-200/40 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
          <div className="absolute bottom-0 left-10 w-16 h-24 bg-purple-400" />
          <div className="absolute bottom-0 left-32 w-12 h-32 bg-purple-500" />
          <div className="absolute bottom-0 left-48 w-20 h-20 bg-purple-400" />
          <div className="absolute bottom-0 left-72 w-14 h-28 bg-purple-500" />
          <div className="absolute bottom-0 right-72 w-18 h-26 bg-purple-400" />
          <div className="absolute bottom-0 right-48 w-16 h-30 bg-purple-500" />
          <div className="absolute bottom-0 right-32 w-12 h-24 bg-purple-400" />
          <div className="absolute bottom-0 right-10 w-20 h-28 bg-purple-500" />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12 relative">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg shadow-2xl p-8 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
            <h1 className="text-5xl font-bold text-white text-center drop-shadow-lg">
              {weeklyReportPageTitle}
            </h1>
            <p className="text-white/90 text-center mt-2 text-lg">{weeklyReportPageSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {weeklyReports.map((report, index) => (
            <div
              key={`${report.week}-${index}`}
              className={`
                bg-white/90 backdrop-blur-sm rounded-2xl p-6
                border-4 ${report.borderColor}
                shadow-xl hover:shadow-2xl
                transform hover:-translate-y-2 transition-all duration-300
                relative overflow-hidden
              `}
              style={{
                animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
              }}
            >
              <div
                className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${report.color} opacity-10 rounded-bl-full`}
              />
              <div
                className={`inline-block bg-gradient-to-r ${report.color} text-white px-4 py-2 rounded-lg mb-2 font-bold text-lg shadow-md`}
              >
                {report.week}
              </div>
              <div className="text-gray-500 text-sm mb-4">{report.date}</div>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line text-sm relative z-10">
                {report.content}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg border-2 border-yellow-300">
            <div className="space-y-2 text-left">
              <p className="text-xl font-bold text-orange-600">{weeklyReportTestRewardP1.title}</p>
              <p className="text-base text-gray-700 font-semibold mt-3">{weeklyReportTestRewardP1.conditionsHeading}</p>
              {weeklyReportTestRewardP1.conditions.map((line) => (
                <p key={line} className="text-base text-gray-600 ml-4">
                  {line}
                </p>
              ))}
              {weeklyReportTestRewardP1.poolNote ? (
                <p className="text-sm text-gray-500 italic mt-3 ml-4">{weeklyReportTestRewardP1.poolNote}</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg">
            <div className="space-y-2 text-left">
              <p className="text-xl font-bold text-gray-800">{weeklyReportMilestones.title}</p>
              {weeklyReportMilestones.rows.map((row) => (
                <p key={row.text} className={milestoneVariantClass[row.variant] || 'text-lg text-gray-600'}>
                  {row.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

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
