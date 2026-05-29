/**
 * CommPanel · 聊天 Tab（原 CommPanel.jsx）
 */
import { useState, useEffect, useCallback } from 'react';
import { chatAPI } from '@/services/chatApi';
import {
  COMM_TAB_BODY_CLASS,
  COMM_TAB_SCROLL_CLASS,
  COMM_TAB_TOP_SLOT_CLASS,
  COMM_TAB_BOTTOM_SLOT_CLASS,
  formatRelativeTime,
} from '@/components/comm/commPanelLayout';

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

export default ChatTab;
