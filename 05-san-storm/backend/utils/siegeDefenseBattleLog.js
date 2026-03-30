/**
 * 守城视角战报文案（与攻城方战报数值同源，仅叙述视角不同）
 * 解析对象：siegePvpSkirmish 产出的 battleLog 行
 */

function labelsFromSiegeNpcs(npcs) {
  const set = new Set();
  for (const u of npcs || []) {
    if (u.troopName) set.add(String(u.troopName).trim());
    if (u.character?.name) set.add(String(u.character.name).trim());
    if (u.character?.courtesyName) set.add(String(u.character.courtesyName).trim());
  }
  return set;
}

function sideOfName(name, attSet, defSet) {
  const n = String(name).trim();
  if (attSet.has(n)) return 'att';
  if (defSet.has(n)) return 'def';
  for (const x of attSet) {
    if (n.includes(x) || x.includes(n)) return 'att';
  }
  for (const x of defSet) {
    if (n.includes(x) || x.includes(n)) return 'def';
  }
  return null;
}

/** 战术回合标题行（与棋盘战报 fmtRoundStart 一致） */
const ROUND_HDR_RE = /^═══\s*第\s*(\d+)\s*回合\s*══=$/;

/**
 * 单行：攻城推演日志 → 守城主公可读文案
 * @param {number | null} tacticalRound 当前战术回合（由「═══ 第 T 回合 ═══」累进）
 */
function formatSkirmishLineForDefender(line, attSet, defSet, tacticalRound = null) {
  if (/^═══\s*第\s*\d+\s*回合\s*══=$/.test(line.trim())) {
    return line;
  }
  if (/攻城方全军覆没|交战前攻城方已无兵/.test(line)) {
    return line
      .replace(/攻城方全军覆没/, '攻城方全军覆没（守城方胜利）')
      .replace(/交战前攻城方已无兵/, '交战前攻城方已无兵（守城方胜利）');
  }
  if (/守军全灭|交战前守军已无兵/.test(line)) {
    return line
      .replace(/守军全灭/, '守军全灭（城池失守风险）')
      .replace(/交战前守军已无兵/, '交战前守军已无兵（城池失守风险）');
  }
  if (/达到战术回合上限|达到回合上限/.test(line)) {
    return `（守城）${line}`;
  }

  const trLabel = tacticalRound != null ? `第${tacticalRound}战术回合·` : '';

  const dmgNew = line.match(
    /^第\s*(\d+)\s*次攻击[：:]\s*(.+?) 对 (.+?) 造成 (\d+) 损失（([^）]+)）。$/
  );
  if (dmgNew) {
    const [, k, a, b, loss, tag] = dmgNew;
    const sa = sideOfName(a, attSet, defSet);
    const sb = sideOfName(b, attSet, defSet);
    if (sa === 'att' && sb === 'def') {
      return `（守城）${trLabel}第${k}次攻击：守军「${b.trim()}」遭「${a.trim()}」攻击，损失 ${loss}（${tag}）。`;
    }
    if (sa === 'def' && sb === 'att') {
      return `（守城）${trLabel}第${k}次攻击：我军「${a.trim()}」反击「${b.trim()}」，对敌造成 ${loss}（${tag}）。`;
    }
    return `（守城）${trLabel}${line}`;
  }
  const dodgeNew = line.match(/^第\s*(\d+)\s*次攻击[：:]\s*(.+?) 攻击被闪避。$/);
  if (dodgeNew) {
    const [, k, a] = dodgeNew;
    const sa = sideOfName(a, attSet, defSet);
    if (sa === 'att') {
      return `（守城）${trLabel}第${k}次攻击：我军闪避了「${a.trim()}」的攻击。`;
    }
    return `（守城）${trLabel}第${k}次攻击：攻城方闪避了我军「${a.trim()}」的攻击。`;
  }

  return line;
}

/**
 * 披挂 PVP 权威结算：防守方 battle_log 全文
 */
function buildDefenderSiegePvpBattleLog({
  battleLogLines,
  attackerNpcs,
  defenderNpcs,
  attackerPlayerName,
  defenderPlayerName,
  cityName,
}) {
  const attSet = labelsFromSiegeNpcs(attackerNpcs);
  const defSet = labelsFromSiegeNpcs(defenderNpcs);
  const header = [
    `【守城战报】${cityName || '城池'}`,
    `守方主公：${defenderPlayerName}`,
    `来犯：${attackerPlayerName}`,
    '────────',
    '（与同场攻城战报为同一战斗；以下为守城视角叙述）',
    '',
  ].join('\n');
  let tacticalRound = null;
  const body = (battleLogLines || [])
    .map((line) => {
      const m = String(line).trim().match(ROUND_HDR_RE);
      if (m) {
        tacticalRound = parseInt(m[1], 10);
        return formatSkirmishLineForDefender(line, attSet, defSet, tacticalRound);
      }
      return formatSkirmishLineForDefender(line, attSet, defSet, tacticalRound);
    })
    .join('\n');
  return `${header}${body}`;
}

module.exports = {
  buildDefenderSiegePvpBattleLog,
  formatSkirmishLineForDefender,
  labelsFromSiegeNpcs,
};
