/**
 * 卡牌组件统一导出
 *
 * @module shared/components/card
 *
 * 维护提醒（与 `docs/00-base/03-SHARED_COMPONENTS.md §5.1` 卡片清单同步）：
 * 新增卡组件必须**同时**：
 *   1. 在本文件按字母序追加 `export { default as XxxCard }`
 *   2. 在 `03-SHARED_COMPONENTS.md` §5.1 表格里补一行
 * 否则前后会出现"已有组件文件但 `from '@shared/components/card'` 导入失败、必须深 import"的回归。
 */

export { default as CampaignFlipCard, eraToFrontEraLine, campaignTypeToZh } from './CampaignFlipCard.jsx';
export { default as CharacterCard } from './CharacterCard.jsx';
export { default as EquipmentCard } from './EquipmentCard.jsx';
export { default as FactionCard } from './FactionCard.jsx';
export { default as LineupCardDetailPanel } from './LineupCardDetailPanel.jsx';
export { default as LineupDetailCardScale, LINEUP_DETAIL_CARD_SCALE } from './LineupDetailCardScale.jsx';
export { default as PositionCard } from './PositionCard.jsx';
export { default as TitleAchievementCard } from './TitleAchievementCard.jsx';
export { default as TroopCard } from './TroopCard.jsx';
