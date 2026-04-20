/**
 * 游戏叙述性文本统一导出
 * 
 * @description 集中管理游戏内所有与系统逻辑无关的叙述性文本
 * 包括：新手流程、事件对话、系统提示等
 * 
 * 目录结构：
 * data/texts/
 * ├── gameIntroMessages.js   # 游戏特色介绍（开局叠加层）
 * ├── tutorialDraftPlaceholders.js  # 文档/占位用叙述块
 * ├── weeklyReport.js   # 项目周报（首页卡片 + 周报页全文）
 * ├── events.js         # 事件系统对话文本
 * ├── tips.js           # 系统提示/公告文本
 * └── index.js          # 统一导出
 */

export { gameIntroMessages } from './gameIntroMessages';
export {
  event0_equipmentTutorial,
  event1_dialogue,
  event2_gobang,
  event3_battle,
  enterCity,
  lordPromotion,
  changsheCampaign,
  tutorialComplete,
  battlePassIntro,
} from './tutorialDraftPlaceholders';

export {
  weeklyReportCard,
  weeklyReportPageTitle,
  weeklyReportPageSubtitle,
  weeklyReports,
  weeklyReportTestRewardP1,
  weeklyReportMilestones,
} from './weeklyReport';
