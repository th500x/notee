/**
 * CommPanel - 通信浮层（左下角）
 *
 * @description 三Tab布局：📜战报 | 📮传书 | 💬聊天（均已对接后端）
 *              收起态入口主标识：未读传书 > 聊天新消息角标 > 默认入口「聊天」；
 *              有未读传书或天下频道新消息时，左侧 emoji 加深红描边提示（不自动展开面板）
 *              大地图视图下显示，Tab页面内隐藏
 *
 * @see docs/30-frontend/32-5-PLAYER_CORNER.md
 */

import { useState, useCallback } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import AncientModal from '@/components/common/AncientModal';
import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import { COMM_TABS } from '@/components/comm/commPanelLayout';
import BattleTab from '@/components/comm/BattleTab';
import TextMailTab from '@/components/comm/TextMailTab';
import ChatTab from '@/components/comm/ChatTab';
import { useCommPanelBattles } from '@/hooks/useCommPanelBattles';
import { useCommPanelNotify } from '@/hooks/useCommPanelNotify';

/**
 * @param {number} [unreadChatCount] - 预留；新消息角标主要由内部 meta 轮询驱动
 */
export default function CommPanel({ visible, unreadChatCount: unreadChatProp = 0 }) {
  const { player, refresh: refreshPlayer } = usePlayerContext();
  const [open, setOpen] = useState(false);
  /** 默认打开「聊天」Tab（战报/传书仍可从顶栏切换） */
  const [activeTab, setActiveTab] = useState('chat');
  /** 领取结果弹窗放在面板外层，避免领取后立即 refreshPlayer 导致子 Tab 重挂载清空行文案 */
  const [mailClaimModal, setMailClaimModal] = useState({
    open: false,
    lines: [],
    title: '领取结果',
    modalType: 'reward',
  });

  const showModal = useCallback((patch) => {
    setMailClaimModal((s) => ({ ...s, ...patch }));
  }, []);

  const {
    refreshTextUnread,
    syncWorldSeen,
    minimizedEntry,
    showEmojiNotifyOutline,
  } = useCommPanelNotify({
    visible,
    playerId: player?.player_id,
    unreadChatProp,
  });

  const {
    battles,
    battleFilter,
    setBattleFilter,
    battleLoading,
    expandedBattle,
    battleDetail,
    battleMemorialQuota,
    creatingMemorialBattleId,
    handleExpandBattle,
    handleToggleFavorite,
    handleCreateBattleMemorial,
  } = useCommPanelBattles({
    playerId: player?.player_id,
    playerName: player?.character_name,
    open,
    activeTab,
    onShowModal: showModal,
  });

  if (!visible) return null;

  const mailClaimModalEl = (
    <AncientModal
      isOpen={mailClaimModal.open}
      onClose={() => setMailClaimModal((s) => ({ ...s, open: false }))}
      type={mailClaimModal.modalType || 'reward'}
      title={mailClaimModal.title || '领取结果'}
      confirmText="确定"
    >
      <ul className="text-left space-y-1.5 list-none p-0 m-0">
        {(mailClaimModal.lines || []).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </AncientModal>
  );

  if (!open) {
    const { icon, label, count, tab } = minimizedEntry;
    const suffix = count > 0 ? ` (${count})` : '';
    const emojiNotifyStyle = showEmojiNotifyOutline
      ? {
          textShadow:
            '-1px -1px 0 #7f1d1d, 1px -1px 0 #7f1d1d, -1px 1px 0 #7f1d1d, 1px 1px 0 #7f1d1d, 0 -1px 0 #450a0a, 0 1px 0 #450a0a, -1px 0 0 #450a0a, 1px 0 0 #450a0a',
        }
      : undefined;
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setActiveTab(tab);
            setOpen(true);
          }}
          style={mapCornerEntryRowBoxStyle}
          className={`fixed bottom-20 left-2 z-40 justify-start text-amber-300 ${MAP_CORNER_ENTRY_ROW_CLASS}`}
        >
          <span className="flex w-full min-w-0 items-center gap-1 text-left">
            <span style={emojiNotifyStyle} className="inline-flex shrink-0 select-none leading-none">
              {icon}
            </span>
            <span className="min-w-0 truncate">
              {label}
              {suffix}
            </span>
          </span>
        </button>
        {mailClaimModalEl}
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-20 left-2 z-40 w-[min(15.5rem,80vw)] max-w-[252px] bg-gray-900/95 rounded-lg shadow-lg overflow-hidden border border-amber-700/40 flex flex-col">
        <div className="flex items-center justify-between px-2 py-1.5 bg-amber-800/80 shrink-0">
          <div className="flex items-center gap-1">
            {COMM_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-200/70 hover:text-amber-200'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="px-1.5 py-1 text-amber-200/50 hover:text-amber-200 text-xs shrink-0"
          >
            ✕
          </button>
        </div>

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
              memorialQuota={battleMemorialQuota}
              creatingMemorialBattleId={creatingMemorialBattleId}
              onCreateMemorial={handleCreateBattleMemorial}
              playerId={player?.player_id}
            />
          )}
          {activeTab === 'text' && (
            <TextMailTab
              playerId={player?.player_id}
              onUnreadChange={refreshTextUnread}
              onClaimed={refreshPlayer}
              onShowClaimResult={(lines) =>
                showModal({ open: true, lines, title: '领取结果', modalType: 'reward' })
              }
              onShowClaimError={(msg) =>
                showModal({ open: true, lines: [msg], title: '领取失败', modalType: 'warning' })
              }
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
