/**
 * 势力 Tab —「势力信息」：官职、人数、城市摘要、五维档位、储备
 * 要职：五行两列（前三行同前；第四行四安|四平；第五行四镇|四征）。与 `factionOverviewService` OFFICE_SLOTS、`positions.json` 对齐。
 * 「规模」四段可点：`GET …/faction/overview` 的 `playersReal` / `playersNpc` / `legions` / `citiesList` 弹层列表（见 32-1 / 32-2）。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('zh-CN');
}

export function SectionTitle({ children }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">{children}</h3>;
}

export function Line({ children }) {
  return <div className="text-xs leading-snug text-stone-300">{children}</div>;
}

const CITY_TYPE_ZH = {
  city_major: '大城',
  city_medium: '中城',
  city_small: '小城',
  gate: '关隘',
  fort: '据点',
};

/** @param {{ positionName?: string|null, characterName?: string }} p */
function formatOfficeBracketLine(p) {
  const office = String(p?.positionName || '').trim() || '无官职';
  const name = String(p?.characterName || '').trim() || '…';
  return (
    <span className="text-stone-100">
      <span className="text-amber-200/95">[{office}]</span>
      {name}
    </span>
  );
}

/** @typedef {'playersReal'|'playersNpc'|'legions'|'cities'|null} ScaleOpenKey */

/** 与后端 OFFICE_SLOTS 顺序一致：每行两列（positionId） */
const OFFICE_GRID_ROWS = [
  ['san_1_position_junzhu', 'san_1_position_dasikong'],
  ['san_1_position_dajiangjun', 'san_1_position_dasima'],
  ['san_1_position_piaoqi', 'san_1_position_cheqi'],
  ['san_1_position_sian', 'san_1_position_siping'],
  ['san_1_position_sizhen', 'san_1_position_sizheng'],
];

function OfficeDutyGrid({ officeHolders }) {
  const byId = Object.fromEntries((officeHolders || []).map((o) => [o.positionId, o]));

  const cell = (pid) => {
    const o = byId[pid];
    if (!o) return '—';
    return `${o.label}：${o.characterName || '空缺'}`;
  };

  return (
    <div className="flex flex-col gap-1 text-xs leading-snug text-stone-300">
      {OFFICE_GRID_ROWS.map((pair, rowIdx) => (
        <div key={rowIdx} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="min-w-0 flex-1 text-left">{cell(pair[0])}</span>
          <span className="shrink-0 text-stone-600 select-none" aria-hidden>
            /
          </span>
          <span className="min-w-0 flex-1 text-left">{cell(pair[1])}</span>
        </div>
      ))}
    </div>
  );
}

