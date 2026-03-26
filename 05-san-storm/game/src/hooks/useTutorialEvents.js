/**
 * useTutorialEvents - 新手事件按序触发 Hook
 *
 * @description M1测试阶段：tutorial_step 2~6 对应 5 条新手事件，按序自动触发
 *              复用 useEventSystem 的事件 UI（ExplorePanel），
 *              事件间用 5 秒 RETURNING 动画过渡
 *
 * 流程：
 *   tutorial_step=2 → 前置对话 → 事件 → 奖励 → step++ → 5s动画 → 下一条
 *   tutorial_step=7 → 新手事件全部完成
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { API_CONFIG } from '@/constants';
import { PHASE, FORTUNE_LEVELS } from '@/components/event/EventConstants';
import { isFortuneSuccess } from '@/components/event/eventUtils';
import { tutorialPreEventDialogues } from '@/data/texts/tutorial';
import { playerAPI } from '@/services/playerApi';

// tutorial_step → event_id 映射
const STEP_EVENT_MAP = {
  2: 'san_1_event_2_1000', // 绝版纪念
  3: 'san_1_event_2_1001', // 官拜军候
  4: 'san_1_event_2_1002', // 名将投奔
  5: 'san_1_event_2_1003', // 阵前操练
  6: 'san_1_event_2_1004', // 官拜都尉
};

/** 将 player ×10 属性转显示值 */
function toDisplayAttrs(player) {
  if (!player) return null;
  return {
    name: player.character_name,
    luck:         player.luck / 10,
    courage:      player.courage / 10,
    command:      player.command / 10,
    combat:       player.combat / 10,
    intelligence: player.intelligence / 10,
    politics:     player.politics / 10,
    charm:        player.charm / 10,
  };
}

/** 从 cards 中提取已装备将领属性 */
function getEquippedGenerals(cards) {
  if (!cards?.length) return [];
  return cards
    .filter(c => c.card_type === 'character' && c.is_equipped)
    .map(c => {
      const cfg = c.config;
      if (cfg) return {
        name: cfg.name || '将领',
        luck: cfg.luck ?? 5, courage: cfg.courage ?? 5, command: cfg.command ?? 5,
        combat: cfg.combat ?? 5, intelligence: cfg.intelligence ?? 5,
        politics: cfg.politics ?? 5, charm: cfg.charm ?? 5,
      };
      return { name: '未知将领', luck: 5, courage: 5, command: 5, combat: 5, intelligence: 5, politics: 5, charm: 5 };
    });
}

const DEFAULT_GENERAL = {
  name: '无将领', luck: 5, courage: 5, command: 5, combat: 5,
  intelligence: 5, politics: 5, charm: 5,
};

