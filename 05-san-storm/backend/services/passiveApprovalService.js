/**
 * AI 君主被动提案审批（M2）
 *
 * 范围：高阶官职玩家提交「战事」或「势力政策」类提案 → 君主同意 / 驳回。
 *
 * 公式（与 41-AI_KING_SYSTEM.md「M2 · 被动提案审批」一致）：
 *   1. base = personality.aggression（战事类）或 personality.evolution（势力政策类）
 *      —— 这两个键是「君主性格」维度（侵略 / 发展），不是行为类型；
 *      proposalType 'war' / 'policy' 通过 PROPOSAL_TYPE_TO_PERSONALITY_KEY 映射到对应性格键。
 *      若调用方传入 `cityCount`，则改用饱和调制后的 *_eff（与主动决策同一入口，
 *      见 `utils/aiKingPersonalityEff.computeSaturatedPersonality`）。
 *   2. 独立掷六面骰 → 1～4=×1.0 / 5=×1.1 / 6=×1.2
 *   3. finalApproveChance = clamp(base × mult, 0, 1)
 *   4. u ~ U(0,1)；u < finalApproveChance ⇒ approved
 *
 * 不接：事件难度、关卡修正、luck/courage 等其他玩法系数。每条提案独立掷骰与抽检。
 *
 * @module services/passiveApprovalService
 */

const aiKingConfigService = require('./aiKingConfigService');
const {
  computeSaturatedPersonality,
  pickEffByProposalType,
} = require('../utils/aiKingPersonalityEff');

/** 战事类提案：消费 personality.aggression（性格 · 侵略） */
const PROPOSAL_TYPE_WAR = 'war';
/** 势力政策类提案：消费 personality.evolution（性格 · 发展） */
const PROPOSAL_TYPE_POLICY = 'policy';

/** proposalType → personality 性格键 的显式映射（避免散写 if/else） */
const PROPOSAL_TYPE_TO_PERSONALITY_KEY = {
  [PROPOSAL_TYPE_WAR]: 'aggression',
  [PROPOSAL_TYPE_POLICY]: 'evolution',
};

/**
 * 六面骰 → 倍率三档（与产品规则锁定）。
 * 与「事件骰子 + 倍率」共用同一档位映射；勿在外部再写一份。
 */
function rollDice6Multiplier(rng = Math.random) {
  const dice = Math.floor(rng() * 6) + 1;
  let mult = 1.0;
  if (dice === 6) mult = 1.2;
  else if (dice === 5) mult = 1.1;
  return { dice, mult };
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * 取 base：
 *   - 未传 cityCount（默认）：直接读 `personality.aggression / evolution`（M1 行为，不破坏既有调用）。
 *   - 传入 cityCount：走饱和调制 `*_eff`（与主动决策同一入口；满足 41-1 §「野心」要求）。
 *
 * 性格键由 PROPOSAL_TYPE_TO_PERSONALITY_KEY 映射，避免散写 if/else 也避免把性格语义和提案类型混淆。
 *
 * @param {object} king - 君主对象（含 personality 与可选 ambitionThreshold）
 * @param {'war'|'policy'} proposalType
 * @param {number|null} [cityCount] - 传入时启用饱和调制；不传 / null 则用原值
 */
function pickBaseFromKing(king, proposalType, cityCount = null) {
  const personalityKey = PROPOSAL_TYPE_TO_PERSONALITY_KEY[proposalType];
  if (!personalityKey) {
    throw new Error(`[passiveApproval] 未知 proposalType: ${proposalType}`);
  }
  if (cityCount == null) {
    return Number(king?.personality?.[personalityKey]) || 0;
  }
  const eff = computeSaturatedPersonality(king, cityCount);
  return pickEffByProposalType(eff, proposalType);
}

/**
 * 给客户端「大致通过率」预览：[base, min(1, base × 1.2)]。
 * 文案需提示当次仍先掷骰再抽检（非保证）。
 *
 * @param {{ factionId: string, proposalType: 'war'|'policy', cityCount?: number|null }} input
 * @returns {{ factionId: string, proposalType: string, base: number, minRate: number, maxRate: number, saturated?: boolean }}
 */
function previewApprovalRange({ factionId, proposalType, cityCount = null }) {
  const king = aiKingConfigService.getKingByFactionId(factionId);
  const base = pickBaseFromKing(king, proposalType, cityCount);
  const baseClamped = clamp01(base);
  const saturated =
    cityCount != null
      ? computeSaturatedPersonality(king, cityCount).saturated
      : undefined;
  return {
    factionId,
    proposalType,
    base: baseClamped,
    minRate: baseClamped,
    maxRate: clamp01(base * 1.2),
    ...(saturated !== undefined ? { saturated } : {}),
    note: '实际当次仍先掷骰（×1.0/×1.1/×1.2）再抽检；本范围仅作大致预览，不保证当次必过。',
  };
}

/**
 * 同步执行一次审批：仅做规则计算，不写库；调用方负责把审计字段持久化或落日志。
 *
 * @param {object} input
 * @param {string} input.factionId
 * @param {'war'|'policy'} input.proposalType
 * @param {string} [input.proposalId] - 用于审计追踪
 * @param {number|null} [input.cityCount] - 当前势力占有城数；传入则启用饱和调制（*_eff）
 * @param {() => number} [input.rng] - 注入随机源（测试可固定）；默认 Math.random
 * @returns {{
 *   approved: boolean,
 *   factionId: string,
 *   proposalType: string,
 *   proposalId: string | null,
 *   base: number,
 *   dice: number,
 *   mult: number,
 *   finalApproveChance: number,
 *   u: number,
 *   king: { characterId: string, characterName: string },
 *   saturated?: boolean,
 *   timestamp: string,
 * }}
 */
function resolvePassiveApproval({
  factionId,
  proposalType,
  proposalId = null,
  cityCount = null,
  rng = Math.random,
}) {
  const king = aiKingConfigService.getKingByFactionId(factionId);
  const base = pickBaseFromKing(king, proposalType, cityCount);
  const { dice, mult } = rollDice6Multiplier(rng);
  const finalApproveChance = clamp01(base * mult);
  const u = rng();
  const approved = u < finalApproveChance;
  const saturated =
    cityCount != null ? computeSaturatedPersonality(king, cityCount).saturated : undefined;

  const audit = {
    approved,
    factionId,
    proposalType,
    proposalId,
    base: clamp01(base),
    dice,
    mult,
    finalApproveChance,
    u,
    king: { characterId: king.characterId, characterName: king.characterName },
    ...(saturated !== undefined ? { saturated } : {}),
    timestamp: new Date().toISOString(),
  };

  // M2：仅 console 审计；后续可挂到日志表 / Sentry / OpenTelemetry。
  console.log(
    '[passiveApproval]',
    JSON.stringify({
      approved,
      factionId,
      proposalType,
      proposalId,
      base: audit.base,
      dice,
      mult,
      finalApproveChance: Number(finalApproveChance.toFixed(4)),
      u: Number(u.toFixed(4)),
      king: king.characterName,
      ...(saturated !== undefined ? { saturated } : {}),
    }),
  );

  return audit;
}

module.exports = {
  resolvePassiveApproval,
  previewApprovalRange,
  rollDice6Multiplier,
  clamp01,
  PROPOSAL_TYPE_WAR,
  PROPOSAL_TYPE_POLICY,
};
