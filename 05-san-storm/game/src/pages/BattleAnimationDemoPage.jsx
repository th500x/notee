/**
 * 战术动画演示页：挂载小型地图与 6 支占位兵，调用 `useBattleEngine` 暴露的 `play*Demo`（不调正式回合）。
 * 「技能」与阶段4 相同的全屏闪与物/谋色相，经 `performSkillDemoStrike` → `strikeActiveSkillDamageOnce`，不扣阶段4次数。
 */
import { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { generateSmallMap } from '@shared/utils/mapGenerator';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import { initBattlePhase2Runtime } from '@shared/utils/skillPhase2Passive';
import { initBattlePhase3HealRuntime } from '@shared/utils/skillPhase3ActiveHeal';
import { initBattlePhase4DamageRuntime } from '@shared/utils/skillPhase4ActiveDamage';
import { initBattlePhase5CompositeRuntime } from '@shared/utils/skillPhase5CompositeDamage';
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { useBattleEngine } from '@/battle/tacticalBattleEngine';
import { createTacticalMapCardSurface } from '@/battle/tacticalMapCardSurface';
import { renderTroopsToBattleMapDom } from '@/battle/renderTroopsToBattleMapDom';
import BattleMap from '@/components/battle/BattleMap';
import BattleLog from '@/components/battle/BattleLog';
import '@/components/battle/BattleMap.css';

const BASE = import.meta.env.BASE_URL;

function buildStubTroop(slot, faction, pos, displayName) {
  const rarity = 'common';
  const troopType = 'infantry';
  const weaponType = 'melee';
  const meta = {
    id: `demo_cfg_${faction}_${slot}`,
    name: displayName,
    rarity,
    troopType,
    weaponType,
    faction,
  };
  const attempts = getBattleFieldTroopPortraitUrlAttempts(meta, BASE);
  const maxTroops = 500;
  return {
    ...meta,
    id: `demo_${faction}_${slot}`,
    y: pos.y,
    x: pos.x,
    attack: 55,
    defense: 45,
    speed: 50,
    movement: 3,
    range: 1,
    maxTroops,
    currentTroops: maxTroops,
    initialTroops: maxTroops,
    faction,
    displayName,
    morale: 75,
    character: null,
    imgSrc: attempts[0],
    imgPortraitAttempts: attempts,
    imgFallback: attempts[attempts.length - 1],
  };
}

/** 与 `play*Demo` 下标约定一致：0–2 我方，3–5 敌方 */
function buildDemoBattleTroops(mapResult) {
  const positions = [
    { y: 8, x: 1 }, { y: 8, x: 4 }, { y: 8, x: 7 },
    { y: 0, x: 1 }, { y: 0, x: 4 }, { y: 1, x: 3 },
  ];
  const troops = [
    buildStubTroop(0, 'player', positions[0], '演示·我军甲'),
    buildStubTroop(1, 'player', positions[1], '演示·我军乙'),
    buildStubTroop(2, 'player', positions[2], '演示·我军丙'),
    buildStubTroop(0, 'enemy', positions[3], '演示·敌军甲'),
    buildStubTroop(1, 'enemy', positions[4], '演示·敌军乙'),
    buildStubTroop(2, 'enemy', positions[5], '演示·敌军丙'),
  ];
  const { w, h } = getMapTerrainDimensions(mapResult);
  initBattlePhase2Runtime(troops);
  initBattlePhase3HealRuntime(troops, h, w);
  initBattlePhase4DamageRuntime(troops, h, w);
  initBattlePhase5CompositeRuntime(troops, h, w);
  return troops;
}

export default function BattleAnimationDemoPage() {
  const mapCardRef = useRef(null);
  const battleSurfaceRef = useRef(null);
  battleSurfaceRef.current = createTacticalMapCardSurface(mapCardRef);
  const manualBattleRef = useRef(null);

  const [mapResult, setMapResult] = useState(null);
  const [mapLabel, setMapLabel] = useState('');
  const [battleTroops, setBattleTroops] = useState([]);
  const [battlePlaying, setBattlePlaying] = useState(false);
  const [roundNum, setRoundNum] = useState(0);
  const [logs, setLogs] = useState([]);
  const [silverAmount, setSilverAmount] = useState(100);
  const [activeFormation, setActiveFormation] = useState(null);
  const [autoBattle] = useState(false);
  const [autoFormation] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState('auto');

  const addLog = useCallback((text, cls = '') => {
    setLogs((prev) => [...prev, { text, cls, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    const r = generateSmallMap({ battleRarity: 'common', forceComplexity: 'standard' });
    r.meta.battleRarity = 'common';
    setMapResult(r);
    setMapLabel(`动画演示 · 种子 ${r.meta.seed}`);
    setBattleTroops(buildDemoBattleTroops(r));
  }, []);

  const engine = useBattleEngine({
    battleTroops,
    setBattleTroops,
    mapResult,
    addLog,
    setLogs,
    battlePlaying,
    setBattlePlaying,
    roundNum,
    setRoundNum,
    silverAmount,
    setSilverAmount,
    activeFormation,
    setActiveFormation,
    autoBattle,
    autoFormation,
    mapCardRef,
    battleSurfaceRef,
    manualBattleRef,
    setBattleEndReason: null,
  });

  const resetTroops = useCallback(() => {
    if (!mapResult) return;
    setBattleTroops(buildDemoBattleTroops(mapResult));
  }, [mapResult]);

  useEffect(() => {
    if (!mapResult || battleTroops.length < 6 || !mapCardRef.current) return;
    requestAnimationFrame(() => {
      renderTroopsToBattleMapDom(mapCardRef, battleTroops, BASE);
    });
  }, [mapResult, battleTroops]);

  const syncLayoutWidth = useCallback(() => {
    const el = mapCardRef.current;
    if (el?.offsetWidth) setLayoutWidth(`${el.offsetWidth}px`);
  }, []);

  useLayoutEffect(() => {
    syncLayoutWidth();
  }, [mapResult, syncLayoutWidth]);

  useEffect(() => {
    const el = mapCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncLayoutWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapResult, syncLayoutWidth]);

  const btnClass =
    'px-3 py-2 rounded-lg text-sm font-medium bg-amber-700/90 text-amber-50 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/50';

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-stone-100 pb-16">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-amber-100">战斗动画 Demo</h1>
          <p className="text-sm text-stone-400 mt-1 leading-relaxed">
            仅供调 UI / 飘字 / 震屏；数据为占位部队。下方按钮对应引擎内 <code className="text-amber-200/90">play*Demo</code>；
            「技能」与阶段4 一致（白/天青闪底 + 物白或谋色飘字），经 <code className="text-amber-200/90">performSkillDemoStrike</code>，不消耗正式技能次数。
          </p>
        </div>

        {mapResult && battleTroops.length >= 6 && (
          <div className="battle-page space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                className={btnClass}
                disabled={battlePlaying}
                onClick={() => { engine.playAtkDemo(); }}
              >
                普攻演示
              </button>
              <button
                type="button"
                className={btnClass}
                disabled={battlePlaying}
                onClick={() => { engine.playCritDemo(); }}
              >
                暴击演示
              </button>
              <button
                type="button"
                className={btnClass}
                disabled={battlePlaying}
                onClick={() => { engine.playMissDemo(); }}
              >
                闪避演示
              </button>
              <button
                type="button"
                className={btnClass}
                disabled={battlePlaying}
                onClick={() => { engine.playSkillDemo(); }}
              >
                技能演示（物/谋）
              </button>
              <button
                type="button"
                className={btnClass}
                disabled={battlePlaying}
                onClick={() => { engine.playRangedDemo(); }}
              >
                远程演示
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-700 text-stone-200 hover:bg-stone-600 disabled:opacity-40 border border-stone-500/50"
                disabled={battlePlaying}
                onClick={resetTroops}
              >
                重置兵力
              </button>
            </div>

            <BattleMap
              mapResult={mapResult}
              mapLabel={mapLabel}
              battleTroops={battleTroops}
              showTroops={false}
              isBattle
              roundNum={0}
              mapCardRef={mapCardRef}
              autoBattle={false}
            />

            <BattleLog logs={logs} visible={logs.length > 0} maxWidth={layoutWidth} />
          </div>
        )}

        {!mapResult && (
          <p className="text-stone-500 text-sm">正在生成地图…</p>
        )}
      </div>
    </div>
  );
}
