/**
 * 守城视角战报文案（与攻城方战报数值同源，仅叙述视角不同）（原 siegeDefenseBattleLog · 17-5 §12.14）
 * 解析对象：pvpAutoDuelSim（自动对决）产出的 battleLog 行（须含 [攻方]/[守军] 标签）
 */

/** 战术回合标题行（与棋盘战报 fmtRoundStart 一致） */
const ROUND_HDR_RE = /^═══\s*第\s*(\d+)\s*回合\s*═══$/;

/**
 * 单行：带标签的推演日志 → 守城主公可读文案
 * @param {number | null} tacticalRound 当前战术回合（由「═══ 第 T 回合 ═══」累进）
 */
function formatAutoDuelLineForDefender(line, tacticalRound = null) {
  if (/^═══\s*第\s*\d+\s*回合\s*═══$/.test(line.trim())) {
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

  const dmgAtk = line.match(
    /^第\s*(\d+)\s*次攻击[：:]\s*\[攻方\](.+?) 对 \[守军\](.+?) 造成 (\d+) 损失（([^）]+)）。$/,
  );
  if (dmgAtk) {
    const [, k, a, b, loss, tag] = dmgAtk;
    return `（守城）${trLabel}第${k}次攻击：守军「${b.trim()}」遭「${a.trim()}」攻击，损失 ${loss}（${tag}）。`;
  }
  const dmgDef = line.match(
    /^第\s*(\d+)\s*次攻击[：:]\s*\[守军\](.+?) 对 \[攻方\](.+?) 造成 (\d+) 损失（([^）]+)）。$/,
  );
  if (dmgDef) {
    const [, k, a, b, loss, tag] = dmgDef;
    return `（守城）${trLabel}第${k}次攻击：我军「${a.trim()}」反击「${b.trim()}」，对敌造成 ${loss}（${tag}）。`;
  }
  const dodgeTagged = line.match(/^第\s*(\d+)\s*次攻击[：:]\s*\[(攻方|守军)\](.+?) 攻击被闪避。$/);
  if (dodgeTagged) {
    const [, k, sideLab, name] = dodgeTagged;
    if (sideLab === '攻方') {
      return `（守城）${trLabel}第${k}次攻击：我军闪避了「${String(name).trim()}」的攻击。`;
    }
    return `（守城）${trLabel}第${k}次攻击：攻城方闪避了我军「${String(name).trim()}」的攻击。`;
  }

  return line;
}

/**
 * 披挂 PVP 权威结算：防守方 battle_log 全文
 */
function buildDefenderPvpAutoDuelBattleLog({
  battleLogLines,
  attackerPlayerName,
  defenderPlayerName,
  cityName,
}) {
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
        return formatAutoDuelLineForDefender(line, tacticalRound);
      }
      return formatAutoDuelLineForDefender(line, tacticalRound);
    })
    .join('\n');
  return `${header}${body}`;
}

module.exports = {
  buildDefenderPvpAutoDuelBattleLog,
  formatAutoDuelLineForDefender,
};
