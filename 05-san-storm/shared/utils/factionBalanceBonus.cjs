/**
 * 创角 · 势力人数平衡补偿（纯函数，10-1 §4.1）
 * 与 `factionBalanceBonusService` / 创角 UI 共用同一公式。
 *
 * @module shared/utils/factionBalanceBonus
 */

/** 每比全服最多势力少 10 人 → +10 银两 */
const FACTION_BALANCE_BONUS_STEP = 10;

/** 平衡补偿银两上限 */
const FACTION_BALANCE_BONUS_MAX = 100;

/** 创角向导内属性 roll 初始银两（带入上限，不含平衡补偿） */
const CREATION_WIZARD_INITIAL_SILVER = 50;

/**
 * @param {number} currentPlayers 该势力当前人数
 * @param {number} maxPlayersOnServer 同服各势力人数最大值
 * @returns {number}
 */
function computeFactionBalanceBonusSilver(currentPlayers, maxPlayersOnServer) {
  const current = Math.max(0, Math.floor(Number(currentPlayers) || 0));
  const max = Math.max(0, Math.floor(Number(maxPlayersOnServer) || 0));
  const gap = Math.max(0, max - current);
  const stepped = Math.floor(gap / FACTION_BALANCE_BONUS_STEP) * FACTION_BALANCE_BONUS_STEP;
  return Math.min(FACTION_BALANCE_BONUS_MAX, stepped);
}

/**
 * 创角向导剩余银两（客户端上报）钳制到合法区间。
 * @param {number} raw
 * @returns {number}
 */
function clampCreationWizardSilver(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n < 0) return 0;
  if (n > CREATION_WIZARD_INITIAL_SILVER) return CREATION_WIZARD_INITIAL_SILVER;
  return n;
}

/**
 * 从 API / JSON 势力对象读取平衡补偿预览银两。
 * @param {object|null|undefined} faction
 * @returns {number}
 */
function readFactionBalanceBonusSilver(faction) {
  if (!faction) return 0;
  const v = faction.balance_bonus_silver ?? faction.balanceBonusSilver;
  const n = Math.floor(Number(v) || 0);
  return n > 0 ? n : 0;
}

module.exports = {
  FACTION_BALANCE_BONUS_STEP,
  FACTION_BALANCE_BONUS_MAX,
  CREATION_WIZARD_INITIAL_SILVER,
  computeFactionBalanceBonusSilver,
  clampCreationWizardSilver,
  readFactionBalanceBonusSilver,
};
