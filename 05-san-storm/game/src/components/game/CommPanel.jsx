/**
 * CommPanel - 通信浮层（左下角）
 * 
 * @description 三Tab布局：📜战报 | 📮传书 | 💬聊天（均已对接后端）
 *              收起态入口主标识：未读传书 > 聊天新消息角标 > 默认入口「聊天」
 *              大地图视图下显示，Tab页面内隐藏
 * 
 * @see 92-1-GAME_UI_DESIGN.md §1.7
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { battleAPI } from '@/services/battleApi';
import { textsAPI } from '@/services/textsApi';
import { chatAPI } from '@/services/chatApi';
import AncientModal from '@/components/common/AncientModal';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { loadMultipleSharedData } from '@/services/dataService';
import { describeMailAttachments, buildCardItemMaps, linesFromClaimDetails } from '@/utils/mailRewardUi';

const TABS = [
  { id: 'battle', icon: '📜', label: '战报' },
  { id: 'text',   icon: '📮', label: '传书' },
  { id: 'chat',   icon: '💬', label: '聊天' },
];

const BATTLE_FILTERS = [
  { id: 'all',       label: '全部' },
  { id: 'win',       label: '胜利' },
  { id: 'lose',      label: '失败' },
  { id: 'favorited', label: '⭐收藏' },
];

/**
 * 三 Tab 内容区：固定同高，避免切换时外框跳动。
 * 总高 24rem（在原先 22rem 基础上加高约一条气泡的 30%量级），多出来的给列表区。
 * 中间列表 flex-1 占满顶栏与底栏之间的空间；底栏仅聊天有内容，高度随输入区走。
 */
const COMM_TAB_BODY_CLASS =
  'flex flex-col h-96 min-h-96 max-h-96 w-full shrink-0 overflow-hidden';
const COMM_TAB_SCROLL_CLASS =
  'flex-1 min-h-0 basis-0 overflow-y-auto overflow-x-hidden';
const COMM_TAB_TOP_SLOT_CLASS =
  'shrink-0 min-h-[3.5rem] border-b border-amber-700/20 px-1 py-1 flex flex-col justify-center gap-1';
const COMM_TAB_BOTTOM_SLOT_CLASS =
  'shrink-0 flex flex-col border-t border-amber-700/20 px-1.5 pb-1 pt-1 gap-0.5';

/**
 * @param {number} [unreadChatCount] - 预留；新消息角标主要由内部 meta 轮询驱动
 */
