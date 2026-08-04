/**
 * 战斗日志趣味性文本格式化器
 * 
 * @description 为战斗引擎的日志添加趣味性描述短语，
 *              生成可读性强的文字战报，用于保存到数据库。
 * @see 00-base/01-database-split/00-overview.md 战斗数据格式说明
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

/** 技能被动·首击免疫（对攻方一次攻击） */
export function fmtFirstHitImmune(def, atk) {
  return `🛡️ ${label(def)} 触发「首击免疫」，${label(atk)} 的本次伤害无效`;
}

/** 首击免疫抵消环境/陷阱等伤害来源 */
export function fmtFirstHitImmuneEnvironmental(troop, sourceLabel) {
  return `🛡️ ${label(troop)} 触发「首击免疫」，${sourceLabel} 伤害无效`;
}

/** 远程攻击 */
export function fmtRanged(atk, def) {
  return `🏹 ${label(atk)} 远程攻击 ${label(def)}`;
}

/** 阶段3·主动纯治疗（明镜 / 祈愿 等） */
export function fmtPhase3HealActive(actor, skillName, selfGain, allyTroop, allyGain) {
  const head = `💚 ${label(actor)} 施放【${skillName || '治疗'}】`;
  const parts = [];
  if (selfGain > 0) {
    parts.push(`自军回复 ${selfGain}（余 ${actor.currentTroops}/${actor.maxTroops}）`);
  }
  if (allyGain > 0 && allyTroop) {
    parts.push(`${label(allyTroop)} 回复 ${allyGain}（余 ${allyTroop.currentTroops}/${allyTroop.maxTroops}）`);
  }
  const tail = parts.length ? `  → ${parts.join('；')}` : '';
  return `${head}${tail}`;
}

/** 阶段4·主动纯伤害（多目标一次施放） */
export function fmtPhase4DamageOpening(actor, skillName, targetCount) {
  const n = Math.max(1, Math.floor(Number(targetCount) || 1));
  return `⚡ ${label(actor)} 施放【${skillName || '技能'}】（${n} 目标）`;
}

/** 阶段5·复合主动：主段起手（战报；飘字由动画层） */
export function fmtPhase5CompositeOpening(actor, skillName, effectKey) {
  const tag =
    effectKey === 'damage_dot'
      ? '灼燃'
      : effectKey === 'damage_debuff'
        ? '破甲'
        : effectKey === 'damage_heal'
          ? '攻心'
          : effectKey === 'heal_damage'
            ? '血路'
            : '复合';
  return `⚔ ${label(actor)} 施放【${skillName || '技能'}】（${tag}）`;
}

/** 阶段5·heal_damage：治疗段 */
export function fmtPhase5HealDamageHeal(actor, skillName, selfGain, allyGain) {
  const bits = [];
  if (selfGain > 0) bits.push(`自军 +${selfGain}`);
  if (allyGain > 0) bits.push(`友军 +${allyGain}`);
  return `💚 ${label(actor)}【${skillName || '技能'}】${bits.join('，')}`;
}

/** 阶段5·heal_damage：治疗后的随机追击 */
export function fmtPhase5HealDamageStrike(actor, def) {
  return `  → ${label(actor)} 追袭 ${label(def)}`;
}

/** 阶段5·灼烧段 */
export function fmtPhase5BurnTick(def, loss, roundIdx, totalRounds) {
  return `🔥 ${label(def)} 灼烧 ${roundIdx}/${totalRounds}，损失 ${loss}（余 ${def.currentTroops}/${def.maxTroops}）`;
}

/** 阶段5·固伤段 */
export function fmtPhase5FlatDamage(def, loss) {
  return `  → ${label(def)} 追加固伤 ${loss}（余 ${def.currentTroops}/${def.maxTroops}）`;
}

