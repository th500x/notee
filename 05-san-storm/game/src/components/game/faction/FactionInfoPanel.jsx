/**
 * 势力 Tab —「势力信息」：官职、人数、城市摘要、五维档位、储备
 * 要职：三行两列（君主|大司空 / 大将军|大司马 / 骠骑|车骑）；君主名 = `faction_leader` → `config_characters.character_name`（`faction_name` 为势力名）
 */

function fmtNum(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('zh-CN');
}

function SectionTitle({ children }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">{children}</h3>;
}

function Line({ children }) {
  return <div className="text-xs leading-snug text-stone-300">{children}</div>;
}

/** 与后端 OFFICE_SLOTS 顺序对应的 UI 三行两列（positionId） */
const OFFICE_GRID_ROWS = [
  ['san_1_position_junzhu', 'san_1_position_dasikong'],
  ['san_1_position_dajiangjun', 'san_1_position_dasima'],
  ['san_1_position_piaoqi', 'san_1_position_cheqi'],
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

export default function FactionInfoPanel({ overview, loading, error }) {
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

  const countsLine = `玩家数 ${fmtNum(overview.playerCountReal)} / NPC玩家数 ${fmtNum(overview.playerCountNpc)} / 军团数 ${fmtNum(overview.legionCount)} / 城市数 ${fmtNum(overview.cityCount)}`;

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
      <div>
        <SectionTitle>要职</SectionTitle>
        <OfficeDutyGrid officeHolders={overview.officeHolders} />
      </div>
      <div>
        <SectionTitle>规模</SectionTitle>
        <Line>{countsLine}</Line>
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
