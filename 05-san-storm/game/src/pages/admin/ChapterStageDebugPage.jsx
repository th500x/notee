/**
 * 章节关卡 · 可变尺寸生图调试页（P1）
 * 路由：/chapter-stage-debug
 *
 * 复用：generateChapterStageMap → CampaignMapGrid 预览 → LargeMapBattle（recordOnly）
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateChapterStageMap } from '@shared/utils/chapterStageMapGenerator.js';
import {
  YINGCHUAN_STAGE_DRAFTS,
  getYingchuanStageDraft,
} from '@shared/data/chapter/yingchuanStageDrafts.js';
import { loadSharedData } from '@/services/dataService';
import AdminPageGate from '@/components/admin/AdminPageGate';
import LargeMapBattle from '@/components/campaign/LargeMapBattle';
import CampaignMapGrid from '@/components/campaign/CampaignMapGrid';

/** 调试编组：从部队库取前若干条，形状对齐 buildPlayerUnitsFromContext / flattenPlayerUnitToBattleTroop */
function buildDebugPlayerUnits(troopsList, count = 2) {
  const list = Array.isArray(troopsList) ? troopsList : [];
  const picks = list.filter((t) => t?.id && String(t.id).startsWith('san_1_troop_')).slice(0, count);
  const fallback = list.slice(0, count);
  const chosen = picks.length >= count ? picks : fallback;
  return chosen.map((tr, i) => {
    const maxTroops = Math.max(1, Math.round(Number(tr.maxTroops ?? tr.max_troops) || 80));
    const cur = Math.min(maxTroops, Math.round(maxTroops * 0.85));
    return {
      troop: {
        id: tr.id,
        instanceId: `debug_inst_${i}`,
        name: tr.name || tr.id,
        rarity: tr.rarity || 'common',
        troopType: tr.troopType || tr.troop_type,
        weaponType: tr.weaponType || tr.weapon_type,
        attack: Number(tr.attack) || 10,
        defense: Number(tr.defense) || 10,
        speed: Number(tr.speed) || 5,
        movement: Number(tr.movement) || 3,
        range: Number(tr.range) || 1,
        maxTroops,
        troopWeight: tr.troopWeight || tr.troop_weight || 1,
        skills: tr.skills || [],
        infantryCounter: tr.infantryCounter ?? tr.infantry_counter ?? 1,
        cavalryCounter: tr.cavalryCounter ?? tr.cavalry_counter ?? 1,
        archerCounter: tr.archerCounter ?? tr.archer_counter ?? 1,
        siegeCounter: tr.siegeCounter ?? tr.siege_counter ?? 1,
        plainAdapt: tr.plainAdapt ?? tr.plain_adapt ?? 1,
        hillAdapt: tr.hillAdapt ?? tr.hill_adapt ?? 1,
        forestAdapt: tr.forestAdapt ?? tr.forest_adapt ?? 1,
        siegeAdapt: tr.siegeAdapt ?? tr.siege_adapt ?? 1,
      },
      character: null,
      currentTroops: cur,
      maxTroops,
      morale: 70,
    };
  });
}

