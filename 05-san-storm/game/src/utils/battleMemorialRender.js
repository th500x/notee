/**
 * 战斗纪念图 DOM 渲染与 html2canvas 导出（原 CommPanel.jsx）。
 */
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { buildBattleScoreFormulaLines } from '@/systems/battleScoreSystem';

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

export {
  blobToDataUrl,
  renderBattleMemorialBlob,
  memorialRecordBattleId,
  resolveMemorialFileUrl,
};
