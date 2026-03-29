/**
 * 对照：丹阳兵（橙步兵） vs 燕云十八（橙骑兵）预估「防守方兵力条」扣减（无 ±10% 随机）
 * 精锐挨打侧已按 troopDamageToCasualties 折算，与实战一致。
 * 运行：cd game && node scripts/print-yanyun-vs-orange-troop.mjs
 */
import { estimateDamage } from '../src/systems/combatSystem.js';

const defaultChar = {
  combat: 5,
  courage: 5,
  command: 5,
  luck: 5,
  courtesyName: '测试将',
};

function makeTroop(cfg, faction, y, x, ratio) {
  const max = cfg.maxTroops;
  const cur = Math.round(max * ratio);
  return {
    ...cfg,
    faction,
    y,
    x,
    currentTroops: cur,
    maxTroops: max,
    character: { ...defaultChar },
    morale: 70,
    rarity: 'legendary',
  };
}

// 丹阳兵 san_1_troop_1006（橙步兵） / 燕云十八 san_1_troop_1007（橙骑，troopWeight 3.5）
const DANYANG = {
  name: '丹阳兵',
  troopType: 'infantry',
  attack: 5,
  defense: 9,
  speed: 6,
  movement: 4,
  range: 1,
  maxTroops: 600,
  troopWeight: 1,
  infantryCounter: 1,
  cavalryCounter: 0.9,
  archerCounter: 1.1,
  plainAdapt: 1,
  hillAdapt: 1,
  forestAdapt: 1,
  siegeAdapt: 1.1,
};

const YANYUN = {
  name: '燕云十八',
  troopType: 'cavalry',
  attack: 8,
  defense: 8,
  speed: 6,
  movement: 6,
  range: 2,
  maxTroops: 180,
  troopWeight: 3.5,
  infantryCounter: 1.2,
  cavalryCounter: 1,
  archerCounter: 1.2,
  plainAdapt: 1.2,
  hillAdapt: 1,
  forestAdapt: 0.9,
  siegeAdapt: 0.9,
};

const terrain = Array.from({ length: 10 }, () => Array(8).fill('plain'));

function row(label, atk, def) {
  const d = estimateDamage(atk, def, terrain);
  return `${label.padEnd(28)} → 预估掉兵 ${String(d.damage).padStart(4)}（防守方条，无 ±10% 随机）`;
}

const ratios = [
  ['满编 (100%)', 1],
  ['半编 (50%)', 0.5],
  ['残编 (20%)', 0.2],
];

console.log('=== 平原、同将(武勇统率均为5)、士气70、无阵型/无磨损 ===\n');
for (const [name, r] of ratios) {
  console.log(`--- ${name} 互攻 ---`);
  const yy = makeTroop(YANYUN, 'player', 5, 3, r);
  const dy = makeTroop(DANYANG, 'enemy', 4, 3, r);
  console.log(row('燕云十八 → 丹阳兵', yy, dy));
  console.log(row('丹阳兵 → 燕云十八', dy, yy));
  console.log('');
}

console.log('说明：');
console.log('- troopWeight>1 时兵力系数用 (当前/最大)^0.85，满编与线性一致，残编比线性略“耐打”（系数更高）。');
console.log('- 伤害另乘「等效兵力比」min/max(0.33~3)：燕云 max×3.5=630，丹阳=600，略偏燕云。');
console.log('- 燕云打步兵有 infantryCounter 1.2；丹阳打骑兵 cavalryCounter 0.9。');
console.log('- 燕云 troopWeight=3.5：公式伤害÷3.5 四舍五入为兵力条扣减（至少 1），与等效兵力放大对称。');
