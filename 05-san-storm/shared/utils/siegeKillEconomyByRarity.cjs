/**
 * 攻城 NPC 线：按被击杀单位稀有度的银两 / 贡献（与 cityService、smallMapBattleLootService 同源）。
 * 三公府「朝贡」按稀有度补偿 = 本表单卡基数 × TRIBUTE_REWARD_MULTIPLIER（当前 1.5）。
 *
 * 使用 .cjs 扩展名：shared 包为 "type":"module"，.js 会按 ESM 解析，后端 require 需 CommonJS。
 *
 * 前端朝贡展示（Vite 不宜直接 import 本 CJS）：须与
 * `game/src/utils/siegeKillEconomyTributeDisplay.js` 保持同步。
 */

'use strict';

/** 与 `cityService` KILL_SILVER_REWARD 一致 */
const KILL_SILVER_REWARD = {
  core: 50,
  legendary: 40,
  epic: 30,
  rare: 20,
  common: 10,
};

/** 与 `smallMapBattleLootService` WIN_CONTRIBUTION_REWARD_SIEGE_NPC 一致（每消灭一支该稀有度 NPC） */
const WIN_CONTRIBUTION_REWARD_SIEGE_NPC = {
  core: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

const TRIBUTE_REWARD_MULTIPLIER = 1.5;

function normalizeSiegeRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'core' || x === 'legendary' || x === 'epic' || x === 'rare' || x === 'common') return x;
  return 'common';
}

/**
 * 朝贡销毁一张部队卡时，给玩家银两/贡献（= 攻城按该稀有度「单杀」基数 × 1.5 取整）
 * @param {string} rarity
 * @returns {{ silver: number, contribution: number }}
 */
function tributeCompensationPerTroopCard(rarity) {
  const br = normalizeSiegeRarity(rarity);
  const baseSilver = KILL_SILVER_REWARD[br] ?? 10;
  const baseContrib = WIN_CONTRIBUTION_REWARD_SIEGE_NPC[br] ?? 1;
  return {
    silver: Math.floor(TRIBUTE_REWARD_MULTIPLIER * baseSilver),
    contribution: Math.floor(TRIBUTE_REWARD_MULTIPLIER * baseContrib),
  };
}

module.exports = {
  KILL_SILVER_REWARD,
  WIN_CONTRIBUTION_REWARD_SIEGE_NPC,
  normalizeSiegeRarity,
  tributeCompensationPerTroopCard,
  TRIBUTE_REWARD_MULTIPLIER,
};