export default function CommPanel({ visible, unreadChatCount: unreadChatProp = 0 }) {
  const { player, refresh: refreshPlayer } = usePlayerContext();
  const [open, setOpen] = useState(false);
  /** 默认打开「聊天」Tab（战报/传书仍可从顶栏切换） */
  const [activeTab, setActiveTab] = useState('chat');
  const [unreadTextCount, setUnreadTextCount] = useState(0);
  /** 天下频道有新消息（轻量 meta 检测） */
  const [chatNotifyCount, setChatNotifyCount] = useState(0);
  const seenWorldMaxRef = useRef('0');
  /** 领取结果弹窗放在面板外层，避免领取后立即 refreshPlayer 导致子 Tab 重挂载清空行文案 */
  const [mailClaimModal, setMailClaimModal] = useState({ open: false, lines: [] });

  // 战报状态
  const [battles, setBattles] = useState([]);
  const [battleFilter, setBattleFilter] = useState('all');
  const [battleLoading, setBattleLoading] = useState(false);
  const [expandedBattle, setExpandedBattle] = useState(null);
  const [battleDetail, setBattleDetail] = useState(null);

  // 加载战报列表
  const loadBattles = useCallback(async () => {
    if (!player?.player_id) return;
    setBattleLoading(true);
    try {
      const apiFilter = battleFilter === 'favorited' ? 'favorited' : 'all';
      const res = await battleAPI.getBattles(player.player_id, apiFilter);
      if (res.success) {
        let list = res.battles || [];
        // 前端过滤胜负
        if (battleFilter === 'win') list = list.filter(b => b.result === 'win');
        if (battleFilter === 'lose') list = list.filter(b => b.result === 'lose');
        setBattles(list);
      }
    } catch (err) {
      console.error('[CommPanel] 加载战报失败:', err);
    } finally {
      setBattleLoading(false);
    }
  }, [player?.player_id, battleFilter]);

  // 打开面板或切换筛选时加载
  useEffect(() => {
    if (open && activeTab === 'battle') loadBattles();
  }, [open, activeTab, loadBattles]);

  const refreshTextUnread = useCallback(async () => {
    if (!player?.player_id) return;
    const r = await textsAPI.summary(player.player_id);
    if (r.success) setUnreadTextCount(r.unreadCount);
  }, [player?.player_id]);

  useEffect(() => {
    if (!visible || !player?.player_id) return;
    refreshTextUnread();
    const id = setInterval(refreshTextUnread, 45000);
    return () => clearInterval(id);
  }, [visible, player?.player_id, refreshTextUnread]);

  const seenStorageKey = player?.player_id ? `san_chat_seen_world_${player.player_id}` : null;

  // 从 session 恢复已读游标（避免刷新后误报）
  useEffect(() => {
    if (!seenStorageKey || typeof sessionStorage === 'undefined') return;
    try {
      const v = sessionStorage.getItem(seenStorageKey);
      if (v) seenWorldMaxRef.current = v;
    } catch {
      /* ignore */
    }
  }, [seenStorageKey]);

  /** 大地图可见后：轻量轮询天下频道 max chat_id（约 12s，单次一条聚合查询） */
  useEffect(() => {
    if (!visible || !player?.player_id) return;
    const pid = player.player_id;
    const tick = async () => {
      try {
        const r = await chatAPI.meta(pid, { channelType: 'world', channelId: null });
        if (!r.success || r.maxChatId == null) return;
        const remote = String(r.maxChatId);
        const seen = seenWorldMaxRef.current || '0';
        let newer = false;
        try {
          newer = BigInt(remote) > BigInt(seen);
        } catch {
          newer = remote !== seen;
        }
        if (newer) {
          setChatNotifyCount((c) => Math.max(c, 1));
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, 12000);
    return () => window.clearInterval(id);
  }, [visible, player?.player_id]);

  /** 本会话首次进入大地图：自动展开通信浮层并落在「聊天」Tab（便于看到公屏） */
  useEffect(() => {
    if (!visible || !player?.player_id) return;
    const k = `san_comm_auto_open_${player.player_id}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
      setActiveTab('chat');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [visible, player?.player_id]);

  const syncWorldSeen = useCallback(
    (maxChatId) => {
      if (maxChatId == null) return;
      const s = String(maxChatId);
      seenWorldMaxRef.current = s;
      try {
        if (seenStorageKey) sessionStorage.setItem(seenStorageKey, s);
      } catch {
        /* ignore */
      }
      setChatNotifyCount(0);
    },
    [seenStorageKey]
  );

  const minimizedEntry = useMemo(() => {
    if (unreadTextCount > 0) {
      return { icon: '📮', label: '传书', count: unreadTextCount, tab: 'text' };
    }
    const chatBadge = Math.max(chatNotifyCount, unreadChatProp);
    if (chatBadge > 0) {
      return { icon: '💬', label: '聊天', count: chatBadge, tab: 'chat' };
    }
    return { icon: '💬', label: '聊天', count: 0, tab: 'chat' };
  }, [unreadTextCount, unreadChatProp, chatNotifyCount]);

  // 展开战报详情
  const handleExpandBattle = useCallback(async (battleId) => {
    if (expandedBattle === battleId) {
      setExpandedBattle(null);
      setBattleDetail(null);
      return;
    }
    setExpandedBattle(battleId);
    const res = await battleAPI.getBattleDetail(battleId);
    if (res.success) setBattleDetail(res.battle);
  }, [expandedBattle]);

  // 收藏/取消收藏
  const handleToggleFavorite = useCallback(async (battle) => {
    if (!player?.player_id) return;
    if (battle.isFavorited) {
      await battleAPI.unfavoriteBattle(player.player_id, battle.battleId);
    } else {
      await battleAPI.favoriteBattle(player.player_id, battle.battleId);
    }
    loadBattles();
  }, [player?.player_id, loadBattles]);

  if (!visible) return null;

  const mailClaimModalEl = (
    <AncientModal
      isOpen={mailClaimModal.open}
      onClose={() => setMailClaimModal((s) => ({ ...s, open: false }))}
      type="reward"
      title="领取结果"
      confirmText="确定"
    >
      <ul className="text-left space-y-1.5 list-none p-0 m-0">
        {(mailClaimModal.lines || []).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </AncientModal>
  );

  // 最小化入口按钮（传书 > 聊天 > 战报）
  if (!open) {
    const { icon, label, count, tab } = minimizedEntry;
    const suffix = count > 0 ? ` (${count})` : '';
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setActiveTab(tab);
            setOpen(true);
          }}
          className="fixed bottom-20 left-2 z-40 px-3 py-2 bg-black/80 rounded-lg
            border border-amber-700/40 text-amber-300 text-xs font-medium
            hover:bg-black/70 transition-colors"
        >
          {icon} {label}{suffix}
        </button>
        {mailClaimModalEl}
      </>
    );
  }

  return (
    <>
    <div className="fixed bottom-20 left-2 z-40 w-[min(15.5rem,80vw)] max-w-[252px] bg-gray-900/95 rounded-lg shadow-lg overflow-hidden border border-amber-700/40 flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-amber-800/80 shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-200/70 hover:text-amber-200'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(false)} className="px-1.5 py-1 text-amber-200/50 hover:text-amber-200 text-xs shrink-0">
          ✕
        </button>
      </div>

      {/* Tab 内容：总高 22rem；列表区伸展填满顶栏与底栏之间 */}
      <div className="shrink-0 min-h-0 flex flex-col">
        {activeTab === 'battle' && (
          <BattleTab
            battles={battles}
            filter={battleFilter}
            onFilterChange={setBattleFilter}
            loading={battleLoading}
            expandedBattle={expandedBattle}
            battleDetail={battleDetail}
            onExpand={handleExpandBattle}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'text' && (
          <TextMailTab
            playerId={player?.player_id}
            onUnreadChange={refreshTextUnread}
            onClaimed={refreshPlayer}
            onShowClaimResult={(lines) => setMailClaimModal({ open: true, lines })}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab player={player} onWorldReadSynced={syncWorldSeen} />
        )}
      </div>
    </div>
    {mailClaimModalEl}
    </>
  );
}

/** 战报Tab */
function BattleTab({ battles, filter, onFilterChange, loading, expandedBattle, battleDetail, onExpand, onToggleFavorite }) {
  return (
    <div className={COMM_TAB_BODY_CLASS}>
      <div className={COMM_TAB_TOP_SLOT_CLASS}>
        <div className="flex px-0 py-0 gap-0.5">
          {BATTLE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex-1 py-1 text-[10px] rounded transition-colors
                ${filter === f.id
                  ? 'bg-amber-700/40 text-amber-200'
                  : 'text-amber-200/50 hover:text-amber-200/70'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${COMM_TAB_SCROLL_CLASS} p-1.5 space-y-1`}>
        {loading && <div className="text-center text-amber-200/40 text-xs py-2">加载中...</div>}
        {!loading && battles.length === 0 && (
          <div className="text-center text-amber-200/40 text-xs py-2">暂无战报</div>
        )}
        {battles.map(b => (
          <BattleCard
            key={b.battleId}
            battle={b}
            isExpanded={expandedBattle === b.battleId}
            detail={expandedBattle === b.battleId ? battleDetail : null}
            onExpand={() => onExpand(b.battleId)}
            onToggleFavorite={() => onToggleFavorite(b)}
          />
        ))}
      </div>
    </div>
  );
}

/** 单条战报卡片 */
function BattleCard({ battle, isExpanded, detail, onExpand, onToggleFavorite }) {
  const isWin = battle.result === 'win';
  const timeStr = formatRelativeTime(battle.battleAt);

  // 从 rewards JSON 中提取评分信息
  const rewards = battle.rewards || {};
  const score = rewards.battleScore || 0;
  const grade = rewards.battleGrade || '-';

  const gradeColor = grade === 'S' ? 'text-yellow-400' :
    grade === 'A' ? 'text-green-400' :
    grade === 'B' ? 'text-blue-400' :
    grade === 'C' ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="bg-black/30 rounded border border-amber-700/20 overflow-hidden">
      {/* 摘要行 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-amber-700/10 transition-colors"
        onClick={onExpand}
      >
        <span className="text-sm">{isWin ? '✅' : '❌'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-amber-100 truncate">
            {battle.opponentName || '事件战斗'}
          </div>
          <div className="text-[10px] text-amber-200/50">
            评分：<span className={gradeColor}>{grade}</span> · {score}分
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-amber-200/40">{timeStr}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`text-sm ${battle.isFavorited ? 'text-yellow-400' : 'text-amber-200/30 hover:text-yellow-400/60'}`}
          >
            {battle.isFavorited ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && detail && (
        <BattleDetail detail={detail} />
      )}
      {isExpanded && !detail && (
        <div className="px-2 py-2 text-center text-amber-200/40 text-[10px]">加载中...</div>
      )}
    </div>
  );
}

function collectStrikeNamesFromTeam(team) {
  if (!Array.isArray(team)) return [];
  const out = [];
  for (const t of team) {
    const n = t?.courtesyName || t?.name;
    if (n) out.push(String(n).trim());
  }
  return out;
}

/** 战报详情展开区 */
function BattleDetail({ detail }) {
  const [replayOpen, setReplayOpen] = useState(false);
  const rewards = detail.rewards || {};
  const logRaw = detail.battleLog;
  const logStr = typeof logRaw === 'string' ? logRaw : Array.isArray(logRaw) ? logRaw.map((l) => (typeof l === 'object' && l?.text ? l.text : String(l))).join('\n') : '';
  /** 简化回放：左=攻城方、右=守军（与棋盘「我方格」无关，只看战略攻守身份） */
  const isDefenseReport = detail.battleType === 'pvp_defense';
  const siegeLeftLabel = isDefenseReport
    ? `攻城方${detail.opponentName ? ` · ${detail.opponentName}` : ''}`
    : '攻城方';
  const siegeRightLabel = isDefenseReport
    ? '守军'
    : `守军${detail.opponentName ? ` · ${detail.opponentName}` : ''}`;
  const attackerStrikeNames = useMemo(() => {
    const team = isDefenseReport ? detail.opponentTeam : detail.playerTeam;
    return collectStrikeNamesFromTeam(team);
  }, [isDefenseReport, detail.opponentTeam, detail.playerTeam]);
  const defenderStrikeNames = useMemo(() => {
    const team = isDefenseReport ? detail.playerTeam : detail.opponentTeam;
    const base = collectStrikeNamesFromTeam(team);
    const on = detail.opponentName && String(detail.opponentName).trim();
    if (on && !base.some((b) => on === b || on.includes(b) || b.includes(on))) {
      return [...base, on];
    }
    return base;
  }, [isDefenseReport, detail.opponentTeam, detail.playerTeam, detail.opponentName]);
  const canSiegeReplay =
    logStr.length > 12 && /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) && /次攻击/.test(logStr);

  return (
    <div className="px-2 py-1.5 border-t border-amber-700/20 space-y-1.5">
      {canSiegeReplay && (
        <>
          <button
            type="button"
            onClick={() => setReplayOpen(true)}
            className="w-full py-1.5 rounded bg-amber-800/40 border border-amber-600/40 text-amber-100 text-[10px] hover:bg-amber-700/40"
          >
            攻城战报 · 简化回放
          </button>
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
                  leftLabel={siegeLeftLabel}
                  rightLabel={siegeRightLabel}
                  attackerStrikeNames={attackerStrikeNames}
                  defenderStrikeNames={defenderStrikeNames}
                />
              </div>
            </AncientModal>
          )}
        </>
      )}
      {/* 评分明细 */}
      {rewards.battleScore != null && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">战斗评分</div>
          <div className="text-xs text-amber-100">
            {rewards.battleGrade} · {rewards.battleScore}分
          </div>
          {rewards.scoreDetails && (
            <div className="text-[10px] text-amber-200/40 mt-0.5 space-y-0.5">
              <div>
                敌方消耗 +{rewards.scoreDetails.killScore} / 己方损失 {rewards.scoreDetails.lossScore}
                <span className="text-amber-200/30">（评分项，非兵力）</span>
              </div>
              {(rewards.scoreDetails.baseScore != null ||
                (rewards.scoreDetails.killScore != null && rewards.scoreDetails.lossScore != null)) && (
                <div>
                  基础分{' '}
                  {rewards.scoreDetails.baseScore ??
                    rewards.scoreDetails.killScore + rewards.scoreDetails.lossScore}
                  （上两项代数和）
                </div>
              )}
              {rewards.scoreDetails.turnMultiplier != null && rewards.scoreDetails.roundNum != null && (
                <div>
                  回合倍率 ×{rewards.scoreDetails.turnMultiplier}（第{rewards.scoreDetails.roundNum}回合）
                </div>
              )}
              {rewards.scoreDetails.siegeScoreMultiplier != null &&
                Number(rewards.scoreDetails.siegeScoreMultiplier) !== 1 && (
                <div>攻城积分倍率 ×{rewards.scoreDetails.siegeScoreMultiplier}</div>
              )}
              <div className="text-[9px] text-amber-200/25 leading-tight">
                最终分会再套用回合倍率、保底分与攻城倍率，故不等于「基础分×回合倍率」的简单乘积。
              </div>
            </div>
          )}
        </div>
      )}

      {/* 双方阵容 */}
      {detail.playerTeam && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">我方阵容</div>
          <div className="text-[10px] text-amber-100/80">
            {[...new Set(detail.playerTeam.map(t => t.name || t.displayName))].join('、')}
          </div>
        </div>
      )}
      {detail.opponentTeam && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">敌方阵容</div>
          <div className="text-[10px] text-amber-100/80">
            {[...new Set(detail.opponentTeam.map(t => t.name || t.displayName))].join('、')}
          </div>
        </div>
      )}

      {/* 战斗统计 */}
      <div className="flex gap-2 text-[10px] text-amber-200/50">
        {detail.totalKills != null && <span>击杀：{detail.totalKills}</span>}
        {detail.totalDamageDealt != null && <span>输出：{detail.totalDamageDealt}</span>}
        {detail.totalDamageTaken != null && <span>承受：{detail.totalDamageTaken}</span>}
        {detail.duration != null && <span>回合：{detail.duration}</span>}
      </div>

      {/* 战斗日志 */}
      {detail.battleLog && (
        <BattleLogSection log={detail.battleLog} />
      )}
      {!detail.battleLog && detail.hasLog === false && (
        <div className="text-[10px] text-amber-200/30 text-center">日志已过期</div>
      )}
    </div>
  );
}