function ScaleDetailPopover({ openKey, anchorRect, overview, onClose }) {
  useEffect(() => {
    if (!openKey) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKey, onClose]);

  if (!openKey || typeof document === 'undefined' || !anchorRect) return null;

  const pad = 8;
  const panelW = Math.min(280, window.innerWidth - pad * 2);
  let left = anchorRect.left;
  left = Math.max(pad, Math.min(left, window.innerWidth - panelW - pad));
  const maxH = Math.min(320, window.innerHeight * 0.5);
  let top = anchorRect.bottom + 6;
  if (top + maxH > window.innerHeight - pad) {
    top = Math.max(pad, anchorRect.top - maxH - 6);
  }

  const playersReal = overview?.playersReal || [];
  const playersNpc = overview?.playersNpc || [];
  const legions = overview?.legions || [];
  const citiesList = overview?.citiesList || [];

  let title = '';
  /** @type {import('react').ReactNode} */
  let body = null;

  if (openKey === 'playersReal') {
    title = '玩家列表';
    body =
      playersReal.length === 0 ? (
        <p className="text-stone-500">暂无真实账号玩家</p>
      ) : (
        <ul className="list-none space-y-1 pl-0.5">
          {playersReal.map((p) => (
            <li key={p.playerId} className="leading-snug">
              {formatOfficeBracketLine(p)}
            </li>
          ))}
        </ul>
      );
  } else if (openKey === 'playersNpc') {
    title = 'NPC玩家列表';
    body =
      playersNpc.length === 0 ? (
        <p className="text-stone-500">暂无 NPC 玩家</p>
      ) : (
        <ul className="list-none space-y-1 pl-0.5">
          {playersNpc.map((p) => (
            <li key={p.playerId} className="leading-snug">
              {formatOfficeBracketLine(p)}
            </li>
          ))}
        </ul>
      );
  } else if (openKey === 'legions') {
    title = '军团列表';
    body =
      legions.length === 0 ? (
        <p className="text-stone-500">暂无活跃军团</p>
      ) : (
        <ul className="list-none space-y-1.5 pl-0.5">
          {legions.map((lg) => (
            <li key={lg.legionId} className="leading-snug">
              <div className="text-stone-100">{lg.legionName}</div>
              <div className="text-[10px] text-stone-500">
                团长 {lg.commanderName || '—'} · 成员 {fmtNum(lg.memberCount)}
              </div>
            </li>
          ))}
        </ul>
      );
  } else if (openKey === 'cities') {
    title = '城市列表';
    body =
      citiesList.length === 0 ? (
        <p className="text-stone-500">暂无已占城市</p>
      ) : (
        <ul className="list-none space-y-1 pl-0.5">
          {citiesList.map((c) => (
            <li key={c.cityId} className="leading-snug">
              <span className="text-stone-400">{CITY_TYPE_ZH[c.cityType] || c.cityType}</span>
              <span className="mx-1 text-stone-600">·</span>
              <span className="text-stone-100">
                {(c.junName || c.zhouName || '—') + '-' + (c.cityName || c.cityId)}
              </span>
            </li>
          ))}
        </ul>
      );
  }

  const panel = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[130] cursor-default border-0 bg-black/45 p-0"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faction-scale-detail-title"
        className="fixed z-[131] max-h-[min(320px,50vh)] overflow-y-auto rounded-lg border border-amber-800/45 bg-stone-950/98 p-2.5 text-left text-xs text-stone-200 shadow-2xl backdrop-blur-sm"
        style={{ top, left, width: panelW, maxHeight: maxH }}
      >
        <div
          id="faction-scale-detail-title"
          className="mb-1.5 border-b border-amber-900/40 pb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500/95"
        >
          {title}
        </div>
        {body}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}

/**
 * @param {{ label: string, count: number, statKey: 'playersReal'|'playersNpc'|'legions'|'cities', activeKey: ScaleOpenKey, onOpen: (k: 'playersReal'|'playersNpc'|'legions'|'cities', el: HTMLElement) => void }} p
 */
function ScaleStatSeg({ label, count, statKey, activeKey, onOpen }) {
  const active = activeKey === statKey;
  return (
    <button
      type="button"
      className={`rounded px-0.5 text-left underline-offset-2 transition-colors hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 ${
        active ? 'text-amber-200' : 'text-stone-200 hover:text-amber-100/95'
      }`}
      onClick={(e) => onOpen(statKey, e.currentTarget)}
    >
      {label} {fmtNum(count)}
    </button>
  );
}

