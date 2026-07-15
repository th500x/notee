/**
 * AI 君主「主动决策」意图 → 口谕文言模板（M2）。
 *
 * 与后端 `aiKingActiveDecisionService.decide` 返回的 `intentType` / `ok` 配套；
 * 由 `KingEdictPanel` 在切槽时拉到「最近主动决策」后选用一句覆盖闲聊池。
 *
 * 设计：
 *   - 仅「战事意图」（PVP/PVE）有专属文案；政策意图（M2 仅日志）与零权重场景仍走闲聊池。
 *   - 「ok=true」= 真发动战事；PVP / PVE 文言分轨；带可选 `{target}` 占位符（目标城名）。
 *   - 「ok=false」= 抽到战事意图但因候选空集 / 写库失败 / dryRun 等未发动；不挂目标。
 *   - 不按 `speechStyle` 分桶（M2 三家君主各 1 句即可视别）；
 *     若后续要按暴君 / 仁君不同口吻分写，可改为 `WAR_LINES_BY_STYLE` 嵌套结构。
 *
 * 若需扩展为静态 JSON（按 `speechStyle` × `outcome` 多句模板），迁到
 * `kingSpeechCasualChat.zh.json` 旁边新增 `kingActiveDecisionLines.zh.json` 即可。
 */

/**
 * @param {string|null} cityName
 * @returns {string} 「（剑指 XX）」或空串
 */
function targetSuffix(cityName) {
  if (!cityName) return '';
  return `（剑指${cityName}）`;
}

/**
 * 主动决策 → 口谕台词。
 *
 * @param {object} decision - 后端 `getRecentDecision` 返回值
 * @returns {string|null} 命中战事意图时返回台词；其它意图返回 null（前端回闲聊）
 */
export function buildKingActiveDecisionLine(decision) {
  if (!decision) return null;
  const { intentType, ok, target } = decision;
  const isWarIntent =
    intentType === 'active_war_intent_pvp' || intentType === 'active_war_intent_pve';
  if (!isWarIntent) return null;

  const cityName = target?.cityName || null;
  if (ok) {
    if (intentType === 'active_war_intent_pve') {
      const label = cityName || '中立城';
      return `已命对中立城「${label}」开启攻城战线（PVE），各部可赴图参战。`;
    }
    return `现在正是扩张疆土之时，向敌对势力发起势力战事（PVP）！${targetSuffix(cityName)}`;
  }
  return '正在考虑发动一场战事，但是暂时时机未到。';
}

export default buildKingActiveDecisionLine;