function ChapterStageDebugInner() {
  const [stageId, setStageId] = useState(YINGCHUAN_STAGE_DRAFTS[0].stage_id);
  const [seedInput, setSeedInput] = useState('');
  const [error, setError] = useState('');
  const [sim, setSim] = useState(null);
  const [skillsMap, setSkillsMap] = useState(null);
  const [troopsList, setTroopsList] = useState([]);
  const [inBattle, setInBattle] = useState(false);
  const [battleKey, setBattleKey] = useState(0);

  const stage = useMemo(
    () => getYingchuanStageDraft(stageId) || YINGCHUAN_STAGE_DRAFTS[0],
    [stageId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [skillsData, troopsData] = await Promise.all([
          loadSharedData('skills'),
          loadSharedData('troops'),
        ]);
        if (cancelled) return;
        const skillList = Array.isArray(skillsData) ? skillsData : skillsData?.skills || [];
        const map = {};
        for (const s of skillList) {
          if (s?.id) map[s.id] = s;
        }
        if (Object.keys(map).length === 0) map.__debug = { id: '__debug' };
        setSkillsMap(map);
        const tList = Array.isArray(troopsData) ? troopsData : troopsData?.troops || [];
        setTroopsList(tList);
      } catch {
        if (!cancelled) {
          setSkillsMap({ __debug: { id: '__debug' } });
          setTroopsList([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const regenerate = useCallback(() => {
    setError('');
    setInBattle(false);
    try {
      const parsed = seedInput.trim() === '' ? undefined : Number(seedInput);
      const result = generateChapterStageMap(stage, {
        seed: Number.isFinite(parsed) ? parsed : undefined,
      });
      setSim(result);
      setSeedInput(String(result.seed));
    } catch (e) {
      setSim(null);
      setError(e?.message || String(e));
    }
  }, [stage, seedInput]);

  useEffect(() => {
    setError('');
    setInBattle(false);
    try {
      const result = generateChapterStageMap(stage, {});
      setSim(result);
      setSeedInput(String(result.seed));
    } catch (e) {
      setSim(null);
      setError(e?.message || String(e));
    }
  }, [stage]);

  const playerUnits = useMemo(() => buildDebugPlayerUnits(troopsList, 2), [troopsList]);

  const enterBattle = useCallback(() => {
    if (!sim || !skillsMap || playerUnits.length === 0) return;
    setBattleKey((k) => k + 1);
    setInBattle(true);
  }, [sim, skillsMap, playerUnits.length]);

  return (
    <div className="p-4 max-w-6xl mx-auto text-stone-800 space-y-3">
      <h1 className="text-lg font-semibold text-amber-900">章节关卡 · 生图调试（P1）</h1>
      <p className="text-sm text-stone-600">
        可变尺寸程序生图 + CampaignMapGrid / LargeMapBattle。正式入口与兵符见设计文档 60-1；本页仅开发验收。
      </p>

      <div className="flex flex-wrap gap-2 items-end text-sm">
        <label className="flex flex-col gap-1">
          <span>关卡</span>
          <select
            className="border border-amber-800/30 rounded px-2 py-1 bg-white"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            {YINGCHUAN_STAGE_DRAFTS.map((s) => (
              <option key={s.stage_id} value={s.stage_id}>
                {s.stage_name}（{s.map_w}×{s.map_h}）
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>seed</span>
          <input
            className="border border-amber-800/30 rounded px-2 py-1 w-36 bg-white"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-amber-800 text-amber-50 hover:bg-amber-700"
          onClick={regenerate}
        >
          重新生图
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-amber-800/40 text-amber-900 disabled:opacity-40"
          disabled={!sim || !skillsMap || playerUnits.length === 0}
          onClick={enterBattle}
        >
          进入调试战斗
        </button>
      </div>

      {error ? <div className="text-sm text-red-700 whitespace-pre-wrap">{error}</div> : null}
      {!error && playerUnits.length === 0 && troopsList.length === 0 ? (
        <div className="text-sm text-amber-800">正在加载部队库…</div>
      ) : null}

      {sim && !inBattle ? (
        <div className="space-y-2">
          <div className="text-xs text-stone-500">
            {sim.width}×{sim.height} · seed {sim.seed} · pattern {stage.deploy_pattern} · 部署区{' '}
            {sim.deployRects?.player
              ? `${sim.deployRects.player.cols}×${sim.deployRects.player.rows}`
              : '-'}
          </div>
          <CampaignMapGrid
            cells={sim.cells}
            seed={sim.seed}
            title={`${stage.stage_name}（预览）`}
            deployRect={sim.deployRects?.player}
            deploymentMode
            showStaticNpcUnits
          />
        </div>
      ) : null}

      {inBattle && sim && skillsMap && playerUnits.length > 0 ? (
        <LargeMapBattle
          key={battleKey}
          playerUnits={playerUnits}
          skillsMap={skillsMap}
          campaignMapSim={sim}
          playerDeployRect={sim.deployRects.player}
          campaignPreset={{ campaign_id: stage.stage_id }}
          campaignId={stage.stage_id}
          campaignBattleTitle={stage.stage_name}
          opponentName="章节敌军"
          maxRounds={stage.max_rounds || 30}
          recordOnly
          onBattleEnd={() => setInBattle(false)}
        />
      ) : null}
    </div>
  );
}

export default function ChapterStageDebugPage() {
  return (
    <AdminPageGate>
      <ChapterStageDebugInner />
    </AdminPageGate>
  );
}
