/**
 * 本地/测试机 PVP 攻城链冒烟（无浏览器）
 *
 * 前提：
 * - 后端已启动（默认 http://127.0.0.1:3000）
 * - DEFENDER 已驻守目标城、披挂上阵 on_duty、总兵力≥800
 * - ATTACKER 与防守方不同势力，且可攻打该城
 *
 * 用法（PowerShell 示例）：
 *   $env:API_BASE="http://127.0.0.1:3000"
 *   $env:CITY_ID="1"
 *   $env:ATTACKER_ID="玩家UUID"
 *   $env:DEFENDER_ID="另一玩家UUID"
 *   node backend/scripts/pvp-siege-smoke.mjs
 */

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const CITY_ID = process.env.CITY_ID || '1';
const ATTACKER_ID = process.env.ATTACKER_ID;
const DEFENDER_ID = process.env.DEFENDER_ID;

async function j(path, opt = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opt.headers },
    ...opt,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text };
  }
  if (!r.ok) {
    throw new Error(`${opt.method || 'GET'} ${path} → ${r.status} ${text.slice(0, 200)}`);
  }
  return data;
}

async function main() {
  if (!ATTACKER_ID || !DEFENDER_ID) {
    console.error('请设置环境变量 ATTACKER_ID、DEFENDER_ID（及可选 CITY_ID、API_BASE）');
    process.exit(1);
  }

  console.log('1) POST siege …');
  const siege = await j(`/api/cities/${CITY_ID}/siege`, {
    method: 'POST',
    body: JSON.stringify({ playerId: ATTACKER_ID }),
  });
  if (!siege.success) throw new Error(JSON.stringify(siege));
  const d = siege.data;
  console.log('   defenderType:', d.defenderType, 'warId:', d.warId);
  if (d.defenderType !== 'pvp_online') {
    console.log('   未进入 pvp_online（检查：防守是否披挂上阵、兵力≥800、势力/城市归属）');
    process.exit(2);
  }

  console.log('2) POST pvp/challenge …');
  const ch = await j('/api/pvp/challenge', {
    method: 'POST',
    body: JSON.stringify({
      warId: d.warId,
      cityId: CITY_ID,
      attackerId: ATTACKER_ID,
      attackerFaction: d.playerFaction,
      defenderId: d.defenderPlayerId,
      defenderGarrisonSlot: d.defenderGarrisonSlot,
    }),
  });
  if (!ch.success) throw new Error(JSON.stringify(ch));
  console.log('   challengeId:', ch.challengeId, 'waitSeconds:', ch.waitSeconds);

  console.log('3) GET pvp/pending（防守方，会刷新 lastActive）…');
  const pen = await j(`/api/pvp/pending/${DEFENDER_ID}`);
  console.log('   pending:', pen.challenge ? pen.challenge.challengeId : null);

  console.log('4) POST accept …');
  const acc = await j(`/api/pvp/challenge/${ch.challengeId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ defenderId: DEFENDER_ID }),
  });
  console.log('   accept:', acc);

  console.log('5) GET challenge status …');
  const st = await j(`/api/pvp/challenge/${ch.challengeId}/status`);
  console.log('   status:', st.status);

  console.log('6) POST pvp/siege-resolve（披挂服务端权威）…');
  const rs = await j('/api/pvp/siege-resolve', {
    method: 'POST',
    body: JSON.stringify({ challengeId: ch.challengeId, attackerId: ATTACKER_ID }),
  });
  if (!rs.success) throw new Error(JSON.stringify(rs));
  console.log('   attackerWon:', rs.data.attackerWon, 'battleSeed:', rs.data.battleSeed, 'killed:', rs.data.killedIndices?.length);

  console.log('链路与权威结算正常。多进程部署须将挑战状态外置（Redis/DB）。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
