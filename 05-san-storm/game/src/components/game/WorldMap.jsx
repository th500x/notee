/**
 * 大地图：颍川郡战略格网（world）；攻城/城况/荒郊等经格上 tooltip 与共享面板。
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import useEventSystem from '@/hooks/useEventSystem';
import useTutorialEvents from '@/hooks/useTutorialEvents';
import ExplorePanel from '@/components/event/ExplorePanel';
import TutorialPreDialog from '@/components/event/TutorialPreDialog';
import BattleArena from '@/components/battle/BattleArena';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { fetchSiegeQuotaJson, postSiegeQuotaAction } from '@/hooks/useSiegeQuota';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import AncientModal from '@/components/common/AncientModal';
import GarrisonLineup from '@/components/garrison/GarrisonLineup';
import { garrisonAPI } from '@/services/garrisonApi';
import { API_CONFIG, getRarityHex, getRarityLabelCn } from '@/constants';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { buildBattleScoreFormulaLines, resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { shortEquipmentDisplayName } from '@/utils/equipmentDisplayName';
import WorldYingchuanMapSection from '@/components/world/WorldYingchuanMapSection';
import { worldMapCityIsPlayerSameFaction } from '@/utils/worldMapCityPanelCopy';

/** 裁定中遮罩最短展示时长（与其它短动画一致，约 3 秒） */
const PVP_ADJUDICATION_UI_MS = 3000;

function scheduleAfterMinAdjudicationUi(startedAt, fn) {
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, PVP_ADJUDICATION_UI_MS - elapsed);
  if (wait <= 0) {
    fn();
    return;
  }
  setTimeout(fn, wait);
}

/** 攻城结算里服务端权威战报的简化回放入口 */
function AuthoritativeSiegeReplayButton({
  battleLogLines,
  initialAttackerTroops,
  initialDefenderTroops,
}) {
  const [open, setOpen] = useState(false);
  const logStr = Array.isArray(battleLogLines) ? battleLogLines.join('\n') : '';
  const canReplay =
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr);
  if (!canReplay) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg bg-stone-800 border border-amber-600/40 text-amber-200 text-xs hover:bg-stone-700"
      >
        攻城战报 · 简化回放
      </button>
      {open && (
        <AncientModal
          isOpen
          onClose={() => setOpen(false)}
          type="confirm"
          title="攻城战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <SiegeReplayMini
              open
              onClose={() => setOpen(false)}
              battleLog={logStr}
              leftLabel="攻方"
              rightLabel="守军"
              initialAttackerTroops={initialAttackerTroops}
              initialDefenderTroops={initialDefenderTroops}
            />
          </div>
        </AncientModal>
      )}
    </>
  );
}

