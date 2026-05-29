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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { battleAPI } from '@/services/battleApi';
import { textsAPI } from '@/services/textsApi';
import { chatAPI } from '@/services/chatApi';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import AncientModal from '@/components/common/AncientModal';
import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import { loadMultipleSharedData } from '@/services/dataService';
import { describeMailAttachments, buildCardItemMaps, linesFromClaimDetails } from '@/utils/mailRewardUi';
import { buildBattleScoreFormulaLines, resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';

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

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function uniqueTroopNames(list) {
  const seen = new Set();
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const name = String(t?.name || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** 今日纪念图记录上的战报 id（API 统一 camelCase：battleId） */
function memorialRecordBattleId(record) {
  if (!record) return null;
  const id = record.battleId;
  return id != null && String(id).trim() !== '' ? String(id).trim() : null;
}

function resolveMemorialFileUrl(rawUrl) {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/api/')) {
    try {
      const apiBase = String(API_CONFIG.BASE_URL || '');
      const origin = new URL(apiBase, window.location.origin).origin;
      return `${origin}${rawUrl}`;
    } catch {
      return `http://localhost:3005${rawUrl}`;
    }
  }
  return rawUrl;
}

function formatDateYMD(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/** 纪念图标题行日期：战报发生时间（battleAt），不可用则回退当前日 */
function memorialDisplayDate(battle, detail) {
  const raw = detail?.battleAt ?? battle?.battleAt;
  if (raw) {
    const t = new Date(raw).getTime();
    if (Number.isFinite(t)) return new Date(t);
  }
  return new Date();
}

function memorialHtmlEscape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 纪念图对阵行左侧：角色名（player_id），如 星空梦（0MRR） */
function formatMemorialPlayerLine(name, playerId) {
  const id = String(playerId ?? '').trim();
  const raw = String(name ?? '').trim();
  const label = memorialHtmlEscape(raw || '主公');
  const idEsc = memorialHtmlEscape(id);
  return id ? `${label}（${idEsc}）` : label;
}

/** public 下纪念海报目录；列表由后端 GET /api/memorial/illus-battle-list 扫 05-san-storm/public/... */
const MEMORIAL_ILLUS_SUBDIR = 'assets/san_1_memorial/illus_battle/';

function publicAssetUrl(relativePath) {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(`${base}${relativePath}`, window.location.href).href;
}

function memorialPublicFileUrl(filename) {
  return publicAssetUrl(`${MEMORIAL_ILLUS_SUBDIR}${filename}`);
}

/** 仅从纪念目录随机；目录空或接口失败则无底图（纯色底） */
async function pickMemorialBattleIllusUrl() {
  try {
    const apiBase = String(API_CONFIG.BASE_URL || '').replace(/\/$/, '');
    const r = await fetchWithTimeout(`${apiBase}/memorial/illus-battle-list`, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      const files = Array.isArray(data?.files) ? data.files.filter(Boolean) : [];
      if (files.length > 0) {
        const name = files[Math.floor(Math.random() * files.length)];
        return memorialPublicFileUrl(name);
      }
    }
  } catch {
    /* 后端未启动等 */
  }
  return null;
}

function preloadMemorialIllusImage(url) {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) img.crossOrigin = 'anonymous';
    } catch {
      /* ignore */
    }
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** 文案块：淡灰半透明底 + 白色字（与彩绘底图对比度平衡） */
const MEMORIAL_PANEL =
  'background:rgba(72,68,64,0.4);border:1px solid rgba(212,175,55,0.35);border-radius:10px;box-sizing:border-box;';
const MEMORIAL_TEXT_MAIN = 'color:#f8f7f4;';
const MEMORIAL_TEXT_MUTE = 'color:rgba(255,255,255,0.82);';
/** 纪念图字体：public/fonts/JYHPHS.woff2；html2canvas 前需 fonts.load */
const MEMORIAL_FONT_FAMILY = '"JYHPHS","Microsoft YaHei",Arial,sans-serif';

async function renderBattleMemorialBlob({ playerName, playerId, battle, detail }) {
  /**
   * 768×1152 纪念海报字号（px）：
   * 主标题 36 · 日期 20 · 角标 emoji 52 · 对阵 22 · 战报块 20
   * 区块标题「战斗评分…」22 · 大号评分 30
   * 歼敌/倍率说明 · 计分步骤①②③ · 无 scoreDetails 提示 → 均为 18
   * 第三块文案框固定 576×504（宽×高）
   */
  const illusUrl = await pickMemorialBattleIllusUrl();
  await preloadMemorialIllusImage(illusUrl);

  const fontWoff2Href = publicAssetUrl('fonts/JYHPHS.woff2');

  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '-99999px';
  root.style.top = '0';
  root.style.width = '768px';
  root.style.height = '1152px';
  root.style.boxSizing = 'border-box';
  root.style.overflow = 'hidden';
  root.style.fontFamily = MEMORIAL_FONT_FAMILY;
  root.style.color = '#f8f7f4';
  const d = detail || {};
  const memorialDate = memorialDisplayDate(battle, d);
  const score = Number(d?.rewards?.battleScore ?? battle?.rewards?.battleScore ?? 0);
  const grade = d?.rewards?.battleGrade || battle?.rewards?.battleGrade || '-';
  const playerTeam = Array.isArray(d?.playerTeam) ? d.playerTeam : (Array.isArray(battle?.playerTeam) ? battle.playerTeam : []);
  const opponentTeam = Array.isArray(d?.opponentTeam) ? d.opponentTeam : (Array.isArray(battle?.opponentTeam) ? battle.opponentTeam : []);
  const playerLine = uniqueTroopNames(playerTeam).join('、') || '未记录';
  const opponentLine = uniqueTroopNames(opponentTeam).join('、') || '未记录';
  const rewards = d?.rewards || battle?.rewards || {};
  const memorialPvpFieldLabel = d?.battleType === 'pvp_field' || !!rewards?.roadEncounterId;
  const scoreLines =
    buildBattleScoreFormulaLines(rewards?.scoreDetails, rewards?.battleScore, {
      finalMultiplierLabel: memorialPvpFieldLabel ? 'PVP积分倍率' : '攻城积分倍率',
    }).lines || [];
  const scoreDetails = rewards?.scoreDetails || null;
  const killTroops = scoreDetails?.killTroops ?? null;
  const lossTroops = scoreDetails?.lossTroops ?? null;
  const killScore = scoreDetails?.killScore ?? null;
  const lossScore = scoreDetails?.lossScore ?? null;
  const baseScore = scoreDetails?.baseScore ?? null;
  const turnM = scoreDetails?.turnMultiplier ?? null;
  const roundNum = scoreDetails?.roundNum ?? null;
  const scoreLineHtml = scoreLines.length > 0
    ? scoreLines
        .map((line) => String(line?.text || '').trim())
        .filter(Boolean)
        .map((text) => `<div style="margin:6px 0;">${text}</div>`)
        .join('')
    : '<div style="margin:2px 0;font-size:18px;">暂无完整计分步骤（该战报未写入 scoreDetails）</div>';
  const illusImg = illusUrl
    ? `<img src="${illusUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" />`
    : '';
  root.innerHTML = `
    <style>
      @font-face {
        font-family: 'JYHPHS';
        src: url('${fontWoff2Href}') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: block;
      }
    </style>
    <div style="position:relative;width:768px;height:1152px;overflow:hidden;">
      <div style="position:absolute;inset:0;background:#2a231c;">${illusImg}</div>
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.06);pointer-events:none;"></div>
      <div style="position:relative;z-index:1;box-sizing:border-box;min-height:1152px;height:100%;display:flex;flex-direction:column;padding:16px;gap:12px;">
        <div style="flex:0 0 auto;width:384px;box-sizing:border-box;align-self:flex-end;${MEMORIAL_PANEL}padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:36px;font-weight:700;${MEMORIAL_TEXT_MAIN}">战斗纪念图</div>
            <div style="margin-top:6px;font-size:20px;${MEMORIAL_TEXT_MUTE}">真三风云 · ${formatDateYMD(memorialDate)}</div>
          </div>
          <div style="font-size:52px;line-height:1;">${battle?.result === 'win' ? '🏆' : battle?.result === 'lose' ? '⚔️' : '📜'}</div>
        </div>
        <div style="flex:0 0 auto;width:384px;box-sizing:border-box;align-self:flex-end;${MEMORIAL_PANEL}padding:14px 16px;display:flex;flex-direction:column;">
          <div style="font-size:22px;font-weight:600;${MEMORIAL_TEXT_MAIN}">${formatMemorialPlayerLine(playerName, playerId)} vs ${memorialHtmlEscape(battle?.opponentName || '事件敌军')}</div>
          <div style="height:10px;flex-shrink:0;"></div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:20px;line-height:1.45;${MEMORIAL_TEXT_MAIN}">
            <div>结果：${battle?.result === 'win' ? '胜利' : battle?.result === 'lose' ? '失败' : '平局'}</div>
            <div>类型：${d?.battleType || battle?.battleType || '-'}</div>
            <div>我方阵容：${playerLine}</div>
            <div>敌方阵容：${opponentLine}</div>
          </div>
        </div>
        <div style="flex:0 0 auto;width:576px;height:504px;min-height:504px;max-height:504px;box-sizing:border-box;align-self:flex-start;${MEMORIAL_PANEL}padding:14px 16px;display:flex;flex-direction:column;font-size:18px;line-height:1.5;overflow:hidden;">
          <div style="font-weight:700;flex-shrink:0;font-size:22px;${MEMORIAL_TEXT_MAIN}">战斗评分 + 完整计分步骤</div>
          <div style="height:10px;flex-shrink:0;"></div>
          <div style="margin-bottom:12px;flex-shrink:0;">
            <div style="font-size:30px;font-weight:700;line-height:1.2;${MEMORIAL_TEXT_MAIN}">${grade} · ${score}分</div>
            <div style="margin-top:8px;font-size:18px;${MEMORIAL_TEXT_MUTE}">歼敌 ${killTroops ?? '-'} / 战损 ${lossTroops ?? '-'}（兵力）</div>
            <div style="margin-top:4px;font-size:18px;${MEMORIAL_TEXT_MUTE}">+${killScore ?? '-'} / ${lossScore ?? '-'}（评分）</div>
            <div style="margin-top:4px;font-size:18px;${MEMORIAL_TEXT_MUTE}">基础分 ${baseScore ?? '-'}</div>
            <div style="margin-top:4px;font-size:18px;${MEMORIAL_TEXT_MUTE}">回合倍率 ×${turnM ?? '-'}（第${roundNum ?? '-'}回合）</div>
          </div>
          <div style="height:1px;background:rgba(255,255,255,0.22);margin:0 0 12px 0;flex-shrink:0;"></div>
          <div style="font-size:18px;line-height:1.45;flex:1 1 auto;min-height:0;overflow:visible;${MEMORIAL_TEXT_MAIN}">${scoreLineHtml}</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  try {
    if (document.fonts?.load) {
      try {
        await document.fonts.load(`18px JYHPHS`);
      } catch {
        /* 字体文件缺失或路径错误时回退 Microsoft YaHei */
      }
    }
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    if (illusUrl) {
      await new Promise((r) => setTimeout(r, 120));
    }
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(root, {
      backgroundColor: '#1a1512',
      scale: 1,
      logging: false,
      useCORS: true,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob;
  } finally {
    root.remove();
  }
}

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
  const [mailClaimModal, setMailClaimModal] = useState({
    open: false,
    lines: [],
    title: '领取结果',
    modalType: 'reward',
  });

  // 战报状态
  const [battles, setBattles] = useState([]);
  const [battleFilter, setBattleFilter] = useState('all');
  const [battleLoading, setBattleLoading] = useState(false);
  const [expandedBattle, setExpandedBattle] = useState(null);
  const [battleDetail, setBattleDetail] = useState(null);
  const [battleMemorialQuota, setBattleMemorialQuota] = useState({ dailyLimit: 1, usedToday: 0, remaining: 1 });
  const [creatingMemorialBattleId, setCreatingMemorialBattleId] = useState(null);

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

  const loadBattleMemorialQuota = useCallback(async () => {
    if (!player?.player_id) return;
    const res = await battleAPI.getBattleMemorialQuota(player.player_id);
    if (res.success) setBattleMemorialQuota(res.data);
  }, [player?.player_id]);

  // 打开面板或切换筛选时加载
  useEffect(() => {
    if (open && activeTab === 'battle') {
      loadBattles();
      loadBattleMemorialQuota();
    }
  }, [open, activeTab, loadBattles, loadBattleMemorialQuota]);

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

  const handleCreateBattleMemorial = useCallback(async (battle, detail) => {
    if (!player?.player_id || !battle?.battleId) return;
    if ((battleMemorialQuota?.remaining ?? 0) <= 0) {
      setMailClaimModal({
        open: true,
        title: '提示',
        modalType: 'warning',
        lines: ['今日生成次数1/1，请明日再来'],
      });
      return;
    }
    try {
      setCreatingMemorialBattleId(battle.battleId);
      let finalDetail = detail;
      if (!finalDetail) {
        const r = await battleAPI.getBattleDetail(battle.battleId);
        if (r.success) finalDetail = r.battle;
      }
      const blob = await renderBattleMemorialBlob({
        playerName: player?.character_name || player?.player_id,
        playerId: player?.player_id,
        battle,
        detail: finalDetail,
      });
      if (!blob) throw new Error('图片生成失败');
      const imageBase64 = await blobToDataUrl(blob);
      const res = await battleAPI.createBattleMemorial({
        playerId: player.player_id,
        battleId: battle.battleId,
        imageBase64,
      });
      if (!res.success) {
        setMailClaimModal({
          open: true,
          title: '生成失败',
          modalType: 'warning',
          lines: [res.error || '生成失败'],
        });
        await loadBattleMemorialQuota();
        return;
      }
      setMailClaimModal({
        open: true,
        title: '生成成功',
        modalType: 'reward',
        lines: ['战斗纪念图已生成（今日次数 1/1）'],
      });
      await loadBattleMemorialQuota();
    } catch (error) {
      console.error('[CommPanel] 生成战斗纪念图失败:', error);
      setMailClaimModal({
        open: true,
        title: '生成失败',
        modalType: 'warning',
        lines: ['战斗纪念图生成失败，请稍后重试'],
      });
    } finally {
      setCreatingMemorialBattleId(null);
    }
  }, [player?.player_id, player?.character_name, battleMemorialQuota?.remaining, loadBattleMemorialQuota]);

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

  // 最小化入口按钮（传书 > 聊天 > 战报）
  if (!open) {
    const { icon, label, count, tab } = minimizedEntry;
    const suffix = count > 0 ? ` (${count})` : '';
    const chatBadge = Math.max(chatNotifyCount, unreadChatProp || 0);
    const showEmojiNotifyOutline = unreadTextCount > 0 || chatBadge > 0;
    /** 深红描边（text-shadow 模拟），便于在琥珀底上凸显左侧 emoji */
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
              setMailClaimModal({ open: true, lines, title: '领取结果', modalType: 'reward' })
            }
            onShowClaimError={(msg) =>
              setMailClaimModal({ open: true, lines: [msg], title: '领取失败', modalType: 'warning' })
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

/** 战报Tab */
function BattleTab({
  battles,
  filter,
  onFilterChange,
  loading,
  expandedBattle,
  battleDetail,
  onExpand,
  onToggleFavorite,
  memorialQuota,
  creatingMemorialBattleId,
  onCreateMemorial,
  playerId,
}) {
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
        <div className="text-[10px] text-amber-200/45 px-0.5">
          战斗纪念图：今日 {memorialQuota?.usedToday ?? 0}/{memorialQuota?.dailyLimit ?? 1}
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
            memorialQuota={memorialQuota}
            creatingMemorial={creatingMemorialBattleId === b.battleId}
            onCreateMemorial={() => onCreateMemorial(b, expandedBattle === b.battleId ? battleDetail : null)}
            playerId={playerId}
          />
        ))}
      </div>
    </div>
  );
}

/** 单条战报卡片 */
function BattleCard({
  battle,
  isExpanded,
  detail,
  onExpand,
  onToggleFavorite,
  memorialQuota,
  creatingMemorial,
  onCreateMemorial,
  playerId,
}) {
  const isWin = battle.result === 'win';
  const timeStr = formatRelativeTime(battle.battleAt);
  const todayMemorialBattleId = memorialRecordBattleId(memorialQuota?.todayRecord);
  const battleIdStr = battle.battleId != null ? String(battle.battleId).trim() : '';
  const isTodayMemorialBattle =
    Boolean(battleIdStr) && Boolean(todayMemorialBattleId) && todayMemorialBattleId === battleIdStr;
  const todayMemorialUrl = resolveMemorialFileUrl(memorialQuota?.todayRecord?.imageUrl || '');

  const handleDownloadTodayMemorial = async (e) => {
    e.stopPropagation();
    if (!todayMemorialUrl) return;
    const memorialRowId = memorialQuota?.todayRecord?.id;
    try {
      let response;
      if (playerId && memorialRowId) {
        const apiBase = String(API_CONFIG.BASE_URL || '').replace(/\/$/, '');
        const proxyUrl = `${apiBase}/memorial/battle/download?playerId=${encodeURIComponent(playerId)}&id=${encodeURIComponent(String(memorialRowId))}`;
        response = await fetchWithTimeout(proxyUrl, { cache: 'no-store' });
      } else {
        const bustUrl = `${todayMemorialUrl}${todayMemorialUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
        response = await fetch(bustUrl, { cache: 'no-store' });
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const pathOnly = todayMemorialUrl.split('?')[0];
      const seg = pathOnly.split('/').pop() || '';
      const filename = decodeURIComponent(seg) || `memorial_${battle.battleId || Date.now()}.png`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[BattleCard] 下载纪念图失败:', err);
      try {
        window.open(todayMemorialUrl, '_blank', 'noopener,noreferrer');
      } catch {
        /* ignore */
      }
    }
  };

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
            {battle.opponentName ||
              (battle.battleType === 'pve_campaign'
                ? '战役'
                : battle.battleType === 'pve_bandit'
                  ? '匪寨'
                  : '事件战斗')}
          </div>
          <div className="text-[10px] text-amber-200/50">
            评分：<span className={gradeColor}>{grade}</span> · {score}分
          </div>
          {isTodayMemorialBattle && (
            <div className="text-[10px] text-emerald-300/90 mt-0.5">
              🖼️ 今日已生成纪念图
              {todayMemorialUrl && (
                <button
                  type="button"
                  onClick={handleDownloadTodayMemorial}
                  className="ml-2 underline text-emerald-200 hover:text-emerald-100"
                >
                  点击下载
                </button>
              )}
            </div>
          )}
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
      {isExpanded && isTodayMemorialBattle && todayMemorialUrl && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={handleDownloadTodayMemorial}
            className="w-full py-1.5 rounded text-[10px] border border-emerald-600/45 bg-emerald-800/35 text-emerald-100 hover:bg-emerald-700/40 transition-colors"
          >
            🖼️ 下载今日纪念图
          </button>
        </div>
      )}
      {isExpanded && !isTodayMemorialBattle && (
        <div className="px-2 pb-2">
          <button
            type="button"
            disabled={(memorialQuota?.remaining ?? 0) <= 0 || creatingMemorial}
            title={(memorialQuota?.remaining ?? 0) <= 0 ? '今日生成次数1/1，请明日再来' : '将本场战报转为纪念图'}
            onClick={onCreateMemorial}
            className={`w-full py-1.5 rounded text-[10px] border transition-colors ${
              (memorialQuota?.remaining ?? 0) <= 0
                ? 'bg-gray-700/40 border-gray-500/30 text-gray-300/60 cursor-not-allowed'
                : 'bg-emerald-800/35 border-emerald-600/45 text-emerald-100 hover:bg-emerald-700/40'
            }`}
          >
            {creatingMemorial ? '纪念图生成中…' : '🖼️ 转为纪念图'}
          </button>
          {(memorialQuota?.remaining ?? 0) <= 0 && !isTodayMemorialBattle && (
            <div className="text-[10px] text-amber-200/35 mt-1 text-center">今日生成次数1/1，请明日再来</div>
          )}
        </div>
      )}
    </div>
  );
}

