/**
 * useEventSystem - 事件系统核心 Hook
 * 
 * @description 从 ExploreDemo 提取的核心状态管理和流程控制
 *              管理事件加载、选项选择、运势判定、阶段流转
 * 
 * 数据来源：
 *   - 玩家属性：PlayerContext（×10存储，hook内部÷10转显示值）
 *   - 上阵将领：PlayerContext cards 中 is_equipped=1 的 character 类型卡牌
 *   - 事件配置：后端 API GET /api/config/events?triggerContext=explore
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { API_CONFIG } from '@/constants';
import { useExploreQuota } from '@/hooks/useExploreQuota';
import { PHASE, FORTUNE_LEVELS } from '@/components/event/EventConstants';
import { pickRandomEvent, isFortuneSuccess, filterExploreEventsPool } from '@/components/event/eventUtils';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';

/** 默认探索地点（南阳荒郊，与 config_events.location 一致） */
export const DEFAULT_EXPLORE_LOCATION_ID = 'san_1_city_6_nanyang';

/**
 * 将 PlayerContext 的 player 数据（×10存储）转为显示值（个位数）
 * 与 ExploreDemo 的 MOCK_PLAYER 格式一致
 */
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

/**
 * 从 cards 中提取已装备的将领配置属性（显示值）
 * 将领卡的 config 中属性已经是 camelCase 且已÷10（由后端 formatCharacterData 处理）
 * 如果将领卡尚未实装配置关联，使用默认值
 */
function getEquippedGenerals(cards) {
  if (!cards || cards.length === 0) return [];
  // 筛选已装备的将领卡
  const equipped = cards.filter(c => c.card_type === 'character' && c.is_equipped);
  return equipped.map(c => {
    const cfg = c.config;
    if (cfg) {
      return {
        name: cfg.name || '将领',
        luck:         cfg.luck ?? 5.0,
        courage:      cfg.courage ?? 5.0,
        command:      cfg.command ?? 5.0,
        combat:       cfg.combat ?? 5.0,
        intelligence: cfg.intelligence ?? 5.0,
        politics:     cfg.politics ?? 5.0,
        charm:        cfg.charm ?? 5.0,
      };
    }
    // 无配置时使用默认值
    return {
      name: '未知将领',
      luck: 5.0, courage: 5.0, command: 5.0, combat: 5.0,
      intelligence: 5.0, politics: 5.0, charm: 5.0,
    };
  });
}

// 默认将领（当玩家未装备将领时使用）
const DEFAULT_GENERAL = {
  name: '无将领',
  luck: 5.0, courage: 5.0, command: 5.0, combat: 5.0,
  intelligence: 5.0, politics: 5.0, charm: 5.0,
};

