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

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import AncientModal from '@/components/common/AncientModal';
import {
  useMapCornerPlayerEntryActions,
  useRegisterMapCornerEntryHandler,
} from '@/contexts/MapCornerPlayerEntryActionsContext';
import { useMapCornerCompactViewport } from '@/hooks/useMapCornerCompactViewport';
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
    playerId: player?.playerId,
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
    playerId: player?.playerId,
    playerName: player?.characterName,
    open,
    activeTab,
    onShowModal: showModal,
  });

  const compactViewport = useMapCornerCompactViewport();
  const { setCommEntryCaption } = useMapCornerPlayerEntryActions() || {};
  const openCommRef = useRef(() => {});

  openCommRef.current = () => {
    const tab = minimizedEntry?.tab || 'chat';
    setActiveTab(tab);
    setOpen(true);
  };

  const openComm = useCallback(() => {
    openCommRef.current();
  }, []);

  useRegisterMapCornerEntryHandler('comm', visible ? openComm : null);

  useEffect(() => {
    if (!visible || !setCommEntryCaption) return;
    const { icon, label, count } = minimizedEntry || {};
    const suffix = count > 0 ? ` (${count})` : '';
    setCommEntryCaption(`${icon || '💬'} ${label || '聊天'}${suffix}`);
  }, [visible, minimizedEntry, setCommEntryCaption]);

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
        {!compactViewport ? (
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
        ) : null}
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
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-amber-200/80 hover:text-amber-100 text-xs px-1"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'battles' && (
            <BattleTab
              battles={battles}
              battleFilter={battleFilter}
              setBattleFilter={setBattleFilter}
              battleLoading={battleLoading}
              expandedBattle={expandedBattle}
              battleDetail={battleDetail}
              battleMemorialQuota={battleMemorialQuota}
              creatingMemorialBattleId={creatingMemorialBattleId}
              onExpandBattle={handleExpandBattle}
              onToggleFavorite={handleToggleFavorite}
              onCreateBattleMemorial={handleCreateBattleMemorial}
            />
          )}
          {activeTab === 'text' && (
            <TextMailTab
              playerId={player?.playerId}
              refreshTextUnread={refreshTextUnread}
              onShowModal={showModal}
              onClaimed={() => refreshPlayer({ silent: true })}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              playerId={player?.playerId}
              playerName={player?.characterName}
              syncWorldSeen={syncWorldSeen}
            />
          )}
        </div>
      </div>
      {mailClaimModalEl}
    </>
  );
}
