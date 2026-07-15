/**
 * 游戏叙述性文本统一导出
 * 
 * @description 集中管理游戏内所有与系统逻辑无关的叙述性文本
 * 包括：新手流程、事件对话、系统提示等
 * 
 * 目录结构：
 * data/texts/
 * ├── gameIntroMessages.js   # 游戏特色介绍（开局叠加层）
 * ├── san1Scenario.js        # S1 黄巾之乱剧本介绍（Wiki San1Page）
 * ├── weeklyReport.js   # 项目周报（首页卡片 + 周报页全文）
 * ├── kingSpeechCasualChat.zh.json  # AI君主闲聊文案池（五种 speechStyle × casualChat）
 * ├── buildKingSpeechCasualChat.zh.mjs  # 生成上列 JSON（需改版书时运行）
 * ├── equipmentSetNameParts.json  # 装备随机命名词缀分桶
 * └── index.js          # 统一导出
 */

export { gameIntroMessages } from './gameIntroMessages';

export { san1ScenarioPage, san1ScenarioCards } from './san1Scenario';

export {
  weeklyReportCard,
  weeklyReportPageTitle,
  weeklyReportPageSubtitle,
  weeklyReports,
  weeklyReportTestRewardP1,
  weeklyReportMilestones,
} from './weeklyReport';

export { default as kingSpeechCasualChatZh } from './kingSpeechCasualChat.zh.json';
