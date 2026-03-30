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

/**
 * 单行：攻城推演日志 → 守城主公可读文案
 */
function formatSkirmishLineForDefender(line, attSet, defSet) {
  if (/攻城方全军覆没/.test(line)) {
    return line.replace(/攻城方全军覆没/, '攻城方全军覆没（守城方胜利）');
  }
  if (/守军全灭/.test(line)) {
    return line.replace(/守军全灭/, '守军全灭（城池失守风险）');
  }
  if (/达到回合上限/.test(line)) {
    return `（守城）${line}`;
  }
  const dmg = line.match(
    /^第(\d+)回合：(.+?) 对 (.+?) 造成 (\d+) 损失（([^）]+)）。$/
  );
  if (dmg) {
    const [, round, a, b, loss, tag] = dmg;
    const sa = sideOfName(a, attSet, defSet);
    const sb = sideOfName(b, attSet, defSet);
    if (sa === 'att' && sb === 'def') {
      return `第${round}回合（守城）：守军「${b.trim()}」遭攻城部队「${a.trim()}」攻击，损失 ${loss}（${tag}）。`;
    }
    if (sa === 'def' && sb === 'att') {
      return `第${round}回合（守城）：守军「${a.trim()}」反击攻城部队「${b.trim()}」，对敌造成 ${loss} 兵力损失（${tag}）。`;
    }
  }
  const dodge = line.match(/^第(\d+)回合：(.+?) 攻击被闪避。$/);
  if (dodge) {
    const [, round, a] = dodge;
    const sa = sideOfName(a, attSet, defSet);
    if (sa === 'att') {
      return `第${round}回合（守城）：守军闪避了攻城部队「${a.trim()}」的攻击。`;
    }
    return `第${round}回合（守城）：攻城方闪避了我军「${a.trim()}」的攻击。`;
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
  const body = (battleLogLines || []).map((line) => formatSkirmishLineForDefender(line, attSet, defSet)).join('\n');
  return `${header}${body}`;
}

module.exports = {
  buildDefenderSiegePvpBattleLog,
  formatSkirmishLineForDefender,
  labelsFromSiegeNpcs,
};