/** 战斗日志折叠区 */
function BattleLogSection({ log }) {
  const [showLog, setShowLog] = useState(false);
  const lines = typeof log === 'string' ? log.split('\n') : (Array.isArray(log) ? log : []);

  return (
    <div>
      <button
        onClick={() => setShowLog(!showLog)}
        className="text-[10px] text-amber-400/60 hover:text-amber-400/80"
      >
        {showLog ? '▲ 收起日志' : '▼ 查看战斗日志'}
      </button>
      {showLog && (
        <div className="mt-1 max-h-32 overflow-y-auto bg-black/30 rounded p-1.5 space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} className="text-[10px] text-amber-100/60 leading-tight">
              {typeof line === 'object' ? line.text : line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 传书 Tab */
function TextMailTab({ playerId, onUnreadChange, onClaimed, onShowClaimResult }) {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [claimBusy, setClaimBusy] = useState(null);
  const [sharedBundle, setSharedBundle] = useState(null);

  const maps = useMemo(
    () => (sharedBundle ? buildCardItemMaps(sharedBundle) : {}),
    [sharedBundle]
  );
  const itemNameMap = useMemo(() => {
    const m = {};
    (sharedBundle?.items?.items || []).forEach((it) => {
      if (it.id) m[it.id] = it.name || it.id;
    });
    return m;
  }, [sharedBundle]);

  useEffect(() => {
    loadMultipleSharedData(['troops', 'characters', 'equipment', 'items'])
      .then(setSharedBundle)
      .catch(() => setSharedBundle({}));
  }, []);

  const loadTexts = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const r = await textsAPI.list(playerId);
      if (r.success) setTexts(r.texts);
    } catch (e) {
      console.error('[TextMailTab]', e);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadTexts();
  }, [loadTexts]);

  const toggleExpand = async (t) => {
    if (expandedId === t.textId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(t.textId);
    if (!t.isRead && playerId) {
      await textsAPI.markRead(playerId, t.textId);
      setTexts((prev) => prev.map((x) => (x.textId === t.textId ? { ...x, isRead: true } : x)));
      onUnreadChange?.();
    }
  };

  const handleClaim = async (t) => {
    if (!playerId || claimBusy) return;
    setClaimBusy(t.textId);
    try {
      const r = await textsAPI.claim(playerId, t.textId);
      if (r.success) {
        const details = r.details || r.data?.details || [];
        let lines = linesFromClaimDetails(details, { itemNameMap, ...maps });
        if (
          lines.length === 1 &&
          lines[0] === '（无额外物品）' &&
          t.attachments &&
          typeof t.attachments === 'object' &&
          Object.keys(t.attachments).length > 0
        ) {
          const fallback = describeMailAttachments(t.attachments, maps);
          if (fallback.length) {
            lines = [
              '（未收到服务端明细，以下为附件预览，若已达上限以实际到账为准）',
              ...fallback,
            ];
          }
        }
        onShowClaimResult?.(lines);
        setTexts((prev) => prev.map((x) => (x.textId === t.textId ? { ...x, isClaimed: true } : x)));
        window.setTimeout(() => {
          onClaimed?.();
          onUnreadChange?.();
        }, 0);
      } else {
        alert(r.error || '领取失败');
      }
    } finally {
      setClaimBusy(null);
    }
  };

  if (!playerId) {
    return (
      <div className={COMM_TAB_BODY_CLASS}>
        <div className="flex-1 flex items-center justify-center text-amber-200/40 text-xs">加载角色中…</div>
      </div>
    );
  }

  return (
    <div className={COMM_TAB_BODY_CLASS}>
      <div className={COMM_TAB_TOP_SLOT_CLASS}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => loadTexts()}
            className="text-[10px] text-amber-400/70 hover:text-amber-300"
          >
            刷新
          </button>
        </div>
      </div>
      <div className={`${COMM_TAB_SCROLL_CLASS} p-1.5 space-y-1`}>
      {loading && <div className="text-center text-amber-200/40 text-xs py-2">加载中...</div>}
      {!loading && texts.length === 0 && (
        <div className="text-center text-amber-200/40 text-xs py-2">暂无传书</div>
      )}
      {!loading &&
        texts.map((t) => (
          <div key={t.textId} className="bg-black/30 rounded border border-amber-700/20 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-start gap-2 px-2 py-1.5 text-left hover:bg-amber-700/10"
              onClick={() => toggleExpand(t)}
            >
              <span className="text-[10px] shrink-0 mt-0.5">{t.isRead ? '　' : '🔴'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-100 truncate">{t.subject || '（无标题）'}</div>
                <div className="text-[10px] text-amber-200/50">
                  {t.senderName || '未知'} · {formatRelativeTime(t.createdAt)}
                  {t.type === 'reward' && (
                    <span className="ml-1">{t.isClaimed ? '· 已领' : '· 可领'}</span>
                  )}
                </div>
              </div>
              <span className="text-amber-200/40 text-[10px] shrink-0">{expandedId === t.textId ? '▲' : '▼'}</span>
            </button>
            {expandedId === t.textId && (
              <div className="px-2 py-1.5 border-t border-amber-700/20 space-y-2">
                <div className="text-[10px] text-amber-100/90 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {t.content || '（无正文）'}
                </div>
                {t.type === 'reward' && t.attachments && Object.keys(t.attachments).length > 0 && (() => {
                  const al = describeMailAttachments(t.attachments, maps);
                  if (!al.length) {
                    return (
                      <div className="text-[10px] text-amber-200/50 italic bg-black/20 rounded p-1.5">
                        （附件暂无法解析为可读项）
                      </div>
                    );
                  }
                  return (
                    <div className="text-[10px] text-amber-200/85 space-y-0.5 bg-black/20 rounded p-1.5">
                      {al.map((line, i) => (
                        <div key={i} className="leading-snug">
                          {line}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {t.type === 'reward' && !t.isClaimed && (
                  <button
                    type="button"
                    disabled={!!claimBusy}
                    onClick={() => handleClaim(t)}
                    className="w-full py-1.5 rounded bg-amber-700/50 text-amber-100 text-xs hover:bg-amber-600/50 disabled:opacity-50"
                  >
                    {claimBusy === t.textId ? '领取中…' : '领取附件'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function maxChatIdFromMessages(msgs) {
  if (!msgs?.length) return '0';
  let max = '0';
  for (const m of msgs) {
    const id = String(m.chatId ?? '0');
    try {
      if (BigInt(id) > BigInt(max)) max = id;
    } catch {
      if (id > max) max = id;
    }
  }
  return max;
}

/** 聊天 Tab：天下 / 势力 / 军团 */
function ChatTab({ player, onWorldReadSynced }) {
  const [sub, setSub] = useState('world');
  const [legion, setLegion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);

  const playerId = player?.player_id;
  const factionId = player?.faction_id;
  const factionLabel = player?.faction_name || '势力';
  const pos = Number(player?.position_level ?? 8);

  const canWorld = pos <= 7;
  const canFaction = pos <= 7 && !!factionId;
  const canLegion = pos <= 5 && !!legion?.legionId;

  const loadLegion = useCallback(async () => {
    if (!playerId) return;
    const r = await chatAPI.legionInfo(playerId);
    if (r.success) setLegion(r.data);
  }, [playerId]);

  const loadMessages = useCallback(async () => {
    if (!playerId) return;
    let channelType = sub;
    let channelId = null;
    if (sub === 'faction') {
      if (!factionId) {
        setMessages([]);
        return;
      }
      channelType = 'faction';
      channelId = factionId;
    } else if (sub === 'legion') {
      if (!legion?.legionId) {
        setMessages([]);
        return;
      }
      channelType = 'legion';
      channelId = legion.legionId;
    }
    setLoading(true);
    setSendError('');
    try {
      const r = await chatAPI.list(playerId, { channelType, channelId, limit: 100 });
      if (r.success) {
        setMessages(r.messages);
        if (sub === 'world' && typeof onWorldReadSynced === 'function') {
          onWorldReadSynced(maxChatIdFromMessages(r.messages));
        }
      } else setSendError(r.error || '加载失败');
    } catch (e) {
      console.error('[ChatTab]', e);
      setSendError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [playerId, sub, factionId, legion?.legionId, onWorldReadSynced]);

  useEffect(() => {
    loadLegion();
  }, [loadLegion]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadMessages();
    }, 12000);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!playerId || sending) return;
    const text = input.trim();
    if (!text) return;
    if (sub === 'world' && !canWorld) {
      setSendError('官职需至都尉及以上才可发言天下频道');
      return;
    }
    if (sub === 'faction' && !canFaction) {
      setSendError('无法在本势力频道发言');
      return;
    }
    if (sub === 'legion' && !canLegion) {
      setSendError('官职需至中郎将及以上且加入军团后才可发言');
      return;
    }
    let channelType = sub;
    let channelId = null;
    if (sub === 'faction') channelId = factionId;
    if (sub === 'legion') channelId = legion?.legionId;
    setSending(true);
    setSendError('');
    try {
      const r = await chatAPI.send(playerId, { channelType, channelId, content: text.slice(0, 100) });
      if (r.success) {
        setInput('');
        await loadMessages();
      } else {
        setSendError(r.error || '发送失败');
      }
    } catch (e) {
      setSendError(e.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  if (!playerId) {
    return (
      <div className={COMM_TAB_BODY_CLASS}>
        <div className="flex-1 flex items-center justify-center text-amber-200/40 text-xs">加载角色中…</div>
      </div>
    );
  }

  return (
    <div className={COMM_TAB_BODY_CLASS}>
      <div className={COMM_TAB_TOP_SLOT_CLASS}>
        <div className="flex px-1 py-0 gap-0.5">
          <button
            type="button"
            onClick={() => setSub('world')}
            className={`flex-1 py-1 text-[10px] rounded transition-colors ${
              sub === 'world' ? 'bg-amber-700/40 text-amber-200' : 'text-amber-200/50 hover:text-amber-200/70'
            }`}
          >
            天下
          </button>
          <button
            type="button"
            disabled={!factionId}
            onClick={() => setSub('faction')}
            className={`flex-1 py-1 text-[10px] rounded transition-colors truncate px-0.5 ${
              sub === 'faction' ? 'bg-amber-700/40 text-amber-200' : 'text-amber-200/50 hover:text-amber-200/70'
            } ${!factionId ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={factionId ? factionLabel : '无势力'}
          >
            {factionId ? factionLabel : '势力'}
          </button>
          <button
            type="button"
            disabled={!legion?.legionId}
            onClick={() => setSub('legion')}
            className={`flex-1 py-1 text-[10px] rounded transition-colors truncate px-0.5 ${
              sub === 'legion' ? 'bg-amber-700/40 text-amber-200' : 'text-amber-200/50 hover:text-amber-200/70'
            } ${!legion?.legionId ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={legion?.legionName || '未加入军团'}
          >
            军团
          </button>
        </div>
        <div className="flex justify-end px-1.5">
          <button
            type="button"
            onClick={() => loadMessages()}
            className="text-[10px] text-amber-400/70 hover:text-amber-300"
          >
            刷新
          </button>
        </div>
      </div>

      <div className={`${COMM_TAB_SCROLL_CLASS} px-1.5 space-y-1.5 pb-1`}>
        {loading && messages.length === 0 && (
          <div className="text-center text-amber-200/40 text-xs py-2">加载中…</div>
        )}
        {!loading && sub === 'legion' && !legion?.legionId && (
          <div className="text-center text-amber-200/40 text-xs py-2">未加入军团，无法使用军团频道</div>
        )}
        {!loading && sub === 'faction' && !factionId && (
          <div className="text-center text-amber-200/40 text-xs py-2">暂无势力，无法使用势力频道</div>
        )}
        {messages.map((m) => (
          <div key={m.chatId} className="bg-black/30 rounded border border-amber-700/15 px-2 py-1.5">
            <div className="text-[10px] text-amber-200/55 mb-0.5 flex justify-between gap-2">
              <span className="truncate">{m.senderName}</span>
              <span className="text-amber-200/35 shrink-0">{formatRelativeTime(m.createdAt)}</span>
            </div>
            <div className="text-xs text-amber-100/95 break-words leading-snug">{m.content}</div>
          </div>
        ))}
        {!loading && messages.length === 0 && (sub === 'world' || (sub === 'faction' && factionId) || (sub === 'legion' && legion?.legionId)) && (
          <div className="text-center text-amber-200/35 text-xs py-2">暂无消息，来发一句吧</div>
        )}
      </div>

      <div className={COMM_TAB_BOTTOM_SLOT_CLASS}>
        {sendError && (
          <div className="text-[10px] text-red-300/90 truncate">{sendError}</div>
        )}
        <div className="text-[9px] text-amber-200/40 min-h-[1rem]">
          {sub === 'world' && !canWorld && '官职不足（需都尉及以上）'}
          {sub === 'faction' && !canFaction && factionId && '官职不足（需都尉及以上）'}
          {sub === 'legion' && legion?.legionId && !canLegion && '官职不足（需中郎将及以上）'}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            maxLength={100}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="最多100字"
            className="flex-1 min-w-0 bg-black/40 border border-amber-700/30 rounded px-2 py-1 text-xs text-amber-100 placeholder:text-amber-200/25"
            disabled={
              sending ||
              (sub === 'world' && !canWorld) ||
              (sub === 'faction' && !canFaction) ||
              (sub === 'legion' && !canLegion)
            }
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={
              sending ||
              (sub === 'world' && !canWorld) ||
              (sub === 'faction' && !canFaction) ||
              (sub === 'legion' && !canLegion)
            }
            className="px-2 py-1 rounded bg-amber-700/50 text-amber-100 text-xs hover:bg-amber-600/50 disabled:opacity-40 shrink-0"
          >
            {sending ? '…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 相对时间格式化 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
