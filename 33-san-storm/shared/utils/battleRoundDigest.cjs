/**
 * 回合摘要战报（须与 battleRoundDigest.js 同步）
 *
 * 将逐次攻击流水压缩为每回合固定栏：战损 / 凶锋·折锐 / 气运 / 击破 / 要事。
 * 供客户端棋盘结算入库，以及服务端 runPvpTacticalDuel 等权威推演写 battle_log。
 */

const DEFAULT_LABELS = { a: '我方', b: '敌方' };

function emptyRound(roundNum) {
  return {
    roundNum,
    lossA: 0,
    lossB: 0,
    /** @type {Map<string, number>} */
    dmgDealtA: new Map(),
    dmgDealtB: new Map(),
    /** @type {Map<string, number>} */
    lossTakenA: new Map(),
    lossTakenB: new Map(),
    critA: 0,
    critB: 0,
    dodgeA: 0,
    dodgeB: 0,
    /** @type {{ killer: string, victim: string, killerCamp: 'a'|'b' }[]} */
    kills: [],
    /** @type {string[]} */
    skills: [],
  };
}

function topName(map) {
  let bestName = '';
  let bestVal = 0;
  for (const [name, val] of map) {
    if (val > bestVal) {
      bestVal = val;
      bestName = name;
    }
  }
  return bestVal > 0 ? { name: bestName, value: bestVal } : null;
}

function addToMap(map, name, amount) {
  if (!name || !(amount > 0)) return;
  map.set(name, (map.get(name) || 0) + amount);
}

function unitName(unit) {
  if (!unit) return '无名';
  return unit.character?.courtesyName || unit.character?.name || unit.name || '无名';
}

/**
 * @param {object} [options]
 * @param {{ a?: string, b?: string }} [options.labels] 两侧称谓（客户端默认我方/敌方；PVP 可用攻方/守军）
 * @param {(arr: string[]) => string} [options.pick] 可选随机（PVP 可注入 seeded）
 */
function createBattleRoundDigest(options = {}) {
  const labels = {
    a: options.labels?.a || DEFAULT_LABELS.a,
    b: options.labels?.b || DEFAULT_LABELS.b,
  };
  const pick =
    typeof options.pick === 'function'
      ? options.pick
      : (arr) => arr[Math.floor(Math.random() * arr.length)];

  let current = null;
  /** @type {string[]} */
  const lines = [];

  function campOf(unit) {
    if (unit?.side === 'a' || unit?.side === 'b') return unit.side;
    if (unit?.faction === 'enemy') return 'b';
    return 'a';
  }

  function reset() {
    current = null;
    lines.length = 0;
  }

  function beginRound(roundNum) {
    const n = Math.max(1, Math.floor(Number(roundNum) || 1));
    if (current && current.roundNum !== n) {
      flushRound();
    }
    if (!current || current.roundNum !== n) {
      current = emptyRound(n);
    }
  }

  function ensureCurrent(roundNum) {
    if (!current) beginRound(roundNum || 1);
  }

  /**
   * 命中伤害（含暴击）。casualties 为兵力损失。
   * @param {{ attacker: object, defender: object, casualties: number, crit?: boolean, roundNum?: number }} p
   */
  function recordDamage(p) {
    const casualties = Math.max(0, Math.floor(Number(p?.casualties) || 0));
    if (!p?.defender || casualties <= 0) return;
    ensureCurrent(p.roundNum);
    const atkCamp = p.attacker ? campOf(p.attacker) : null;
    const defCamp = campOf(p.defender);
    const atkName = p.attacker ? unitName(p.attacker) : '';
    const defName = unitName(p.defender);

    if (defCamp === 'a') {
      current.lossA += casualties;
      addToMap(current.lossTakenA, defName, casualties);
    } else {
      current.lossB += casualties;
      addToMap(current.lossTakenB, defName, casualties);
    }
    if (atkCamp === 'a') addToMap(current.dmgDealtA, atkName, casualties);
    else if (atkCamp === 'b') addToMap(current.dmgDealtB, atkName, casualties);

    if (p.crit) {
      if (atkCamp === 'a') current.critA += 1;
      else if (atkCamp === 'b') current.critB += 1;
    }

    if (p.defender.currentTroops != null && Number(p.defender.currentTroops) <= 0 && p.attacker) {
      recordKill({ killer: p.attacker, victim: p.defender, roundNum: p.roundNum });
    }
  }

  /**
   * 环境/陷阱等无攻方伤害：只计入战损与折锐。
   * @param {{ defender: object, casualties: number, roundNum?: number }} p
   */
  function recordEnvironmentalLoss(p) {
    recordDamage({ attacker: null, defender: p.defender, casualties: p.casualties, roundNum: p.roundNum });
  }

  /**
   * 闪避：计入受击方气运（闪避者）。
   * @param {{ attacker?: object, defender: object, roundNum?: number }} p
   */
  function recordDodge(p) {
    if (!p?.defender) return;
    ensureCurrent(p.roundNum);
    const defCamp = campOf(p.defender);
    if (defCamp === 'a') current.dodgeA += 1;
    else current.dodgeB += 1;
  }

  /**
   * @param {{ killer: object, victim: object, roundNum?: number }} p
   */
  function recordKill(p) {
    if (!p?.killer || !p?.victim) return;
    ensureCurrent(p.roundNum);
    const killerCamp = campOf(p.killer);
    const killer = unitName(p.killer);
    const victim = unitName(p.victim);
    const dup = current.kills.some((k) => k.killer === killer && k.victim === victim);
    if (dup) return;
    current.kills.push({ killer, victim, killerCamp });
  }

  /**
   * 技能要事（每回合最多 2 条）。
   * @param {{ actor: object, skillName: string, roundNum?: number }} p
   */
  function recordSkill(p) {
    const skillName = String(p?.skillName || '').trim();
    if (!p?.actor || !skillName) return;
    ensureCurrent(p.roundNum);
    if (current.skills.length >= 2) return;
    const line = `${unitName(p.actor)}施【${skillName}】`;
    if (current.skills.includes(line)) return;
    current.skills.push(line);
  }

  function pushOpening(text) {
    const t = String(text || '').trim();
    if (t) lines.push(t);
  }

  function pushEnding(text) {
    const t = String(text || '').trim();
    if (t) lines.push(t);
  }

  /**
   * @param {{ aliveA?: number, aliveB?: number, roundNum?: number }} [meta]
   */
  function flushRound(meta = {}) {
    if (!current) return;
    if (meta.roundNum != null) current.roundNum = Math.max(1, Math.floor(Number(meta.roundNum) || current.roundNum));
    const aliveA = meta.aliveA != null ? meta.aliveA : null;
    const aliveB = meta.aliveB != null ? meta.aliveB : null;
    const block = formatRoundBlock(current, labels, { aliveA, aliveB, pick });
    for (const line of block) lines.push(line);
    current = null;
  }

  function buildText() {
    if (current) flushRound();
    return lines.join('\n');
  }

  function hasContent() {
    return lines.length > 0 || current != null;
  }

  return {
    reset,
    beginRound,
    recordDamage,
    recordEnvironmentalLoss,
    recordDodge,
    recordKill,
    recordSkill,
    pushOpening,
    pushEnding,
    flushRound,
    buildText,
    hasContent,
    labels,
  };
}