export default function useEventSystem(player, cards) {
  const quota = useExploreQuota(player?.player_id);

  // 事件数据（全量）
  const [allExploreEvents, setAllExploreEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // 玩家事件进度 { eventId: { status, ... } }
  const [completedEvents, setCompletedEvents] = useState({});

  /** 背包道具数量 { item_id: qty }，用于事件链 required_items 过滤（链1 选 B 无道具则不得抽链2） */
  const [playerItemCounts, setPlayerItemCounts] = useState({});

  // 道具名称映射 { item_id → item_name }
  const [itemNameMap, setItemNameMap] = useState({});

  // 流程状态
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [chosenOption, setChosenOption] = useState(null);
  const [chosenOptionKey, setChosenOptionKey] = useState(null);
  const [fortune, setFortune] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [battleSilverSpent, setBattleSilverSpent] = useState(0);
  const [battleScore, setBattleScore] = useState(null);
  /** 战术图宝箱装备（POST /battles chestRewards 已入库；与事件 /rewards 配置奖励独立） */
  const [battleChestRewards, setBattleChestRewards] = useState([]);
  const [minigameInfo, setMinigameInfo] = useState(null);
  /** 进入惩罚战斗前校验失败（避免进入无退出的 BattleArena） */
  const [battleEntryBlockedMessage, setBattleEntryBlockedMessage] = useState(null);

  // 未完成的事件（关闭对话框后保留，下次探索复用）
  // 持久化到 localStorage，防止刷新页面刷事件
  const pendingKey = player?.player_id ? `pending_event_${player.player_id}` : null;
  const [pendingEvent, setPendingEventRaw] = useState(() => {
    if (!pendingKey) return null;
    try {
      const saved = localStorage.getItem(pendingKey);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const setPendingEvent = useCallback((event) => {
    setPendingEventRaw(event);
    if (pendingKey) {
      if (event) localStorage.setItem(pendingKey, JSON.stringify(event));
      else localStorage.removeItem(pendingKey);
    }
  }, [pendingKey]);

  // player 加载后从 localStorage 恢复 pendingEvent
  // 如果检测到事件进行中（选了选项但未完成），视为失败：清除事件，次数不退还
  useEffect(() => {
    if (!pendingKey) return;
    const inProgress = localStorage.getItem(pendingKey + '_inprogress');
    if (inProgress) {
      // 事件进行中刷新 → 失败处理
      localStorage.removeItem(pendingKey + '_inprogress');
      localStorage.removeItem(pendingKey);
      setPendingEventRaw(null);
      console.warn('[useEventSystem] 检测到未完成事件，视为失败处理');
      return;
    }
    try {
      const saved = localStorage.getItem(pendingKey);
      if (saved) setPendingEventRaw(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [pendingKey]);

  // 后端实际发放的奖励详情（含随机卡牌的实际cardId）
  const [rewardDetails, setRewardDetails] = useState(null);
  // 后端响应缓存（骰子动画期间存储，动画结束后读取）
  const pendingRewardResponse = useRef(null);

  // 将玩家属性转为显示值
  const playerAttrs = useMemo(() => toDisplayAttrs(player), [player]);

  // 提取上阵将领
  const equippedGenerals = useMemo(() => getEquippedGenerals(cards), [cards]);
  const general1 = equippedGenerals[0] || DEFAULT_GENERAL;
  const general2 = equippedGenerals[1] || DEFAULT_GENERAL;

  // 队伍信息（供 FortunePreview 显示）
  const team = useMemo(() => ({
    player: playerAttrs,
    general1,
    general2,
  }), [playerAttrs, general1, general2]);

  // 从API加载explore事件（全量）
  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/config/events?triggerContext=explore`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAllExploreEvents(data.events);
        } else {
          console.error('[useEventSystem] 加载事件失败:', data.message);
        }
      })
      .catch(err => console.error('[useEventSystem] 请求事件API失败:', err))
      .finally(() => setEventsLoading(false));
  }, []);

  // 加载玩家事件进度
  useEffect(() => {
    if (!player?.player_id) return;
    fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events/explore`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCompletedEvents(data.data.events || {});
      })
      .catch(err => console.error('[useEventSystem] 加载事件进度失败:', err));
  }, [player?.player_id]);

  /** 探索结算动画结束后回到 IDLE 时再拉一次进度（含跨日部队链重置） */
  const prevPhaseForExploreRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseForExploreRef.current;
    prevPhaseForExploreRef.current = phase;
    if (prev !== PHASE.RETURNING || phase !== PHASE.IDLE || !player?.player_id) return;
    fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events/explore`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCompletedEvents(data.data.events || {});
      })
      .catch(() => {});
  }, [phase, player?.player_id]);

  // 同步背包道具（探索池过滤链式事件用）
  useEffect(() => {
    if (!player?.player_id) {
      setPlayerItemCounts({});
      return;
    }
    fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/items`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.items) {
          const m = {};
          for (const it of d.data.items) {
            if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
          }
          setPlayerItemCounts(m);
        }
      })
      .catch(() => {});
  }, [player?.player_id]);

  /** 当前探索地点（大地图/探索 Tab 通过 startExplore(locationId) 切换） */
  const [exploreLocationId, setExploreLocationId] = useState(DEFAULT_EXPLORE_LOCATION_ID);

  // 根据地点 + 链进度过滤可用事件池（用于 UI 展示默认地点池子大小等）
  const exploreEvents = useMemo(() => (
    filterExploreEventsPool(allExploreEvents, completedEvents, exploreLocationId, playerItemCounts)
  ), [allExploreEvents, completedEvents, exploreLocationId, playerItemCounts]);

  const explorePoolAt = useCallback((locationId) => (
    filterExploreEventsPool(allExploreEvents, completedEvents, locationId, playerItemCounts)
  ), [allExploreEvents, completedEvents, playerItemCounts]);

  // 加载道具名称映射
  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/config/items`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          const map = {};
          data.items.forEach(i => { map[i.item_id] = i.item_name; });
          setItemNameMap(map);
        }
      })
      .catch(err => console.error('[useEventSystem] 加载道具配置失败:', err));
  }, []);

  // 变量替换
  const replaceVars = useCallback((text) => {
    if (!text || !playerAttrs) return text || '';
    return text.replace(/\{player_name\}/g, playerAttrs.name || '');
  }, [playerAttrs]);

  // 开始探索（locationOverride：大地图多个探索点时传入对应 config location）
  const startExplore = useCallback((locationOverride) => {
    if (!quota.canExplore || !playerAttrs) return;
    // 明确点击的地点优先于 localStorage 中的 pending，避免点南阳却沿用山海关未完成事件
    const locId = (locationOverride != null && locationOverride !== '')
      ? locationOverride
      : (pendingEvent?.location || exploreLocationId);
    if (locationOverride) setExploreLocationId(locationOverride);

    const pool = filterExploreEventsPool(allExploreEvents, completedEvents, locId, playerItemCounts);
    const poolIds = new Set(pool.map((e) => e.event_id));

    let usePending = pendingEvent;
    if (usePending && usePending.location && usePending.location !== locId) {
      setPendingEvent(null);
      usePending = null;
    }
    if (usePending && !poolIds.has(usePending.event_id)) {
      setPendingEvent(null);
      usePending = null;
    }

    const event = (usePending && poolIds.has(usePending.event_id) ? usePending : null)
      || pickRandomEvent(pool);
    if (!event) return;

    if (!usePending || usePending.event_id !== event.event_id) setPendingEvent(event);
    setCurrentEvent(event);
    setChosenOption(null);
    setChosenOptionKey(null);
    setFortune(null);
    setBattleResult(null);
    setBattleSilverSpent(0);
    setBattleScore(null);
    setBattleChestRewards([]);
    setMinigameInfo(null);
    setRewardDetails(null);
    setPhase(PHASE.EVENT);
  }, [quota, playerAttrs, pendingEvent, allExploreEvents, completedEvents, exploreLocationId, playerItemCounts, setPendingEvent]);

  // 关闭事件对话框（未选择选项，不消耗次数）
  const closeEvent = useCallback(() => {
    setPhase(PHASE.IDLE);
    setCurrentEvent(null);
  }, []);

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
      .catch(err => { console.error('[useEventSystem] 奖励API请求失败:', err); return null; });
  }, [currentEvent, player, playerAttrs, general1, general2]);

  const refetchExploreProgress = useCallback(() => {
    if (!player?.player_id) return;
    fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events/explore`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setCompletedEvents(d.data.events || {});
      })
      .catch(() => {});
  }, [player?.player_id]);

  // 应用后端返回的fortune和奖励到state；失败时退回 IDLE 并退还次数，避免卡在 REWARD/RESULT 导致全图无法点
  const applyRewardResponse = useCallback((data) => {
    if (!data?.success) {
      console.error('[useEventSystem] 奖励发放失败:', data?.error);
      const err = data?.error || '';
      const isDup = err.includes('已完成') || err.includes('重复');
      if (isDup) {
        console.log('[useEventSystem] 事件已完成或重复领取，跳过并退还探索次数');
        quota.refund();
        refetchExploreProgress();
        setCurrentEvent(null);
        setPendingEvent(null);
        setChosenOption(null);
        setChosenOptionKey(null);
        setRewardDetails(null);
        setFortune(null);
        setMinigameInfo(null);
        setBattleResult(null);
        setBattleSilverSpent(0);
        setBattleScore(null);
        setBattleChestRewards([]);
        if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');
        setPhase(PHASE.IDLE);
        return false;
      }
      quota.refund();
      setRewardDetails({ rewards: [], bonusRewards: [] });
      setCurrentEvent(null);
      setPendingEvent(null);
      setChosenOption(null);
      setChosenOptionKey(null);
      setFortune(null);
      setMinigameInfo(null);
      setBattleResult(null);
      setBattleSilverSpent(0);
      setBattleScore(null);
      setBattleChestRewards([]);
      if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');
      setPhase(PHASE.IDLE);
      return false;
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
      troopRepair: data.data.troopRepair || null,
    });
    if (player?.player_id) {
      fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/items`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data?.items) {
            const m = {};
            for (const it of d.data.items) {
              if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
            }
            setPlayerItemCounts(m);
          }
        })
        .catch(() => {});
      // 与后端 /rewards 写入 explore_events 同步，避免关面板前本地进度滞后仍抽到链上一环
      refetchExploreProgress();
    }
    return true;
  }, [quota, setPendingEvent, pendingKey, player?.player_id, refetchExploreProgress]);

  // 选择选项
  const chooseOption = useCallback((option, optionKey) => {
    quota.consume();
    setChosenOption(option);
    setChosenOptionKey(optionKey);
    pendingRewardResponse.current = null;

    // 标记事件进行中
    if (pendingKey) {
      localStorage.setItem(pendingKey + '_inprogress', '1');
    }

    // minigame类型：进入小游戏，结束后再请求后端
    if (option.mainFactor === 'minigame') {
      const [game, difficulty] = option.mainRequirement.split(':');
      setMinigameInfo({ game, difficulty });
      setPhase(PHASE.MINIGAME);
      return;
    }

    // always类型：先等后端成功再进 REWARD，失败时 applyRewardResponse 已退回 IDLE
    if (option.mainFactor === 'always') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
      requestRewards(optionKey).then((data) => {
        if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
      });
      return;
    }

    // 因子判定：播放骰子动画，同时请求后端
    setPhase(PHASE.ROLLING);
    const rewardPromise = requestRewards(optionKey);
    rewardPromise.then((data) => { pendingRewardResponse.current = data; });

    setTimeout(() => {
      const cached = pendingRewardResponse.current;
      if (cached) {
        const ok = applyRewardResponse(cached);
        pendingRewardResponse.current = null;
        if (cached.success && ok) setPhase(PHASE.RESULT);
      } else {
        rewardPromise.then((data) => {
          if (applyRewardResponse(data)) setPhase(PHASE.RESULT);
        });
      }
    }, 1500);
  }, [quota, requestRewards, applyRewardResponse, pendingKey]);

  const dismissBattleEntryBlocked = useCallback(() => setBattleEntryBlockedMessage(null), []);

  // 判定结果确认
  const confirmResult = useCallback(() => {
    if (fortune && (fortune.name === '凶' || fortune.name === '大凶')) {
      // triggerBattle 在 option JSON 内部（camelCase，布尔值）
      // 只有 triggerBattle=true 的选项才在凶/大凶时触发惩罚战斗
      if (chosenOption && chosenOption.triggerBattle) {
        const v = validateMainLineupBattleGate({
          cards,
          playerFood: player?.food ?? 0,
        });
        if (!v.ok) {
          setBattleEntryBlockedMessage(v.message || '条件不足');
          return;
        }
        setBattleEntryBlockedMessage(null);
        setPhase(PHASE.BATTLE);
        return;
      }
    }
    setPhase(PHASE.REWARD);
  }, [fortune, chosenOption, cards, player?.food]);

  // 战斗结果（第五参 meta 与 EventBattleArena / 攻城一致，含 chestRewards）
  const endBattle = useCallback((result, silverSpent = 0, scoreResult = null, _killedIndices, meta = null) => {
    setBattleResult(result);
    setBattleSilverSpent(silverSpent);
    setBattleScore(scoreResult);
    setBattleChestRewards(Array.isArray(meta?.chestRewards) ? meta.chestRewards : []);
    // 请求后端发放奖励
    requestRewards(chosenOptionKey, {
      battleResult: result,
      ...(silverSpent > 0 ? { battleSilverSpent: silverSpent } : {}),
      ...(scoreResult ? { battleScore: scoreResult.score } : {}),
    }).then((data) => {
      if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
    });
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  // 迷你游戏结果
  const endMinigame = useCallback((result, extra = {}) => {
    if (result === 'victory') {
      setFortune({ name: '吉', emoji: '⭐', color: 'text-blue-600', multiplier: 1.0 });
    } else {
      setFortune({ name: '凶', emoji: '💀', color: 'text-orange-600', multiplier: 0.5 });
    }
    // 请求后端发放奖励（附带筹码盈亏）
    requestRewards(chosenOptionKey, { minigameResult: result, minigameSilverDelta: extra.silverDelta || 0 }).then((data) => {
      if (applyRewardResponse(data)) setPhase(PHASE.REWARD);
    });
  }, [chosenOptionKey, requestRewards, applyRewardResponse]);

  // PHASE.REWARD 阶段：奖励已由 chooseOption/endMinigame/endBattle 请求后端获取
  // 无需额外请求

  // 关闭奖励 → 调用后端发放奖励 → 返回动画
  const closeReward = useCallback(async () => {
    // 调用后端奖励发放API
    if (currentEvent && chosenOptionKey && player?.player_id) {
      try {
        // 记录事件完成进度（用于事件链追踪）
        try {
          await fetch(`${API_CONFIG.BASE_URL}/players/${player.player_id}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: currentEvent.event_id,
              eventType: 6, // explore_events
              status: 'completed',
              data: { chainId: currentEvent.chain_id || null, chainLevel: currentEvent.chain_level || null },
            }),
          });
          // 更新本地进度缓存
          setCompletedEvents(prev => ({
            ...prev,
            [currentEvent.event_id]: { status: 'completed' },
          }));
        } catch (err2) {
          console.error('[useEventSystem] 记录事件进度失败:', err2);
        }
      } catch (err) {
        console.error('[useEventSystem] 奖励API请求失败:', err);
      }
    }
    setPhase(PHASE.RETURNING);
    setCurrentEvent(null);
    setPendingEvent(null);
    setRewardDetails(null);
    setBattleChestRewards([]);
    // 清除进行中标记
    if (pendingKey) localStorage.removeItem(pendingKey + '_inprogress');
    setTimeout(() => setPhase(PHASE.IDLE), 3000);
  }, [currentEvent, chosenOptionKey, player]);

  const isSuccess = isFortuneSuccess(fortune);

  return {
    // 状态
    phase,
    currentEvent,
    chosenOption,
    fortune,
    battleResult,
    minigameInfo,
    isSuccess,
    eventsLoading,
    exploreEvents,
    exploreLocationId,
    setExploreLocationId,
    explorePoolAt,
    quota,
    team,
    playerAttrs,
    itemNameMap,
    playerSilver: player?.silver ?? 0,
    playerResources: player ? {
      silver: player.silver ?? 0,
      food: player.food ?? 0,
      reputation: player.reputation ?? 0,
      contribution: player.contribution ?? 0,
      morale: player.morale ?? 0,
    } : null,
    playerItemsList: player?.items || null,
    rewardDetails,
    battleScore,
    battleChestRewards,
    playerId: player?.player_id || null,
    battleEntryBlockedMessage,
    dismissBattleEntryBlocked,

    // 操作
    startExplore,
    closeEvent,
    chooseOption,
    confirmResult,
    endBattle,
    endMinigame,
    closeReward,
    replaceVars,
  };
}
