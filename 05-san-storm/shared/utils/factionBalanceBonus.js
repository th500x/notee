/**
 * ESM 镜像 · 须与 factionBalanceBonus.cjs 保持同步（03-1 §1）
 * @module shared/utils/factionBalanceBonus
 */

export const FACTION_BALANCE_BONUS_STEP = 10;
export const FACTION_BALANCE_BONUS_MAX = 100;
export const CREATION_WIZARD_INITIAL_SILVER = 50;

export function computeFactionBalanceBonusSilver(currentPlayers, maxPlayersOnServer) {
  const current = Math.max(0, Math.floor(Number(currentPlayers) || 0));
  const max = Math.max(0, Math.floor(Number(maxPlayersOnServer) || 0));
  const gap = Math.max(0, max - current);
  const stepped = Math.floor(gap / FACTION_BALANCE_BONUS_STEP) * FACTION_BALANCE_BONUS_STEP;
  return Math.min(FACTION_BALANCE_BONUS_MAX, stepped);
}

export function clampCreationWizardSilver(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n < 0) return 0;
  if (n > CREATION_WIZARD_INITIAL_SILVER) return CREATION_WIZARD_INITIAL_SILVER;
  return n;
}

export function readFactionBalanceBonusSilver(faction) {
  if (!faction) return 0;
  const v = faction.balance_bonus_silver ?? faction.balanceBonusSilver;
  const n = Math.floor(Number(v) || 0);
  return n > 0 ? n : 0;
}

/** @param {number} amount */
export function formatFactionBalanceBonusPreview(amount) {
  const n = Math.floor(Number(amount) || 0);
  if (n <= 0) return null;
  return `创角平衡 +${n} 银两`;
}