/**
 * @param {ReturnType<typeof emptyRound>} round
 * @param {{ a: string, b: string }} labels
 * @param {{ aliveA: number|null, aliveB: number|null, pick: Function }} meta
 */
function formatRoundBlock(round, labels, meta) {
  const out = [`═══ 第 ${round.roundNum} 回合 ═══`];
  const quiet =
    round.lossA === 0 &&
    round.lossB === 0 &&
    round.critA === 0 &&
    round.critB === 0 &&
    round.dodgeA === 0 &&
    round.dodgeB === 0 &&
    round.kills.length === 0 &&
    round.skills.length === 0;

  if (quiet) {
    out.push('本回合未见交锋');
    if (meta.aliveA != null && meta.aliveB != null) {
      out.push(`余势：${labels.a} ${meta.aliveA} 支｜${labels.b} ${meta.aliveB} 支`);
    }
    return out;
  }

  let lossLine = `战损：${labels.a} −${round.lossA}｜${labels.b} −${round.lossB}`;
  if (meta.aliveA != null && meta.aliveB != null) {
    lossLine += `（余 ${meta.aliveA} 对 ${meta.aliveB}）`;
  }
  out.push(lossLine);

  const topDmgA = topName(round.dmgDealtA);
  const topDmgB = topName(round.dmgDealtB);
  if (topDmgA || topDmgB) {
    const parts = [];
    if (topDmgA) parts.push(`${topDmgA.name}伤敌 ${topDmgA.value}`);
    if (topDmgB) parts.push(`${topDmgB.name}伤我 ${topDmgB.value}`);
    // PVP 中性称谓：不用「伤我」，改「伤对方」
    if (labels.a !== '我方' || labels.b !== '敌方') {
      parts.length = 0;
      if (topDmgA) parts.push(`${labels.a}·${topDmgA.name}创 ${topDmgA.value}`);
      if (topDmgB) parts.push(`${labels.b}·${topDmgB.name}创 ${topDmgB.value}`);
    }
    out.push(`凶锋：${parts.join('｜')}`);
  }

  const topLossA = topName(round.lossTakenA);
  const topLossB = topName(round.lossTakenB);
  if (topLossA || topLossB) {
    const parts = [];
    if (topLossA) parts.push(`${topLossA.name}损 ${topLossA.value}`);
    if (topLossB) parts.push(`${topLossB.name}损 ${topLossB.value}`);
    out.push(`折锐：${parts.join('｜')}`);
  }

  if (round.critA + round.critB + round.dodgeA + round.dodgeB > 0) {
    const mood =
      round.critA + round.critB > round.dodgeA + round.dodgeB
        ? meta.pick(['锋芒毕露', '气运亨通', '雷霆叠至', '天命助阵'])
        : meta.pick(['身法飘忽', '避锋有术', '灵机屡现', '危中得机']);
    out.push(
      `气运：${labels.a}暴击 ${round.critA} · 闪避 ${round.dodgeA}｜${labels.b}暴击 ${round.critB} · 闪避 ${round.dodgeB}（${mood}）`,
    );
  }

  if (round.kills.length > 0) {
    const killText = round.kills.map((k) => `${k.killer}破${k.victim}`).join('；');
    out.push(`击破：${killText}`);
  }

  if (round.skills.length > 0) {
    out.push(`要事：${round.skills.join('；')}`);
  }

  return out;
}

module.exports = { createBattleRoundDigest };
