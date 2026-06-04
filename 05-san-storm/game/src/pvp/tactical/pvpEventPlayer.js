/**
 * PvP 战术对决 · 事件播放器（消费 events[]，驱动 `useBattleAnimations` 的 DOM 动画）
 *
 * 权威性：客户端**绝不**重掷暴击/闪避/伤害；一律以服务端 `DAMAGE.casualties / remain` 落地，
 * 暴击/闪避表现取自 `ATTACK/COUNTER.result`。坐标/阵营已在 `byId` 部队对象中变换到观战者视角，
 * `MOVE/FORMATION_APPLIED` 内的 canonical 坐标在此经 `view.coord` 变换。
 *
 * 与 `pvpReplayState.foldEvents`（纯终态）共享同一推进语义，确保动画终态 ≡ 折叠终态 ≡ 内核 finalState。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.6
 */

/**
 * @param {object} deps
 * @param {{ current: object }} deps.animRef useBattleAnimations 返回值的 ref（取最新闭包）
 * @param {Map<string, object>} deps.byId instanceId → 棋盘部队对象（buildInitialTroops 产出）
 * @param {object} deps.view makeCanonicalView 返回（提供 coord / faction）
 * @param {(text:string, cls?:string)=>void} [deps.addLog]
 * @param {(round:number)=>void} [deps.setRoundNum]
 */
export function createPvpEventPlayer({ animRef, byId, view, addLog, setRoundNum }) {
  // ATTACK/COUNTER（命中或暴击）先记录，待随后的 DAMAGE 落地动画（dodge 无 DAMAGE，立即播放 miss）
  let pending = null;

  const anim = () => animRef.current;
  const get = (id) => byId.get(id) || null;
  const isRanged = (t) =>
    !!t &&
    typeof t.weaponType === 'string' &&
    t.weaponType.startsWith('archer') &&
    (Number(t.range ?? t.attackRange ?? 1) || 1) >= 2;

  async function playEvent(ev) {
    const a = anim();
    if (!a || !ev) return;
    const p = ev.payload || {};
    switch (ev.type) {
      case 'BATTLE_START':
        // 初始棋盘由壳层在收到 BATTLE_START 时构建并渲染，这里不重复处理。
        break;

      case 'FORMATION_APPLIED': {
        for (const u of p.units || []) {
          const t = get(u.instanceId);
          if (!t) continue;
          a.clearTroopFromTile(t);
          const c = view.coord(u.y, u.x);
          t.y = c.y;
          t.x = c.x;
          a.renderTroopOnTile(t);
        }
        if (p.formationName) {
          const who = view.faction(p.side) === 'player' ? '己方' : '敌方';
          addLog?.(`【布阵】${who}「${p.formationName}」`, 'skill');
        }
        break;
      }

      case 'ROUND_START':
        setRoundNum?.(p.round ?? 0);
        addLog?.(`═══ 第 ${p.round} 回合 ═══`, 'round');
        break;

      case 'MOVE': {
        const t = get(p.instanceId);
        if (!t) break;
        const path = (p.path || []).map(([y, x]) => view.coord(y, x));
        if (path.length > 0) await a.battleMove(t, path);
        break;
      }

      case 'ATTACK':
      case 'COUNTER': {
        if (p.result === 'dodge') {
          const atk = get(p.attacker);
          const def = get(p.defender);
          if (atk && def) await a.battleMiss(atk, def);
          pending = null;
        } else {
          pending = { atkId: p.attacker, defId: p.defender, crit: p.result === 'crit' };
        }
        break;
      }

      case 'DAMAGE': {
        const def = get(p.target);
        const atk = pending ? get(pending.atkId) : null;
        const crit = !!p.crit || !!(pending && pending.crit);
        const casualties = Number(p.casualties) || 0;
        if (def && atk) {
          if (crit) await a.battleCrit(atk, def, casualties);
          else if (isRanged(atk)) await a.battleRanged(atk, def, casualties, '➤');
          else await a.battleAttack(atk, def, casualties);
        } else if (def) {
          // 兜底：缺 atk（理论不应发生）时直接刷血飘字
          def.currentTroops = Math.max(0, def.currentTroops - casualties);
          a.updateTroopHp(def);
          a.showDmg(def, `-${casualties}`, crit ? 'crit' : 'normal');
        }
        // 以服务端 remain 为权威，校正可能的展示漂移
        if (def && p.remain != null) {
          def.currentTroops = Math.max(0, Number(p.remain) || 0);
          a.updateTroopHp(def);
        }
        pending = null;
        break;
      }

      case 'UNIT_ELIMINATED': {
        const t = get(p.instanceId);
        if (t) await a.battleKill(t);
        break;
      }

      case 'BATTLE_END':
        // 结算由壳层依据 winnerSide / result 接口处理。
        break;

      default:
        break;
    }
  }

  async function playEvents(events) {
    for (const ev of events || []) {
      // 顺序播放，逐事件 await 动画完成。
      await playEvent(ev); // eslint-disable-line no-await-in-loop
    }
  }

  return { playEvent, playEvents };
}

export default createPvpEventPlayer;
