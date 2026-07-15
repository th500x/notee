/**
 * AI 君主每日传书：闲聊句 + 局势看法/期望组装
 * 文案：`public/data/shared/king-speech-casual-chat.zh.json`
 *        `public/data/shared/king-situation-outlook.zh.json`
 */

const fs = require('fs');
const path = require('path');
const aiKingConfigService = require('./aiKingConfigService');
const factionOverviewService = require('./factionOverviewService');
const warConcurrencyService = require('./warConcurrencyService');
const { computeSaturatedPersonality } = require('../utils/aiKingPersonalityEff');

const CASUAL_PATH = path.join(__dirname, '../../public/data/shared/king-speech-casual-chat.zh.json');
const OUTLOOK_PATH = path.join(__dirname, '../../public/data/shared/king-situation-outlook.zh.json');

const SPEECH_STYLES = new Set(['overlord', 'benevolent', 'moderate', 'decadent', 'tyrant']);

let casualRaw = null;
let outlookRaw = null;

function getCasualPool() {
  if (!casualRaw) {
    casualRaw = JSON.parse(fs.readFileSync(CASUAL_PATH, 'utf8'));
  }
  return casualRaw;
}

function getOutlookPool() {
  if (!outlookRaw) {
    outlookRaw = JSON.parse(fs.readFileSync(OUTLOOK_PATH, 'utf8'));
  }
  return outlookRaw;
}

function hashString(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFromPool(pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const idx = hashString(seed) % pool.length;
  return pool[idx];
}

function normalizeSpeechStyle(raw) {
  const s = String(raw || '').trim();
  return SPEECH_STYLES.has(s) ? s : 'benevolent';
}

/**
 * @param {object} snap
 * @returns {'at_war'|'peaceful_expand'|'peaceful_guard'|'saturated'|'weak_recover'}
 */
function classifySituationTag(snap) {
  const warLoad = Number(snap.warLoad) || 0;
  const cityCount = Number(snap.cityCount) || 0;
  const aggressionEff = Number(snap.aggressionEff) || 0;
  const evolutionEff = Number(snap.evolutionEff) || 0;
  const saturated = snap.saturated === true;
  const tier = String(snap.supplyTier || '').toUpperCase();

  if (warLoad > 0) return 'at_war';
  if (saturated) return 'saturated';
  if (cityCount < 3 || tier === '' || tier === 'D') return 'weak_recover';
  if (aggressionEff >= 0.55 || evolutionEff >= 0.55) return 'peaceful_expand';
  return 'peaceful_guard';
}

function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] == null) return '';
    return String(vars[key]);
  });
}

/**
 * @param {string} factionId
 * @param {object} [king]
 */
async function buildSituationSnapshot(factionId, king) {
  const fid = String(factionId || '').trim();
  const k = king || aiKingConfigService.getKingByFactionId(fid);
  if (!k) {
    return {
      factionId: fid,
      cityCount: 0,
      supplyTier: null,
      warLoad: 0,
      atCap: false,
      aggressionEff: 0,
      evolutionEff: 0,
      saturated: false,
      speechStyle: 'benevolent',
      situationTag: 'weak_recover',
    };
  }

  const overview = await factionOverviewService.getFactionOverviewByFactionId(fid);
  const cityCount = Number(overview?.data?.cityCount) || 0;
  const supplyTier = overview?.data?.supplyTier ?? null;
  const warLoadInfo = await warConcurrencyService.getAttackerFactionWarLoad(fid);
  const eff = computeSaturatedPersonality(k, cityCount);

  const snap = {
    factionId: fid,
    cityCount,
    supplyTier,
    warLoad: Number(warLoadInfo.total) || 0,
    atCap: warLoadInfo.atCap === true,
    aggressionEff: eff.aggressionEff,
    evolutionEff: eff.evolutionEff,
    saturated: eff.saturated,
    speechStyle: normalizeSpeechStyle(k.speechStyle),
  };
  snap.situationTag = classifySituationTag(snap);
  return snap;
}

/**
 * @param {object} snap
 * @param {string} ymd
 * @param {string} [extraSeed]
 */
function buildSituationParagraph(snap, ymd, extraSeed = '') {
  const style = normalizeSpeechStyle(snap.speechStyle);
  const tag = snap.situationTag || 'peaceful_guard';
  const pool = getOutlookPool();
  const outlookArr = pool?.outlook?.[style]?.[tag] || pool?.outlook?.benevolent?.[tag] || [];
  const expectArr = pool?.expectation?.[style]?.[tag] || pool?.expectation?.benevolent?.[tag] || [];

  const vars = {
    cityCount: snap.cityCount,
    supplyTier: snap.supplyTier || '无',
    warLoad: snap.warLoad,
    aggressionEff: Number(snap.aggressionEff || 0).toFixed(2),
    evolutionEff: Number(snap.evolutionEff || 0).toFixed(2),
  };

  const outlookLine = fillTemplate(
    pickFromPool(outlookArr, `${ymd}|${snap.factionId}|outlook|${tag}|${extraSeed}`),
    vars,
  );
  const expectLine = fillTemplate(
    pickFromPool(expectArr, `${ymd}|${snap.factionId}|expect|${tag}|${extraSeed}`),
    vars,
  );

  return [outlookLine, expectLine].filter(Boolean).join('\n');
}

/**
 * @param {string} speechStyle
 * @param {string} seed
 */
function pickCasualLine(speechStyle, seed) {
  const style = normalizeSpeechStyle(speechStyle);
  const data = getCasualPool();
  const pool = data?.casualChat?.[style] || data?.casualChat?.benevolent || [];
  return pickFromPool(pool, seed) || '……';
}

/**
 * @param {{
 *   king: object,
 *   snap: object,
 *   ymd: string,
 *   playerId: string,
 * }} opts
 */
function buildDailyLetterContent(opts) {
  const { king, snap, ymd, playerId } = opts;
  const kingName = king.characterName || '君主';
  const courtesy = king.courtesyName ? `（${king.courtesyName}）` : '';
  const style = normalizeSpeechStyle(king.speechStyle || snap.speechStyle);
  const casual = pickCasualLine(style, `${ymd}|${snap.factionId}|${playerId}|${style}`);
  const situation = buildSituationParagraph(snap, ymd, playerId);

  return (
    `${kingName}${courtesy}：\n` +
    `${casual}\n\n` +
    `【局势】\n${situation}\n\n` +
    `（传书 24 小时内有效）`
  );
}

function clearCachesForTests() {
  casualRaw = null;
  outlookRaw = null;
}

module.exports = {
  buildSituationSnapshot,
  buildSituationParagraph,
  pickCasualLine,
  buildDailyLetterContent,
  classifySituationTag,
  clearCachesForTests,
  CASUAL_PATH,
  OUTLOOK_PATH,
};