/** 战报详情展开区 */
function BattleDetail({ detail }) {
  const [replayOpen, setReplayOpen] = useState(false);
  const rewards = detail.rewards || {};
  const logRaw = detail.battleLog;
  const logStr = typeof logRaw === 'string' ? logRaw : Array.isArray(logRaw) ? logRaw.map((l) => (typeof l === 'object' && l?.text ? l.text : String(l))).join('\n') : '';
  /** 简化回放：左=攻方、右=守军（与棋盘「我方格」无关，只看战略攻守身份） */
  const isDefenseReport = detail.battleType === 'pvp_defense';
  const siegeLeftLabel = isDefenseReport
    ? `攻方${detail.opponentName ? ` · ${detail.opponentName}` : ''}`
    : '攻方';
  const siegeRightLabel = isDefenseReport
    ? '守军'
    : `守军${detail.opponentName ? ` · ${detail.opponentName}` : ''}`;
  const replayLogStr = isDefenseReport
    ? (typeof rewards.skirmishBattleLog === 'string' ? rewards.skirmishBattleLog : '')
    : logStr;
  const canSiegeReplay =
    replayLogStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(replayLogStr) &&
    /次攻击/.test(replayLogStr) &&
    /\[攻方\]/.test(replayLogStr);

  const usePvpFieldScoreMultiplierLabel =
    detail.battleType === 'pvp_field' || !!rewards.roadEncounterId;
  const scoreMultLineLabel = usePvpFieldScoreMultiplierLabel ? 'PVP积分倍率' : '攻城积分倍率';
  const formulaLines = useMemo(
    () =>
      buildBattleScoreFormulaLines(rewards.scoreDetails, rewards.battleScore, {
        finalMultiplierLabel: scoreMultLineLabel,
      }).lines,
    [rewards.scoreDetails, rewards.battleScore, scoreMultLineLabel],
  );
  const troopCounts = useMemo(
    () => resolveKillLossTroopCounts(rewards.scoreDetails),
    [rewards.scoreDetails],
  );

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
                  battleLog={replayLogStr}
                  leftLabel={siegeLeftLabel}
                  rightLabel={siegeRightLabel}
                  initialAttackerTroops={rewards.initialAttackerTroops}
                  initialDefenderTroops={rewards.initialDefenderTroops}
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
                歼敌 {troopCounts.killTroops != null ? troopCounts.killTroops : '—'} / 战损{' '}
                {troopCounts.lossTroops != null ? troopCounts.lossTroops : '—'}
                <span className="text-amber-200/30">（兵力）</span>
              </div>
              <div>
                +{rewards.scoreDetails.killScore} / {rewards.scoreDetails.lossScore}
                <span className="text-amber-200/30">（评分）</span>
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
                <div>
                  {scoreMultLineLabel} ×{rewards.scoreDetails.siegeScoreMultiplier}
                </div>
              )}
              {formulaLines.length > 0 && (
                <div className="mt-1 pt-1 border-t border-amber-700/15 space-y-0.5 text-[9px] text-amber-200/35 leading-snug">
                  <div className="text-amber-200/45">完整计分步骤</div>
                  {formulaLines.map((row, i) => (
                    <div key={i}>{row.text}</div>
                  ))}
                </div>
              )}
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
function TextMailTab({ playerId, onUnreadChange, onClaimed, onShowClaimResult, onShowClaimError }) {
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
        onShowClaimError?.(r.error || '领取失败');
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
        {/* 与 ChatTab 第一行（天下/势力/军团）同高同宽占位，使下一行「刷新」与聊天 Tab 对齐 */}
        <div className="invisible pointer-events-none flex px-1 py-0 gap-0.5 select-none" aria-hidden>
          <span className="flex-1 py-1 text-[10px] rounded text-center">天下</span>
          <span className="flex-1 py-1 text-[10px] rounded text-center">势力</span>
          <span className="flex-1 py-1 text-[10px] rounded text-center">军团</span>
        </div>
        <div className="flex justify-end px-1.5">
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
