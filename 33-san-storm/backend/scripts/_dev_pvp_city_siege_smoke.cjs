/* eslint-disable no-console */
// 快速冒烟：city-siege 三类防守者通用接口（dev only）
//   node backend/scripts/_dev_pvp_city_siege_smoke.cjs

const BASE = process.env.BASE || 'http://localhost:3005';

async function http(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-bypass-auth': '1',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* not json */ }
  return { status: res.status, json, text };
}

(async () => {
  // 1) 错误 ID → 期望 400
  const r1 = await http('POST', '/api/pvp-wars/no-such-war/city-siege', {
    playerId: 'dev-player-001',
  });
  console.log('1) city-siege(no-such-war):', r1.status, r1.json || r1.text);

  // 2) 列出当前 active 的 PVP 战事，看是否有可冒烟的目标
  const r2 = await http('GET', '/api/pvp-wars?status=active&limit=5');
  console.log('2) active PVP wars (count):', (r2.json?.wars || []).length);
  const war = (r2.json?.wars || [])[0];
  if (!war) {
    console.log('  (no active war; 跳过实际握手冒烟)');
    return;
  }
  console.log('  pick:', war.pvpWarId, 'targetCity=', war.targetCityId, 'attackerFaction=', war.attackerFactionId);

  // 3) 选一个攻方阵营玩家
  // 这步依赖你环境里已存在的 dev player；脚本不强行创建
  const r3 = await http('POST', `/api/pvp-wars/${war.pvpWarId}/city-siege`, {
    playerId: process.env.DEV_PLAYER_ID || 'dev-player-001',
  });
  console.log('3) city-siege:', r3.status, r3.json || r3.text);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
