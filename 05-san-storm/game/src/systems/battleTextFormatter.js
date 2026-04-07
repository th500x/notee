/**
 * 战斗日志趣味性文本格式化器
 * 
 * @description 为战斗引擎的日志添加趣味性描述短语，
 *              生成可读性强的文字战报，用于保存到数据库。
 * @see 01-1-DATABASE_DESIGN.md 战斗数据格式说明
 * 
 * 使用方式：引擎中 addLog(fmt.attack(atk, def, dmg)) 替代手写字符串
 */

// ── 随机选择短语 ──
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── 趣味性短语库 ──
const PHRASES = {
  crit: ['天命附体', '势不可挡', '雷霆一击', '神威凛凛'],
  miss: ['身轻如燕 完美闪避', '灵活走位 躲过一劫', '反应神速 毫发无伤', '轻功了得 避开攻击'],
  block: ['盾牌格挡', '以守代攻', '铜墙铁壁', '坚守阵地'],
  counter: ['以牙还牙', '反守为攻', '趁势反击', '借力打力'],
  retreat: ['三十六计走为上策', '留得青山在不怕没柴烧', '战略性转进', '暂避锋芒', '识时务者为俊杰'],
  moraleUp: ['士气大振', '斗志昂扬', '气势如虹', '势如破竹'],
  moraleDown: ['军心涣散', '士气低落', '人心惶惶', '斗志全无'],
  heal: ['妙手回春', '华佗再世', '起死回生', '悬壶济世'],
  trap: ['眼神飘忽 踩中陷阱', '脚下一空 落入陷坑', '误入机关 触发陷阱', '大意失足 中了埋伏'],
  kill: ['斩于马下', '全军覆没', '灰飞烟灭'],
  killStreak: { 2: '双杀', 3: '三杀', 4: '四杀', 5: '五杀 无人能挡' },
};

// ── 部队名称提取 ──
function label(t) {
  return t.character?.courtesyName || t.character?.name || t.name || '未知';
}

// ── 格式化函数 ──

/** 普通攻击 */
export function fmtAttack(atk, def, dmg) {
  return `${label(atk)} 攻击 ${label(def)}`;
}

/** 攻击结果 */
export function fmtAttackResult(def, dmg) {
  return `  → ${label(def)} 损失 ${dmg} 兵力（剩余 ${def.currentTroops}/${def.maxTroops}）`;
}

/** 暴击攻击 */
export function fmtCrit(atk, def) {
  return `💥 ${label(atk)} ${pick(PHRASES.crit)}！暴击 ${label(def)}`;
}

/** 暴击结果 */
export function fmtCritResult(def, dmg) {
  return `  → 暴击！${label(def)} 损失 ${dmg} 兵力（剩余 ${def.currentTroops}/${def.maxTroops}）`;
}

/** 闪避 */
export function fmtMiss(atk, def) {
  return `${label(atk)} 攻击 ${label(def)}`;
}

/** 闪避结果 */
export function fmtMissResult(def) {
  return `  → ${label(def)} ${pick(PHRASES.miss)}！`;
}

/** 击杀 */
export function fmtKill(troop) {
  return `💀 ${label(troop)} ${pick(PHRASES.kill)}！`;
}

/** 远程攻击 */
export function fmtRanged(atk, def) {
  return `🏹 ${label(atk)} 远程攻击 ${label(def)}`;
}

/** 技能攻击 */
export function fmtSkill(atk, def, skillName) {
  return `🔮 ${label(atk)} 施放【${skillName}】→ ${label(def)}`;
}

/** 技能结果 */
export function fmtSkillResult(def, dmg) {
  return `  → ${label(def)} 损失 ${dmg} 兵力（剩余 ${def.currentTroops}/${def.maxTroops}）`;
}

/** 踩陷阱 */
export function fmtTrap(troop, trapDmg) {
  return `  ⚠️ ${label(troop)} ${pick(PHRASES.trap)}，损失 ${trapDmg} 兵力！`;
}