export default function FactionInfoPanel({ overview, loading, error }) {
  const [scaleOpenKey, setScaleOpenKey] = useState(/** @type {ScaleOpenKey} */ (null));
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const scaleAnchorElRef = useRef(/** @type {HTMLElement | null} */ (null));

  const closeScale = useCallback(() => {
    setScaleOpenKey(null);
    setAnchorRect(null);
    scaleAnchorElRef.current = null;
  }, []);

  const openScale = useCallback((key, el) => {
    scaleAnchorElRef.current = el;
    setScaleOpenKey((prev) => (prev === key ? null : key));
  }, []);

  useEffect(() => {
    if (!scaleOpenKey) {
      setAnchorRect(null);
      return undefined;
    }
    const sync = () => {
      const el = scaleAnchorElRef.current;
      setAnchorRect(el?.getBoundingClientRect?.() || null);
    };
    sync();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [scaleOpenKey]);

  if (loading) {
    return (
      <div className="flex min-h-[6rem] items-center justify-center text-stone-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return <p className="text-xs text-red-400/90">{error}</p>;
  }
  if (!overview) {
    return <p className="text-xs text-stone-500">暂无数据</p>;
  }

  const majorBlock =
    overview.citiesMajorLines?.length > 0
      ? overview.citiesMajorLines.join('；')
      : '—';
  const mediumBlock =
    overview.citiesMediumLines?.length > 0
      ? overview.citiesMediumLines.join('；')
      : '—';
  const formatZhouCounts = (arr) =>
    arr?.length > 0 ? arr.map((x) => `${x.zhouName}-${x.count}`).join('；') : '—';
  const smallBlock = formatZhouCounts(overview.citiesSmallByZhou);
  const gateBlock = formatZhouCounts(overview.citiesGateByZhou);
  const fortBlock = formatZhouCounts(overview.citiesFortByZhou);

  const t = overview.totals || {};
  const tierLabel = overview.supplyTier ? `${overview.supplyTier}档` : '无档';
  const fiveLine = `人口 ${fmtNum(t.population)} · 商业 ${fmtNum(t.trading)} · 农业 ${fmtNum(t.farming)} · 军事 ${fmtNum(t.military)} · 文化 ${fmtNum(t.culture)} → ${tierLabel}`;

  const reserveLine = `银两储备 ${fmtNum(overview.reserveSilver)} · 粮草储备 ${fmtNum(overview.reserveFood)}`;

  return (
    <div className="flex flex-col gap-3 text-left">
      <ScaleDetailPopover
        openKey={scaleOpenKey}
        anchorRect={anchorRect}
        overview={overview}
        onClose={closeScale}
      />
      <div>
        <SectionTitle>要职</SectionTitle>
        <OfficeDutyGrid officeHolders={overview.officeHolders} />
      </div>
      <div>
        <SectionTitle>规模</SectionTitle>
        <Line>
          <span className="inline-flex flex-wrap items-baseline gap-x-1">
            <ScaleStatSeg
              label="玩家数"
              count={overview.playerCountReal}
              statKey="playersReal"
              activeKey={scaleOpenKey}
              onOpen={openScale}
            />
            <span className="shrink-0 text-stone-600 select-none" aria-hidden>
              /
            </span>
            <ScaleStatSeg
              label="NPC玩家数"
              count={overview.playerCountNpc}
              statKey="playersNpc"
              activeKey={scaleOpenKey}
              onOpen={openScale}
            />
            <span className="shrink-0 text-stone-600 select-none" aria-hidden>
              /
            </span>
            <ScaleStatSeg
              label="军团数"
              count={overview.legionCount}
              statKey="legions"
              activeKey={scaleOpenKey}
              onOpen={openScale}
            />
            <span className="shrink-0 text-stone-600 select-none" aria-hidden>
              /
            </span>
            <ScaleStatSeg
              label="城市数"
              count={overview.cityCount}
              statKey="cities"
              activeKey={scaleOpenKey}
              onOpen={openScale}
            />
          </span>
        </Line>
      </div>
      <div>
        <SectionTitle>城市</SectionTitle>
        <Line>
          <span className="text-stone-500">大城：</span>
          {majorBlock}
        </Line>
        <Line>
          <span className="text-stone-500">中城：</span>
          {mediumBlock}
        </Line>
        <Line>
          <span className="text-stone-500">小城：</span>
          {smallBlock}
        </Line>
        <Line>
          <span className="text-stone-500">关隘：</span>
          {gateBlock}
        </Line>
        <Line>
          <span className="text-stone-500">据点：</span>
          {fortBlock}
        </Line>
      </div>
      <div>
        <SectionTitle>国力与储备</SectionTitle>
        <Line>{fiveLine}</Line>
        <div className="mt-0.5 text-xs leading-snug text-stone-300">{reserveLine}</div>
      </div>
    </div>
  );
}
