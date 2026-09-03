/**
 * CommPanel · 传书未读 / 天下聊天角标轮询（原 CommPanel.jsx）。
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { textsAPI } from '@/services/textsApi';
import { chatAPI } from '@/services/chatApi';

export function useCommPanelNotify({ visible, playerId, unreadChatProp = 0 }) {
  const [unreadTextCount, setUnreadTextCount] = useState(0);
  const [chatNotifyCount, setChatNotifyCount] = useState(0);
  const seenWorldMaxRef = useRef('0');

  const seenStorageKey = playerId ? `san_chat_seen_world_${playerId}` : null;

  const refreshTextUnread = useCallback(async () => {
    if (!playerId) return;
    const r = await textsAPI.summary(playerId);
    if (r.success) setUnreadTextCount(r.unreadCount);
  }, [playerId]);

  useEffect(() => {
    if (!visible || !playerId) return;
    refreshTextUnread();
    const id = setInterval(refreshTextUnread, 45000);
    return () => clearInterval(id);
  }, [visible, playerId, refreshTextUnread]);

  useEffect(() => {
    if (!seenStorageKey || typeof sessionStorage === 'undefined') return;
    try {
      const v = sessionStorage.getItem(seenStorageKey);
      if (v) seenWorldMaxRef.current = v;
    } catch {
      /* ignore */
    }
  }, [seenStorageKey]);

  useEffect(() => {
    if (!visible || !playerId) return;
    const tick = async () => {
      try {
        const r = await chatAPI.meta(playerId, { channelType: 'world', channelId: null });
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
  }, [visible, playerId]);

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
    [seenStorageKey],
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

  const chatBadge = Math.max(chatNotifyCount, unreadChatProp || 0);
  const showTextMailGoldGlow = unreadTextCount > 0;

  return {
    unreadTextCount,
    refreshTextUnread,
    chatNotifyCount,
    syncWorldSeen,
    minimizedEntry,
    chatBadge,
    showTextMailGoldGlow,
  };
}

export default useCommPanelNotify;