/** 阶段5·减益段 specialEffect 单段键值 → 战报/飘字可读文案 */
function formatSingleDebuffSegment(key, val) {
  const k = String(key || '').trim().toLowerCase();
  const v = String(val || '').trim();
  if (k === 'movementbattle') {
    if (v.startsWith('=')) {
      const bits = v.slice(1).split(':');
      const mv = bits[0] || '1';
      const rounds = bits[1] || '1';
      return `下${rounds}回合移动力固定为${mv}`;
    }
    if (v.startsWith('+') || v.startsWith('-')) {
      return `移动力${v}`;
    }
  }
  if (k === 'knockback') return `击退${v || '1'}格`;
  if (k === 'pull') return `拉近${v || '1'}格`;
  if (k === 'silence') return `沉默${v || '1'}回合`;
  if (k === 'chaos') return `混乱${v || '1'}回合`;
  if (k === 'chaosorsilence') return `混乱或沉默${v || '1'}回合`;
  if (k === 'shield') return `护盾${v || '1'}层`;
  if (k === 'shieldally') return `友军护盾${v || '1'}层`;
  if (k === 'stealth') return `潜行${v || '1'}回合`;
  if (k === 'nextturndamage') return `下回合伤害×${v || '1'}`;
  if (k === 'physicalreduction') return v.endsWith('%') ? `物理减伤${v}` : `物理减伤${v}%`;
  if (k === 'strategyreduction') return v.endsWith('%') ? `谋略减伤${v}` : `谋略减伤${v}%`;
  if (k === 'strategyvulnerable') return v.endsWith('%') ? `谋略易伤${v}` : `谋略易伤${v}%`;
  if (k === 'immunestrategy') return '免疫谋略';
  if (k === 'reflect') return `反伤×${v || '1'}`;
  if (k === 'stun') return `眩晕${v || '1'}回合`;
  if (k === 'burn') return `灼烧${v}`;
  return `${key}:${val}`;
}

/** 阶段5·减益段 specialEffect 原始键值 → 战报可读文案 */
export function formatPhase5DebuffLabel(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  return String(raw)
    .split(';')
    .map((seg) => {
      const s = seg.trim();
      if (!s) return '';
      const colon = s.indexOf(':');
      if (colon <= 0) return s;
      const key = s.slice(0, colon).trim();
      const val = s.slice(colon + 1).trim();
      return formatSingleDebuffSegment(key, val);
    })
    .filter(Boolean)
    .join('；');
}

/** 阶段5·减益提醒（无兵力时再扣时仍记） */
export function fmtPhase5DebuffNotify(def, debuffLabel) {
  const readable = formatPhase5DebuffLabel(debuffLabel);
  return `⚠ ${label(def)} 受减益：${readable || debuffLabel}`;
}

/** 阶段5·damage_heal：治疗段（主伤已记 fmtAttackResult） */
export function fmtPhase5DamageHealSegment(actor, skillName, selfGain, healTarget, allyGain) {
  const head = `💚 ${label(actor)}【${skillName || '技能'}】回复`;
  const parts = [];
  if (selfGain > 0) parts.push(`自军 ${selfGain}`);
  if (allyGain > 0 && healTarget) parts.push(`${label(healTarget)} ${allyGain}`);
  return `${head}：${parts.join('；')}`;
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
  const fIcon = troop.faction === 'player' ? '🔵' : troop.faction === 'enemy' ? '🔴' : '🟢';
  return `${fIcon} ${label(troop)} 行动（速度${troop.speed || 4}）`;
}

/** 士气崩溃（整数点 ＜40）：本回合无法行动 */
export function fmtMoraleCollapseSkip(troop) {
  return `  💀 ${label(troop)} 士气崩溃，无法行动，原地待机`;
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

/** 主将阵亡导致的即时胜负（与全军覆没文案区分） */
export function fmtCommanderEliminatedEnd(result) {
  if (result === 'enemy_win') return '💀 我方友军主将（hero）编制被歼灭，战斗失败！';
  if (result === 'player_win') {
    return '🏆 敌方全部主将（boss）编制已被击破，战斗胜利！（若场上仍有敌军，按规则视同溃散，不再逐格交兵。）';
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