/** 披挂 PVP 裁定结束：评分摘要 + 可选简化回放（与战报列表 SiegeReplayMini 同源） */
function PvpDefenseOutcomeModal({ outcome, onClose }) {
  const [replayOpen, setReplayOpen] = useState(false);
  const logLines = Array.isArray(outcome?.battleLog)
    ? outcome.battleLog
    : typeof outcome?.battleLog === 'string'
      ? outcome.battleLog.split('\n')
      : [];
  const logStr = logLines.join('\n');
  const canReplay =
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr);

  const sd = outcome?.defenderScoreDetails;
  const score = outcome?.defenderBattleScore;
  const grade = outcome?.defenderBattleGrade;
  const formulaLines =
    sd && score != null ? buildBattleScoreFormulaLines(sd, score).lines : [];
  const troopCounts = useMemo(() => resolveKillLossTroopCounts(sd), [sd]);

  return (
    <>
      <AncientModal
        isOpen
        type="info"
        title="⚔️ 战斗结束"
        confirmText="确定"
        onConfirm={onClose}
      >
        <div className="text-center space-y-2 text-sm text-gray-800 max-h-[22rem] overflow-y-auto text-left px-1">
          <p>
            {outcome.attackerWon ? (
              <span className="text-red-600 font-bold">攻城方获胜</span>
            ) : (
              <span className="text-green-700 font-bold">守军防守成功</span>
            )}
          </p>
          {canReplay && (
            <button
              type="button"
              onClick={() => setReplayOpen(true)}
              className="w-full py-2 rounded-lg bg-amber-800/50 border border-amber-600/50 text-amber-100 text-xs hover:bg-amber-700/50"
            >
              攻城战报 · 简化回放
            </button>
          )}
          {score != null && sd && (
            <div className="text-left text-[11px] text-gray-700 border-t border-gray-200 pt-2 mt-2 space-y-0.5">
              <div className="text-amber-800/90 font-medium">战斗评分</div>
              <div className="font-semibold text-gray-900">
                {grade} · {score}分
              </div>
              <div>
                歼敌 {troopCounts.killTroops != null ? troopCounts.killTroops : '—'} / 战损{' '}
                {troopCounts.lossTroops != null ? troopCounts.lossTroops : '—'}
                <span className="text-gray-500">（兵力）</span>
              </div>
              <div>
                +{sd.killScore} / {sd.lossScore}
                <span className="text-gray-500">（评分）</span>
              </div>
              <div>
                基础分 {sd.baseScore}（上两项代数和）
              </div>
              {sd.turnMultiplier != null && sd.roundNum != null && (
                <div>
                  回合倍率 ×{sd.turnMultiplier}（第{sd.roundNum}回合）
                </div>
              )}
              {sd.siegeScoreMultiplier != null && Number(sd.siegeScoreMultiplier) !== 1 && (
                <div>攻城积分倍率 ×{sd.siegeScoreMultiplier}</div>
              )}
              {formulaLines.length > 0 && (
                <div className="mt-1 pt-1 border-t border-gray-200 space-y-0.5 text-[10px] text-gray-600 leading-snug">
                  <div className="text-gray-700">完整计分步骤</div>
                  {formulaLines.map((row, i) => (
                    <div key={i}>{row.text}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </AncientModal>
      {replayOpen && (
        <AncientModal
          isOpen
          onClose={() => setReplayOpen(false)}
          type="confirm"
          title="攻城战报 · 简化回放"
          hideButtons
          width="max-w-md"
        >
          <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
            <SiegeReplayMini
              open
              onClose={() => setReplayOpen(false)}
              battleLog={logStr}
              leftLabel="攻方"
              rightLabel="守军"
              initialAttackerTroops={outcome.initialAttackerTroops}
              initialDefenderTroops={outcome.initialDefenderTroops}
            />
          </div>
        </AncientModal>
      )}
    </>
  );
}

export default function WorldMap({ onEventBusyChange }) {
  const { player, cards, attributeBonusBySlot, refresh: refreshPlayer } = usePlayerContext();
  const eventSystem = useEventSystem(player, cards);
  const tutorialSystem = useTutorialEvents(player, cards);
  const isTutorial = tutorialSystem.isActive;

  // 当前活跃的事件系统（tutorial 优先）
  const activeSystem = isTutorial ? tutorialSystem : eventSystem;
  const { phase } = activeSystem;
  const { quota, eventsLoading, explorePoolAt, startExplore, citiesList } = eventSystem;

  // ── 城市攻城状态 ──
  const [siegeData, setSiegeData] = useState(null); // 非null时进入战斗
  const [siegeResult, setSiegeResult] = useState(null); // 战斗结算
  const [siegeLoading, setSiegeLoading] = useState(false);
  /** 驻守统计全图拉取在 `WorldYingchuanMapSection`；披挂等操作后 bump 以刷新格上 tooltip 用槽数 */
  const [garrisonStatsRefreshKey, setGarrisonStatsRefreshKey] = useState(0);

  // ── 驻地编组面板（由格上 tooltip「驻地编组」打开，必带 cityId） ──
  const [showGarrison, setShowGarrison] = useState(false);
  const [garrisonCityId, setGarrisonCityId] = useState(null);
  const [garrisonCityName, setGarrisonCityName] = useState('');
  const [onDuty, setOnDuty] = useState(false); // 玩家是否处于披挂待命（任意城）

  // ── PVP 挑战状态 ──
  const [pvpChallenge, setPvpChallenge] = useState(null); // { challengeId, waitSeconds, defenseUnits, ... }
  const [pvpCountdown, setPvpCountdown] = useState(0);
  const pvpTimerRef = useRef(null);
  const pvpResolveOnceRef = useRef(false);

  // ── 防守方：轮询是否有 PVP 挑战 ──
  const [pvpDefenseAlert, setPvpDefenseAlert] = useState(null); // 防守方收到的挑战通知
  const [pvpDefenseWaiting, setPvpDefenseWaiting] = useState(null); // { challengeId, attackerName, startedAt } 已接受，等待裁定
  const [pvpDefenseOutcome, setPvpDefenseOutcome] = useState(null); // 裁定结果展示
  /** 攻城方：倒计时结束或对方已 accept，等待 siege-resolve 与最短 3s 裁定 UI */
  const [pvpAttackerAdjudicating, setPvpAttackerAdjudicating] = useState(null); // { defenderName, startedAt }
  /** 统一替代 window.alert（攻城/驻守等 API 错误） */
  const [simpleAlertMessage, setSimpleAlertMessage] = useState(null);
  /** 设为主城成功后立刻用于 UI，避免等 profile 返回前按钮仍可点（战略 tooltip 另见 WorldStrategicMapGrid 同步） */
  const [pendingMainCityCityId, setPendingMainCityCityId] = useState(null);
  const defPollRef = useRef(null);
  const pvpDefenseOutcomeHandledRef = useRef(false);
  /** 用户已点「确定」或窗口到期进入裁定等待时，不再重复弹出遇袭框（pending 轮询会持续数秒） */
  const silencedDefenseChallengeRef = useRef(null);

  useEffect(() => {
    if (!player?.player_id || !onDuty) return;
    const pollPending = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/pvp/pending/${player.player_id}`).then(r => r.json());
        if (res.success && res.challenge) {
          const c = res.challenge;
          if (silencedDefenseChallengeRef.current && silencedDefenseChallengeRef.current === c.challengeId) {
            return;
          }
          if (silencedDefenseChallengeRef.current && silencedDefenseChallengeRef.current !== c.challengeId) {
            silencedDefenseChallengeRef.current = null;
          }
          setPvpDefenseAlert(c);
          if (Notification.permission === 'granted') {
            new Notification('🏰 城池遭袭', {
              body: `${c.attackerName} 正在攻打我方城池，${c.remainingSeconds} 秒内可点确定查看战报`,
              tag: 'siege-pvp',
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        } else if (res.success && !res.challenge) {
          silencedDefenseChallengeRef.current = null;
        }
      } catch {}
    };
    pollPending();
    defPollRef.current = setInterval(pollPending, 3000);
    return () => clearInterval(defPollRef.current);
  }, [player?.player_id, onDuty]);

  /** 遇袭：关闭通知并进入「裁定中」轮询（与是否点确定一致；不再调用 /accept，避免与 siege-resolve 竞态） */
  const beginDefenseFollowUp = useCallback((alert) => {
    if (!alert?.challengeId) return;
    silencedDefenseChallengeRef.current = alert.challengeId;
    setPvpDefenseAlert(null);
    setPvpDefenseWaiting({
      challengeId: alert.challengeId,
      attackerName: alert.attackerName || '未知',
      startedAt: Date.now(),
    });
  }, []);

  // 遇袭通知：产品在约 waitSeconds 后自动关闭并进入裁定等待
  useEffect(() => {
    const id = pvpDefenseAlert?.challengeId;
    if (!id || !pvpDefenseAlert?.waitSeconds) return undefined;
    const sec = Math.min(60, Math.max(1, Number(pvpDefenseAlert.waitSeconds)));
    const snap = { ...pvpDefenseAlert };
    const t = setTimeout(() => beginDefenseFollowUp(snap), sec * 1000);
    return () => clearTimeout(t);
  }, [pvpDefenseAlert?.challengeId, pvpDefenseAlert?.waitSeconds, beginDefenseFollowUp]);

  useEffect(() => {
    if (player?.on_duty == null) return;
    setOnDuty(!!player.on_duty);
  }, [player?.on_duty]);

  useEffect(() => {
    if (pendingMainCityCityId == null) return;
    const cur = player?.main_city_id;
    if (cur != null && String(cur) === String(pendingMainCityCityId)) {
      setPendingMainCityCityId(null);
    }
  }, [player?.main_city_id, pendingMainCityCityId]);

  const playerMainCityIdForUi =
    pendingMainCityCityId != null ? pendingMainCityCityId : (player?.main_city_id ?? null);

  const handleToggleDutyForCity = useCallback(async (cityId, newVal) => {
    if (!player?.player_id) return false;
    const res = await garrisonAPI.setOnDuty(player.player_id, newVal, cityId);
    if (res.success) {
      await refreshPlayer();
      setGarrisonStatsRefreshKey((k) => k + 1);
      return true;
    }
    if (res.error) setSimpleAlertMessage(res.error);
    return false;
  }, [player?.player_id, refreshPlayer]);

  const handleSetMainCityRequest = useCallback(
    async (targetCityId) => {
      if (!player?.player_id || !targetCityId) return;
      try {
        const res = await playerAPI.setMainCity(player.player_id, targetCityId);
        if (res.success) {
          const d = res.data || {};
          let msg;
          if (d.already) {
            msg = '该城已是您的主城（存卡）';
          } else if (Number(d.costSilver) > 0) {
            msg = `已将主城更换为此城，消耗 ${d.costSilver} 银两`;
          } else {
            msg = '已将该城设为主城（存卡仓库）';
          }
          setSimpleAlertMessage(msg);
          setPendingMainCityCityId(String(targetCityId));
          await refreshPlayer({ silent: true });
          return;
        }
        setSimpleAlertMessage(res.error || '设置主城失败');
      } catch (e) {
        setSimpleAlertMessage(e?.message || '设置主城失败');
      }
    },
    [player?.player_id, refreshPlayer],
  );

  /** 与攻城结算同源：刷新 `/garrisons/stats/cities` + `/cities`，避免格上 tooltip 驻地槽位 / NPC 等卡旧值 */
  const bumpStrategicMapRuntimeCaches = useCallback(() => {
    setGarrisonStatsRefreshKey((k) => k + 1);
  }, []);

  const openGarrisonForCity = useCallback((cityId, cityBaseName) => {
    setGarrisonCityId(cityId);
    setGarrisonCityName(cityBaseName || '城池');
    setShowGarrison(true);
  }, []);

  const startSiegeForCity = useCallback(async (cityId, cityRow) => {
    if (!cityId || !player?.player_id) return;
    if (isTutorial || phase !== PHASE.IDLE || siegeData) return;
    if (worldMapCityIsPlayerSameFaction(cityRow, player?.faction_id)) return;

    const qRes = await fetchSiegeQuotaJson(player.player_id, cityId);
    if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
      setSimpleAlertMessage('攻城次数不足');
      return;
    }

    const builtUnits = buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot);
    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: builtUnits,
      playerFood: player?.food ?? 0,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message);
      return;
    }
    setSiegeLoading(true);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(cityId)}/siege`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.player_id }),
      }).then(r => r.json());
      if (res.success) {
        await postSiegeQuotaAction(player.player_id, cityId, 'consume');

        if (res.data.defenderType === 'pvp_online') {
          try {
            const pvpRes = await fetch(`${API_CONFIG.BASE_URL}/pvp/challenge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                warId: res.data.warId, cityId,
                attackerId: player.player_id, attackerFaction: res.data.playerFaction,
                defenderId: res.data.defenderPlayerId,
                defenderGarrisonSlot: res.data.defenderGarrisonSlot,
              }),
            }).then(r => r.json());
            if (pvpRes.success) {
              setPvpChallenge({
                ...pvpRes, siegeData: res.data,
                defenderName: res.data.defenderName,
              });
              setPvpCountdown(pvpRes.waitSeconds);
              setSiegeResult(null);
            }
          } catch (e) {
            console.error('[PVP] 创建挑战失败:', e);
            setSiegeData(res.data); setSiegeResult(null);
          }
        } else {
          setSiegeData(res.data); setSiegeResult(null);
        }
      } else if (res.error) {
        setSimpleAlertMessage(res.error);
      }
    } catch {}
    setSiegeLoading(false);
  }, [isTutorial, phase, siegeData, player, cards, attributeBonusBySlot]);

  // 战斗结束
  const handleSiegeEnd = useCallback(async (result, silverSpent, scoreResult, killedIndices, meta) => {
    if (!siegeData) return;
    // 防守方本地进入战场：兵力结算仅以攻城方提交的 siege-result 为准，此处只关界面并刷新
    if (siegeData.skipSiegeResult) {
      setSiegeData(null);
      setSiegeResult(null);
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      return;
    }
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/siege-result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warId: siegeData.warId, playerId: player.player_id,
          factionId: siegeData.playerFaction,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved !== false,
          defenderType: siegeData.defenderType || 'npc',
          defenderPlayerId: siegeData.defenderPlayerId || null,
          defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? null,
          garrisonUnits: (siegeData.defenderType === 'player_garrison' || siegeData.defenderType === 'pvp_online')
            ? siegeData.npcGarrison
            : null,
          npcBatchIndex: siegeData.defenderType === 'npc' ? siegeData.npcBatchIndex ?? null : null,
        }),
      }).then(r => r.json());
      if (res.success) {
        setSiegeResult({
          ...res.data,
          chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
        });
      } else {
        // 后端报错，仍然显示结算页（无奖励数据）
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
    }
    setGarrisonStatsRefreshKey((k) => k + 1);
    refreshPlayer({ silent: true });
  }, [siegeData, player, refreshPlayer]);

  const closeSiegeResult = useCallback(() => { setSiegeData(null); setSiegeResult(null); }, []);

  // ── PVP 攻城方：倒计时 + 轮询接受 → 披挂场次走服务端权威结算（不进入本地 BattleArena）──
  useEffect(() => {
    if (!pvpChallenge || !player?.player_id) return;
    pvpResolveOnceRef.current = false;

    const runResolve = async () => {
      if (pvpResolveOnceRef.current) return;
      pvpResolveOnceRef.current = true;
      clearInterval(pvpTimerRef.current);
      const ch = pvpChallenge;
      const adjudicationStartedAt = Date.now();
      setPvpAttackerAdjudicating({
        defenderName: ch.defenderName || '未知',
        startedAt: adjudicationStartedAt,
      });
      setPvpChallenge(null);
      try {
        const r = await fetch(`${API_CONFIG.BASE_URL}/pvp/siege-resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: ch.challengeId, attackerId: player.player_id }),
        }).then((x) => x.json());
        if (r.success && r.data?.siegeData) {
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setSiegeResult({
              ...r.data.siegeData,
              authoritativeBattleLog: r.data.battleLog,
              battleSeed: r.data.battleSeed,
              siegeReplayAttackerNames: r.data.siegeReplayAttackerNames,
              siegeReplayDefenderNames: r.data.siegeReplayDefenderNames,
              initialAttackerTroops: r.data.initialAttackerTroops,
              initialDefenderTroops: r.data.initialDefenderTroops,
            });
            setGarrisonStatsRefreshKey((k) => k + 1);
            refreshPlayer({ silent: true });
          });
        } else {
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setSimpleAlertMessage(r.error || '攻城结算失败');
          });
        }
      } catch (e) {
        console.error('[PVP] siege-resolve', e);
        scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
          setPvpAttackerAdjudicating(null);
          setSimpleAlertMessage('攻城结算请求失败');
        });
      }
    };

    pvpTimerRef.current = setInterval(() => {
      setPvpCountdown((prev) => {
        if (prev <= 1) {
          runResolve();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pvpTimerRef.current);
    };
  }, [pvpChallenge, player?.player_id, refreshPlayer]);

  // ── 防守方：已点「进入战场」→ 轮询服务端裁定结果 ──
  useEffect(() => {
    if (!pvpDefenseWaiting?.challengeId || !player?.player_id) {
      pvpDefenseOutcomeHandledRef.current = false;
      return;
    }
    pvpDefenseOutcomeHandledRef.current = false;
    const poll = async () => {
      if (pvpDefenseOutcomeHandledRef.current) return;
      try {
        const r = await fetch(
          `${API_CONFIG.BASE_URL}/pvp/challenge/${pvpDefenseWaiting.challengeId}/siege-outcome?playerId=${encodeURIComponent(player.player_id)}`
        ).then((x) => x.json());
        if (r.success && r.outcome && !pvpDefenseOutcomeHandledRef.current) {
          pvpDefenseOutcomeHandledRef.current = true;
          const startedAt = pvpDefenseWaiting.startedAt ?? Date.now();
          const outcome = r.outcome;
          scheduleAfterMinAdjudicationUi(startedAt, () => {
            setPvpDefenseWaiting(null);
            setPvpDefenseOutcome(outcome);
            setGarrisonStatsRefreshKey((k) => k + 1);
            refreshPlayer({ silent: true });
          });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [pvpDefenseWaiting, player?.player_id, refreshPlayer]);

  // 新手指引完成时，给满探索次数
  const prevTutorialRef = useRef(isTutorial);
  useEffect(() => {
    if (prevTutorialRef.current && !isTutorial) {
      // tutorial 刚从 active 变为 inactive → 新手指引完成
      quota.fillMax();
    }
    prevTutorialRef.current = isTutorial;
  }, [isTutorial]);

  // 加载玩家道具
  const [playerItems, setPlayerItems] = useState([]);
  const fetchItems = useCallback(() => {
    if (!player?.player_id) return;
    playerAPI.getItems(player.player_id)
      .then(res => {
        if (res.success) setPlayerItems(res.data.items || []);
      })
      .catch(() => {});
  }, [player?.player_id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /** 战略格 tooltip 荒郊/集市：`WorldMapCityInfoBlock` 内嵌 `ExploreLocationDockPanel`（与底栏无关） */
  const subsidiaryExploreEmbed = useMemo(
    () => ({
      quota,
      eventsLoading,
      explorePoolAt,
      startExplore,
      playerItems,
      isTutorial,
      phase,
      citiesList,
    }),
    [quota, eventsLoading, explorePoolAt, startExplore, playerItems, isTutorial, phase, citiesList],
  );

  // 奖励发放后刷新道具列表和玩家资源
  useEffect(() => {
    if (phase === PHASE.RETURNING) {
      fetchItems();
      refreshPlayer();
    }
  }, [phase, fetchItems, refreshPlayer]);

  // 通知父组件事件是否进行中（隐藏底部Tab）
  useEffect(() => {
    const busy = [PHASE.EVENT, PHASE.ROLLING, PHASE.RESULT, PHASE.BATTLE, PHASE.REWARD, PHASE.MINIGAME, PHASE.RETURNING].includes(phase)
      || tutorialSystem.showPreDialog       || !!siegeData || !!pvpChallenge || !!pvpDefenseWaiting || !!pvpAttackerAdjudicating;
    onEventBusyChange?.(busy);
  }, [phase, tutorialSystem.showPreDialog, onEventBusyChange, siegeData, pvpChallenge, pvpDefenseWaiting, pvpAttackerAdjudicating]);

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full bg-stone-950">
      <WorldYingchuanMapSection
        className="flex-1 min-h-0 h-full"
        playerId={player?.player_id}
        playerFactionId={player?.faction_id}
        siegeLoading={siegeLoading}
        onStartSiegeForCity={startSiegeForCity}
        garrisonStatsRefreshKey={garrisonStatsRefreshKey}
        playerOnDuty={!!player?.on_duty}
        playerOnDutyCityId={player?.on_duty_city_id ?? null}
        playerMainCityId={playerMainCityIdForUi}
        playerMainCityChangedAt={player?.main_city_changed_at ?? null}
        playerSilver={player?.silver ?? null}
        onSetMainCityRequest={handleSetMainCityRequest}
        onSetMainCityError={setSimpleAlertMessage}
        onOpenGarrisonForCity={openGarrisonForCity}
        onToggleDutyForCity={handleToggleDutyForCity}
        onDutyError={setSimpleAlertMessage}
        subsidiaryExploreEmbed={subsidiaryExploreEmbed}
      />

      {/* ── PVP 攻城方等待界面 ── */}
      {pvpChallenge && (
        <AncientModal isOpen type="confirm" title="⚔️ 攻城对战" preventClose hideButtons>
          <div className="text-center space-y-4">
            <p className="text-gray-800 text-base">
              约 <span className="text-red-700 font-bold text-xl">{pvpCountdown}</span> 秒后由服务端裁定本场（AI 代打）
            </p>
            <p className="text-gray-500 text-xs">
              对手：{pvpChallenge.defenderName || '未知'}
            </p>
            <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-red-600 transition-all duration-1000"
                style={{ width: `${(pvpCountdown / pvpChallenge.waitSeconds) * 100}%` }}
              />
            </div>
            <p className="text-gray-400 text-xs">无需对方点接受，请稍候…</p>
          </div>
        </AncientModal>
      )}

      {/* ── PVP 防守方通知弹窗 ── */}
      {pvpAttackerAdjudicating && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-800 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              守军主公：<span className="text-amber-800 font-semibold">{pvpAttackerAdjudicating.defenderName}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseWaiting && (
        <AncientModal isOpen type="confirm" title="⚔️ 战场裁定中" preventClose hideButtons>
          <div className="text-center space-y-3 text-gray-700 text-sm py-2 px-1">
            <p>本场由服务端演算，请稍候…</p>
            <p className="text-gray-500 text-xs">
              攻城方：<span className="text-red-800 font-semibold">{pvpDefenseWaiting.attackerName || '未知'}</span>
            </p>
          </div>
        </AncientModal>
      )}

      {pvpDefenseOutcome && (
        <PvpDefenseOutcomeModal
          outcome={pvpDefenseOutcome}
          onClose={() => {
            silencedDefenseChallengeRef.current = null;
            setPvpDefenseOutcome(null);
          }}
        />
      )}

      {pvpDefenseAlert && !siegeData && (
        <AncientModal
          isOpen
          type="warning"
          title="🏰 城池遭袭"
          confirmText="确定"
          showCancel={false}
          onConfirm={() => beginDefenseFollowUp(pvpDefenseAlert)}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">
              <span className="font-bold text-red-700">{pvpDefenseAlert.attackerName}</span> 正在攻打城池
            </p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 可等待裁定结束后在战报中查看文字记录；也可稍后打开「聊天」面板「战报」页。
            </p>
            <p className="text-gray-800">
              约 <span className="text-red-700 font-bold text-xl">{pvpDefenseAlert.remainingSeconds}</span> 秒后本提示将自动关闭（战斗由服务端 AI 演算，与是否观战无关）。
            </p>
            <p className="text-gray-500 text-xs">提示关闭后请勿反复操作，稍候即弹出裁定结果。</p>
          </div>
        </AncientModal>
      )}

      {simpleAlertMessage != null && (
        <AncientModal
          isOpen
          type="warning"
          title="提示"
          confirmText="确定"
          onConfirm={() => setSimpleAlertMessage(null)}
          onClose={() => setSimpleAlertMessage(null)}
        >
          <p className="text-center text-gray-800 text-sm whitespace-pre-wrap">{simpleAlertMessage}</p>
        </AncientModal>
      )}

      {/* ── 驻地编组面板 ── */}
      {showGarrison && garrisonCityId ? (
        <GarrisonLineup
          onClose={() => {
            setShowGarrison(false);
            bumpStrategicMapRuntimeCaches();
          }}
          onAfterMutation={bumpStrategicMapRuntimeCaches}
          cityId={garrisonCityId}
          cityName={garrisonCityName || '城池'}
        />
      ) : null}

      {/* 攻城战斗（复用 BattleArena） */}
      {siegeData && !siegeResult && (
        <BattleArena
          playerUnits={buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot)}
          cards={cards}
          enemyUnits={siegeData.npcGarrison}
          silverAmount={player?.silver ?? 0}
          playerFood={player?.food ?? 0}
          playerId={player?.player_id}
          battleType={siegeData.isPvp ? 'pvp_siege' : 'pve_siege'}
          siegeDefenderType={siegeData.defenderType || 'npc'}
          opponentName={
            siegeData.pvpSiegeRole === 'defender'
              ? (siegeData.attackerName || '攻城方')
              : siegeData.isPvp
                ? (siegeData.defenderName || `${siegeData.cityName || ''}守军`)
                : `${siegeData.cityName}守军`
          }
          onBattleEnd={handleSiegeEnd}
          recordOnly={!!siegeData.skipSiegeResult}
          defenseReportMeta={
            siegeData.pvpSiegeRole === 'defender'
              ? null
              : siegeData.defenderType === 'player_garrison' && siegeData.defenderPlayerId
                ? {
                    warId: siegeData.warId,
                    defenderPlayerId: siegeData.defenderPlayerId,
                    defenderGarrisonSlot: siegeData.defenderGarrisonSlot,
                    attackerPlayerId: player?.player_id,
                    attackerName: player?.character_name || player?.name || '攻城方',
                    cityName: siegeData.cityName,
                    defenderName: siegeData.defenderName,
                  }
                : siegeData.defenderType === 'pvp_online' && siegeData.defenderPlayerId
                  ? {
                      warId: siegeData.warId,
                      defenderPlayerId: siegeData.defenderPlayerId,
                      defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? 0,
                      attackerPlayerId: player?.player_id,
                      attackerName: player?.character_name || player?.name || '攻城方',
                      cityName: siegeData.cityName,
                      defenderName: siegeData.defenderName,
                    }
                  : null
          }
        />
      )}

      {/* 攻城结算 */}
      {siegeResult && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-gray-900/95 rounded-xl p-6 border border-amber-500/30 max-w-sm w-full mx-4 text-center space-y-3">
            <div className="text-4xl">{(siegeResult.killCount || siegeResult.silverReward || siegeResult.contributionReward) ? '⚔️' : '💀'}</div>
            <div className="text-xl font-bold text-amber-400">战斗结算</div>
            {siegeResult.silverReward > 0 && <div className="text-amber-300 text-sm">💰 获得 {siegeResult.silverReward} 银两</div>}
            {siegeResult.reputationReward > 0 && <div className="text-yellow-300 text-sm">⭐ 获得 {siegeResult.reputationReward} 声望</div>}
            {siegeResult.contributionReward > 0 && (
              <div className="text-sky-300 text-sm">贡献 +{siegeResult.contributionReward}</div>
            )}
            {siegeResult.equipmentDrop && (
              <div
                className="text-sm font-medium"
                style={{ color: getRarityHex(siegeResult.equipmentDrop.rarity) }}
              >
                🎁 攻城战后随机掉落（约 5%）：{siegeResult.equipmentDrop.name}（{getRarityLabelCn(siegeResult.equipmentDrop.rarity)}）
              </div>
            )}
            {Array.isArray(siegeResult.chestRewards) && siegeResult.chestRewards.length > 0 && (
              <div className="text-left text-sm space-y-1 border-t border-amber-500/25 pt-2 mt-1">
                <div className="text-[11px] text-stone-500">📦 地图内宝箱</div>
                {siegeResult.chestRewards.map((r, i) => (
                  <div
                    key={`${r.equipmentId || 'eq'}-${i}`}
                    className="font-medium text-sm"
                    style={{ color: getRarityHex(r.rarity) }}
                  >
                    {shortEquipmentDisplayName(r.name)}（{getRarityLabelCn(r.rarity)}）
                  </div>
                ))}
              </div>
            )}
            {siegeResult.killCount != null && <div className="text-sm text-gray-300">本场击杀：{siegeResult.killCount}</div>}
            <div className="text-sm text-gray-400">
              NPC守军：本场消灭 {siegeResult.killCount ?? 0} 支
              {siegeResult.npcTotal != null && siegeResult.npcTotal > 0 && (
                <>
                  {' '}
                  · 累计已消灭 {siegeResult.npcKilled}/{siegeResult.npcTotal}
                </>
              )}
            </div>
            {Array.isArray(siegeResult.authoritativeBattleLog) && siegeResult.authoritativeBattleLog.length > 0 && (
              <>
                <AuthoritativeSiegeReplayButton
                  battleLogLines={siegeResult.authoritativeBattleLog}
                  initialAttackerTroops={siegeResult.initialAttackerTroops}
                  initialDefenderTroops={siegeResult.initialDefenderTroops}
                />
                <details className="text-left text-[11px] text-stone-400 max-h-32 overflow-y-auto mt-2">
                  <summary className="cursor-pointer text-amber-500/90">文字战报（服务端）</summary>
                  <pre className="whitespace-pre-wrap font-sans mt-1">{siegeResult.authoritativeBattleLog.join('\n')}</pre>
                </details>
              </>
            )}
            {siegeResult.killCount === 0 && <div className="text-xs text-stone-500">（目标已被其他玩家击杀，无新增奖励）</div>}
            {siegeResult.siegeCompleted && (
              <div className="bg-amber-900/50 border border-amber-500/30 rounded-lg p-3">
                <div className="text-amber-400 font-bold">🏰 城池攻破！</div>
              </div>
            )}
            <button onClick={closeSiegeResult}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100 font-bold text-sm">
              确定
            </button>
          </div>
        </div>
      )}

      {/* 新手事件前置对话 */}
      {tutorialSystem.showPreDialog && tutorialSystem.preDialog && (
        <TutorialPreDialog
          dialog={tutorialSystem.preDialog}
          onClose={tutorialSystem.closePreDialog}
        />
      )}

      {/* 官职装配动画（新手事件获得官职后） */}
      {tutorialSystem.positionAnimation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">👑</div>
            <div className="text-amber-400 text-2xl font-bold mb-2">
              官职授予
            </div>
            <div className="text-white text-lg">
              {tutorialSystem.positionAnimation.positionName}
            </div>
            <div className="text-amber-300/60 text-sm mt-2">
              Lv.{tutorialSystem.positionAnimation.positionLevel}
            </div>
          </div>
        </div>
      )}

      {/* 编组引导（新手事件3结束后，引导玩家去编组） */}
      {tutorialSystem.showLineupGuide && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/40" />
          {/* 提示文字 */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center pointer-events-auto">
            <div className="bg-stone-900/90 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl">
              <div className="text-amber-400 text-lg font-bold mb-2">⚔️ 编组部队</div>
              <div className="text-stone-300 text-sm mb-1">在继续征程之前，先装备你的将领和部队吧！</div>
              <div className="text-stone-400 text-xs">至少装备 1 支部队</div>
            </div>
          </div>
          {/* 指向左下角编组按钮的箭头 */}
          <div className="absolute bottom-20 left-24 pointer-events-none animate-bounce">
            <div className="text-4xl">👇</div>
            <div className="text-amber-400 text-xs font-bold mt-1">点击编组</div>
          </div>
        </div>
      )}

      {/* 事件面板（tutorial 或 explore） */}
      <ExplorePanel eventSystem={activeSystem} />
    </div>
  );
}