/** 回合末着火格灼烧 */
export function fmtFireTerrain(troop, loss) {
  return `🔥 ${label(troop)} 受着火地形灼烧，损失 ${loss} 兵力（剩余 ${troop.currentTroops}/${troop.maxTroops}）`;
}

/** 移动 */
export function fmtMove(troop, fromX, fromY, toX, toY) {
  return `🚶 ${label(troop)} 移动 (${fromX},${fromY})→(${toX},${toY})`;
}

/** 反击 */
export function fmtCounter(def) {
  return `  ↩ ${label(def)} ${pick(PHRASES.counter)}！`;
}

/** 回合开始 */
export function fmtRoundStart(roundNum) {
  return `═══ 第 ${roundNum} 回合 ═══`;
}

/** 部队行动 */
export function fmtTurnStart(troop) {
  const fIcon = troop.faction === 'player' ? '🔵' : '🔴';
  return `${fIcon} ${label(troop)} 行动（速度${troop.speed || 4}）`;
}

/** 无目标 */
export function fmtNoTarget(troop) {
  return `  ${label(troop)} 无目标，待命`;
}

/** 距离不足 */
export function fmtOutOfRange(troop, d, range) {
  return `  ${label(troop)} 距离不足，无法攻击（距离${d}，射程${range}）`;
}

/** 移动后仍不在范围 */
export function fmtStillOutOfRange(troop) {
  return `  ${label(troop)} 移动后仍不在攻击范围内`;
}

/** 战斗结束 */
export function fmtBattleEnd(result) {
  if (result === 'enemy_win') return '💀 我方全军覆没！';
  if (result === 'player_win') return '🎉 敌方全军覆没，胜利！';
  return '';
}

/** 战役主将阵亡导致的即时胜负（与全军覆没文案区分） */
export function fmtCampaignCommanderEnd(result) {
  if (result === 'enemy_win') return '💀 我方友军主将（hero）编制被歼灭，战役失败！';
  if (result === 'player_win') {
    return '🏆 敌方全部主将（boss）编制已被击破，战役胜利！（若场上仍有敌军，按规则视同溃散，不再逐格交兵。）';
  }
  return '';
}

/** 回合结束 */
export function fmtRoundEnd(pAlive, eAlive) {
  return `── 回合结束 ── 我方${pAlive}支 vs 敌方${eAlive}支`;
}

/** 银两消耗 */
export function fmtSilverCost(cost, remaining) {
  return `🪙 自动战斗消耗 ${cost} 银两（剩余 ${remaining}）`;
}

/** 银两不足 */
export function fmtSilverInsufficient(cost, count, current) {
  return `⚠ 银两不足！需要 ${cost} 银两（${count}支部队×2），当前 ${current}`;
}

/** 阵型相关 */
export function fmtFormation(name, desc) {
  return `🎖 我方布阵【${name}】— ${desc}`;
}

export function fmtFormationDisband(name) {
  return `🎖 阵型【${name}】解散，恢复独立行动`;
}

export function fmtFormationAction(name) {
  return `🎖【${name || '阵型'}】整体行动`;
}

export function fmtFormationMove(dirY) {
  return `  🚶 阵型整体向${dirY < 0 ? '前' : '后'}移动`;
}

export function fmtFormationMoveX(dirX) {
  return `  🚶 阵型整体向${dirX < 0 ? '左' : '右'}移动`;
}

export function fmtFormationWait() {
  return `  🎖 阵型距离不足，保持阵型待机`;
}

export function fmtFormationAttack() {
  return `  🎖 阵型整体攻击！`;
}

export function fmtEnemyCounter() {
  return `  ↩ 敌方${pick(PHRASES.counter)}！`;
}

export function fmtNoFormation() {
  return '🎖 无可用阵型，各自为战';
}

export function fmtFormationFail() {
  return '🎖 无法找到合适的阵型摆放位置，各自为战';
}

// 导出短语库供外部使用
export { PHRASES, label, pick };