export default function useTutorialEvents(player, cards) {
  const tutorialStep = player?.tutorial_step ?? 1;
  const isActive = tutorialStep >= 2 && tutorialStep <= 6;

  // 阶段状态
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [showPreDialog, setShowPreDialog] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [chosenOption, setChosenOption] = useState(null);
  const [chosenOptionKey, setChosenOptionKey] = useState(null);
  const [fortune, setFortune] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleSilverSpent, setBattleSilverSpent] = useState(0);
  const [battleScore, setBattleScore] = useState(null);
  const [minigameInfo, setMinigameInfo] = useState(null);
  const [rewardDetails, setRewardDetails] = useState(null);
  const [positionAnimation, setPositionAnimation] = useState(null); // 官职装配动画数据
  const [itemNameMap, setItemNameMap] = useState({});

  const playerAttrs = useMemo(() => toDisplayAttrs(player), [player]);
  const equippedGenerals = useMemo(() => getEquippedGenerals(cards), [cards]);
  const general1 = equippedGenerals[0] || DEFAULT_GENERAL;
  const general2 = equippedGenerals[1] || DEFAULT_GENERAL;
  const team = useMemo(() => ({ player: playerAttrs, general1, general2 }), [playerAttrs, general1, general2]);

  // 加载道具名称映射
  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/config/items`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.items) {
          const m = {};
          d.items.forEach(i => { m[i.item_id] = i.item_name; });
          setItemNameMap(m);
        }
      })
      .catch(() => {});
  }, []);

  // 检查编组状态：玩家角色自带将领身份，只需至少装备1支部队即可
  const hasEquippedLineup = useMemo(() => {
    if (!cards || cards.length === 0) return false;
    const hasTroop = cards.some(c => c.card_type === 'troop' && c.is_equipped);
    return hasTroop;
  }, [cards]);

  // step=5 时需要先编组才能继续
  const needsLineupFirst = tutorialStep === 5 && !hasEquippedLineup;
  const [showLineupGuide, setShowLineupGuide] = useState(false);

  // 当前 step 对应的事件 ID 和前置对话
  const currentEventId = STEP_EVENT_MAP[tutorialStep] || null;
  const preDialog = currentEventId ? tutorialPreEventDialogues[currentEventId] : null;

  // tutorial_step 变化或 phase 回到 IDLE 时，如果在范围内，自动弹前置对话
  // step=5 时如果编组未完成，显示编组引导而不是事件
  useEffect(() => {
    if (isActive && phase === PHASE.IDLE && currentEventId && !showPreDialog) {
      if (needsLineupFirst) {
        setShowLineupGuide(true);
        return;
      }
      setShowLineupGuide(false);
      const t = setTimeout(() => setShowPreDialog(true), 200);
      return () => clearTimeout(t);
    }
  }, [tutorialStep, phase, isActive, currentEventId, needsLineupFirst]);

  // 关闭前置对话 → 从后端加载事件 → 进入事件阶段
  const closePreDialog = useCallback(async () => {
    setShowPreDialog(false);
    if (!currentEventId) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/config/events/${currentEventId}`);
      const data = await res.json();
      if (data.success && data.event) {
        setCurrentEvent(data.event);
        setChosenOption(null);
        setChosenOptionKey(null);
        setFortune(null);
        setBattleResult(null);
        setBattleSilverSpent(0);
        setBattleScore(null);
        setMinigameInfo(null);
        setRewardDetails(null);
        setPhase(PHASE.EVENT);
      }
    } catch (err) {
      console.error('[useTutorialEvents] 加载事件失败:', err);
    }
  }, [currentEventId]);

  // 变量替换
  const replaceVars = useCallback((text) => {
    if (!text || !playerAttrs) return text || '';
    return text.replace(/\{player_name\}/g, playerAttrs.name || '');
  }, [playerAttrs]);

  // 请求后端发放奖励（统一入口）
  const requestRewards = useCallback((optKey, extraBody = {}) => {
    if (!currentEvent || !player?.player_id) return Promise.resolve(null);
    const body = {
      eventId: currentEvent.event_id,
      optionKey: optKey,
      playerAttrs,
      general1Attrs: general1,
      general2Attrs: general2,
      ...extraBody,
    };
    return fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(res => res.json())
      .catch(err => { console.error('[useTutorialEvents] 奖励API请求失败:', err); return null; });
  }, [currentEvent, player, playerAttrs, general1, general2]);

  // 应用后端返回的fortune和奖励到state
  const applyRewardResponse = useCallback((data) => {
    if (!data?.success) {
      console.error('[useTutorialEvents] 奖励发放失败:', data?.error);
      // 如果是事件已完成，自动跳过
      if (data?.error === '事件已完成，不可重复领取奖励') {
        console.log('[useTutorialEvents] 事件已完成，自动跳过');
        const nextStep = tutorialStep + 1;
        playerAPI.updateTutorialStep(player?.player_id, nextStep).catch(() => {});
        setPhase(PHASE.RETURNING);
        setTimeout(() => setPhase(PHASE.IDLE), 1000);
        return;
      }
      setRewardDetails({ rewards: [], bonusRewards: [] });
      return;
    }
    const sf = data.data.fortune;
    if (sf) {
      const level = FORTUNE_LEVELS.find(f => f.name === sf.name) || FORTUNE_LEVELS[2];
      setFortune({
        name: level.name, emoji: level.emoji, color: level.color,
        multiplier: sf.multiplier, dice: sf.dice,
        diceMultiplier: sf.diceMultiplier, baseScore: sf.baseScore, finalRate: sf.finalRate,
      });
    }
    setRewardDetails({
      rewards: data.data.rewards || [],
      bonusRewards: data.data.bonusRewards || [],
    });
  }, []);

  const pendingRewardResponse = useRef(null);

  // 选择选项（不消耗探索次数）
  const chooseOption = useCallback((option, optionKey) => {
    setChosenOption(option);
    setChosenOptionKey(optionKey);
    pendingRewardResponse.current = null;

    if (option.mainFactor === 'minigame') {
      const [game, difficulty] = option.mainRequirement.split(':');
      setMinigameInfo({ game, difficulty });
      setPhase(PHASE.MINIGAME);
      return;
    }
    if (option.mainFactor === 'always') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
      requestRewards(optionKey).then(data => applyRewardResponse(data));
      setPhase(PHASE.REWARD);
      return;
    }
    // 因子判定：播放骰子动画，同时请求后端
    setPhase(PHASE.ROLLING);
    const rewardPromise = requestRewards(optionKey);
    rewardPromise.then(data => { pendingRewardResponse.current = data; });

    setTimeout(() => {
      const cached = pendingRewardResponse.current;
      if (cached) {
        applyRewardResponse(cached);
        pendingRewardResponse.current = null;
        setPhase(PHASE.RESULT);
      } else {
        setPhase(PHASE.RESULT);
        rewardPromise.then(data => applyRewardResponse(data));
      }
    }, 1500);
  }, [requestRewards, applyRewardResponse]);

  // 判定结果确认
  const confirmResult = useCallback(() => {
    if (fortune && (fortune.name === '凶' || fortune.name === '大凶')) {
      if (chosenOption?.triggerBattle) {
        setPhase(PHASE.BATTLE);
        return;
      }
    }
    setPhase(PHASE.REWARD);
  }, [fortune, chosenOption]);

  // 战斗结束
  const endBattle = useCallback((result, silverSpent = 0, scoreResult = null) => {
    setBattleResult(result);
    setBattleSilverSpent(silverSpent);
    setBattleScore(scoreResult);
    requestRewards(chosenOptionKey, {
      battleResult: result,
      ...(silverSpent > 0 ? { battleSilverSpent: silverSpent } : {}),
      ...(scoreResult ? { battleScore: scoreResult.score } : {}),
    }).then(data => applyRewardResponse(data));
    setPhase(PHASE.REWARD);
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  // 迷你游戏结束
  const endMinigame = useCallback((result) => {
    if (result === 'victory') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
    } else {
      setFortune({ name: '凶', emoji: '💀', color: 'text-orange-600', multiplier: 0.5 });
    }
    requestRewards(chosenOptionKey, { minigameResult: result }).then(data => applyRewardResponse(data));
    setPhase(PHASE.REWARD);
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  // 奖励已由 chooseOption/endMinigame/endBattle 请求后端获取，无需额外请求

  // 关闭奖励 → tutorial_step++ → 5秒返回动画
  const closeReward = useCallback(async () => {
    if (currentEvent && chosenOptionKey && player?.player_id) {
      // 记录事件完成进度
      try {
        await fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: currentEvent.event_id,
            eventType: 6,
            status: 'completed',
            data: { chainId: currentEvent.chain_id || null, chainLevel: currentEvent.chain_level || null },
          }),
        });
      } catch (err) {
        console.error('[useTutorialEvents] 记录事件进度失败:', err);
      }
      // tutorial_step++
      const nextStep = tutorialStep + 1;
      try {
        await playerAPI.updateTutorialStep(player.player_id, nextStep);
      } catch (err) {
        console.error('[useTutorialEvents] 更新tutorial_step失败:', err);
      }
    }

    // 检查奖励中是否包含官职 → 触发官职装配动画
    const hasPosition = rewardDetails?.rewards?.some(d => d.type === 'position');
    const positionDetail = rewardDetails?.rewards?.find(d => d.type === 'position');

    setCurrentEvent(null);
    setRewardDetails(null);

    if (hasPosition && positionDetail) {
      // 显示官职装配动画
      setPositionAnimation(positionDetail);
      setPhase(PHASE.RETURNING);
      // 官职动画3秒 + 过渡2秒 = 5秒
      setTimeout(() => setPositionAnimation(null), 3000);
      setTimeout(() => setPhase(PHASE.IDLE), 5000);
    } else {
      setPhase(PHASE.RETURNING);
      setTimeout(() => setPhase(PHASE.IDLE), 5000);
    }
  }, [currentEvent, chosenOptionKey, player, tutorialStep, rewardDetails]);

  // 关闭事件对话框（不选择选项）
  const closeEvent = useCallback(() => {
    setPhase(PHASE.IDLE);
    setCurrentEvent(null);
  }, []);

  const isSuccess = isFortuneSuccess(fortune);

  return {
    isActive,
    tutorialStep,
    // 前置对话
    showPreDialog,
    preDialog,
    closePreDialog,
    // 事件系统接口（与 useEventSystem 兼容）
    phase,
    currentEvent,
    chosenOption,
    fortune,
    battleResult,
    minigameInfo,
    isSuccess,
    team,
    playerAttrs,
    itemNameMap,
    playerSilver: player?.silver ?? 0,
    playerResources: player ? {
      silver: player.silver ?? 0, food: player.food ?? 0,
      reputation: player.reputation ?? 0, contribution: player.contribution ?? 0,
      morale: player.morale ?? 0,
    } : null,
    playerItemsList: player?.items || null,
    rewardDetails,
    battleScore,
    playerId: player?.player_id || null,
    isTutorial: true,
    // 操作
    closeEvent,
    chooseOption,
    confirmResult,
    endBattle,
    endMinigame,
    closeReward,
    positionAnimation,
    showLineupGuide, // 是否显示编组引导
    needsLineupFirst, // 是否需要先编组
    replaceVars,
    eventsLoading: false,
    exploreEvents: [],
    quota: { canExplore: false, remaining: 0, max: 0 },
    startExplore: () => {},
  };
}
