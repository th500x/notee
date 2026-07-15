/**
 * 战役展示名：`战役名（势力）`，供战役中心与排行榜下拉等复用。
 * 须与 campaignDisplayName.cjs 同步。
 */

/** san_1 可选势力展示名（单势力战役用；多势力列视为「通用」） */
const SAN_1_FACTION_DISPLAY_NAMES = Object.freeze({
  san_1_faction_1001: '刘备',
  san_1_faction_2001: '曹操',
  san_1_faction_3001: '孙坚',
  san_1_faction_4001: '袁绍',
  san_1_faction_5001: '董卓',
  san_1_faction_6001: '汉室',
  san_1_faction_7001: '黄巾',
});

const GENERAL_CAMPAIGN_FACTION_LABEL = '通用';

export function parseCampaignFactionIds(factionStr) {
  if (factionStr == null || factionStr === '') return [];
  return String(factionStr)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 由 config_campaigns.faction 解析括号内势力文案 */
export function resolveCampaignFactionDisplayLabel(factionStr) {
  const ids = parseCampaignFactionIds(factionStr);
  if (ids.length === 0) return GENERAL_CAMPAIGN_FACTION_LABEL;
  if (ids.length === 1) {
    return SAN_1_FACTION_DISPLAY_NAMES[ids[0]] || GENERAL_CAMPAIGN_FACTION_LABEL;
  }
  return GENERAL_CAMPAIGN_FACTION_LABEL;
}

/** @param {{ campaign_name?: string, campaignName?: string, campaign_id?: string, campaignId?: string, faction?: string }} campaign */
export function formatCampaignDisplayName(campaign) {
  const name = String(campaign?.campaign_name || campaign?.campaignName || '').trim();
  const base = name || String(campaign?.campaign_id || campaign?.campaignId || '战役').trim();
  const factionLabel = resolveCampaignFactionDisplayLabel(campaign?.faction);
  return `${base}（${factionLabel}）`;
}

/** 战役中心下拉：展示名 + 挑战状态括号（与 dropdown_paren_inner 并存） */
export function formatCampaignCenterSelectOptionLabel(campaign) {
  const display = formatCampaignDisplayName(campaign);
  const inner = campaign?.dropdown_paren_inner;
  if (inner) return `${display}（${inner}）`;
  return display;
}
