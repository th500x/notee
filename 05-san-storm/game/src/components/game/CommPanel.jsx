/**
 * CommPanel - 通信浮层（左下角）
 * 
 * @description 三Tab布局：📜战报 | 📮传书 | 💬聊天
 *              战报Tab已实装，传书和聊天为占位
 *              收起态入口主标识：未读传书 > 未读聊天 > 默认战报（92-1 §1.7）
 *              大地图视图下显示，Tab页面内隐藏
 * 
 * @see 92-1-GAME_UI_DESIGN.md §1.7
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { battleAPI } from '@/services/battleApi';
import { textsAPI } from '@/services/textsApi';
import AncientModal from '@/components/common/AncientModal';
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
 * @param {number} [unreadChatCount] - 聊天未读/新消息数（聊天通道就绪后由父组件传入）
 */
export default function CommPanel({ visible, unreadChatCount = 0 }) {
  const { player, refresh: refreshPlayer } = usePlayerContext();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('battle');
  const [unreadTextCount, setUnreadTextCount] = useState(0);
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

  // 收起态若入口为「战报」，预取列表条数用于角标（有传书/聊天未读时不请求）
  useEffect(() => {
    if (!visible || !player?.player_id || open) return;
    if (unreadTextCount > 0 || unreadChatCount > 0) return;
    loadBattles();
  }, [visible, player?.player_id, open, unreadTextCount, unreadChatCount, loadBattles]);

  const minimizedEntry = useMemo(() => {
    if (unreadTextCount > 0) {
      return { icon: '📮', label: '传书', count: unreadTextCount, tab: 'text' };
    }
    if (unreadChatCount > 0) {
      return { icon: '💬', label: '聊天', count: unreadChatCount, tab: 'chat' };
    }
    return { icon: '📜', label: '战报', count: battles.length, tab: 'battle' };
  }, [unreadTextCount, unreadChatCount, battles.length]);

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
    <div className="fixed bottom-20 left-2 z-40 w-80 max-h-[45vh] bg-gray-900/95 rounded-lg shadow-lg overflow-hidden border border-amber-700/40 flex flex-col">
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

      {/* Tab内容 */}
      <div className="flex-1 overflow-y-auto min-h-0">
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
        {activeTab === 'chat' && <PlaceholderTab icon="💬" label="聊天" />}
      </div>
    </div>
    {mailClaimModalEl}
    </>
  );
}

/** 战报Tab */
function BattleTab({ battles, filter, onFilterChange, loading, expandedBattle, battleDetail, onExpand, onToggleFavorite }) {
  return (
    <div>
      {/* 筛选栏 */}
      <div className="flex border-b border-amber-700/20 px-1 py-1 gap-0.5">
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

      {/* 列表 */}
      <div className="p-1.5 space-y-1">
        {loading && <div className="text-center text-amber-200/40 text-xs py-4">加载中...</div>}
        {!loading && battles.length === 0 && (
          <div className="text-center text-amber-200/40 text-xs py-4">暂无战报</div>
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

/** 战报详情展开区 */
function BattleDetail({ detail }) {
  const rewards = detail.rewards || {};

  return (
    <div className="px-2 py-1.5 border-t border-amber-700/20 space-y-1.5">
      {/* 评分明细 */}
      {rewards.battleScore != null && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">战斗评分</div>
          <div className="text-xs text-amber-100">
            {rewards.battleGrade} · {rewards.battleScore}分
          </div>
          {rewards.scoreDetails && (
            <div className="text-[10px] text-amber-200/40 mt-0.5">
              消灭 +{rewards.scoreDetails.killScore} / 损失 {rewards.scoreDetails.lossScore}
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
    return <div className="text-center text-amber-200/40 text-xs py-6">加载角色中…</div>;
  }

  return (
    <div className="p-1.5 space-y-1">
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => loadTexts()}
          className="text-[10px] text-amber-400/70 hover:text-amber-300"
        >
          刷新
        </button>
      </div>
      {loading && <div className="text-center text-amber-200/40 text-xs py-4">加载中...</div>}
      {!loading && texts.length === 0 && (
        <div className="text-center text-amber-200/40 text-xs py-4">暂无传书</div>
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
  );
}

/** 占位Tab */
function PlaceholderTab({ icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-amber-200/30">
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-xs">{label}功能开发中</span>
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
