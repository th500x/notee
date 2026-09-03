/**
 * 攻城 NPC 线：按被击杀单位稀有度的银两 / 贡献（与 cityService、smallMapBattleLootService 同源）。
 *
 * 三公府「朝贡」：固定贡献表（无玩家银两；势力储备不随朝贡入账银粮）。
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

/** 三公府朝贡：每张销毁部队卡固定贡献（13-1 §11.1） */
const TRIBUTE_CONTRIBUTION_REWARD = {
  common: 5,
  rare: 15,
  epic: 25,
  legendary: 35,
  core: 50,
};

function normalizeSiegeRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'core' || x === 'legendary' || x === 'epic' || x === 'rare' || x === 'common') return x;
  return 'common';
}

/**
 * 朝贡销毁一张部队卡时，给玩家贡献（无银两）
 * @param {string} rarity
 * @returns {{ silver: number, contribution: number }}
 */
function tributeCompensationPerTroopCard(rarity) {
  const br = normalizeSiegeRarity(rarity);
  return {
    silver: 0,
    contribution: TRIBUTE_CONTRIBUTION_REWARD[br] ?? TRIBUTE_CONTRIBUTION_REWARD.common,
  };
}

module.exports = {
  KILL_SILVER_REWARD,
  WIN_CONTRIBUTION_REWARD_SIEGE_NPC,
  TRIBUTE_CONTRIBUTION_REWARD,
  normalizeSiegeRarity,
  tributeCompensationPerTroopCard,
};
