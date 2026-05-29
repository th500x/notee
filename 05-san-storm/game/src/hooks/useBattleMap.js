/**
 * 战斗地图 Hook
 * 
 * 管理地图生成、部队加载/分配、战斗流程状态
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSmallMap } from '@shared/utils/mapGenerator';
import {
  buildSmallMapEnemyRosterPicks,
  filterTroopsForSmallMapPveEnemy,
  eventCardRarityToBanditTier,
  banditTierSlotRarities,
} from '@shared/utils/smallMapEnemyRoster';
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { API_CONFIG } from '@/constants';
import { initialMoraleFromCharacter } from '@/utils/npcMorale';
import { enrichBattleUnitWithSkillPhases } from '@shared/utils/battleSkillAssembly';
import { initBattlePhase2Runtime } from '@shared/utils/skillPhase2Passive';
import { initBattlePhase3HealRuntime } from '@shared/utils/skillPhase3ActiveHeal';
import { initBattlePhase4DamageRuntime } from '@shared/utils/skillPhase4ActiveDamage';
import { initBattlePhase5CompositeRuntime } from '@shared/utils/skillPhase5CompositeDamage';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import {
  buildTroopCatalogById,
  flattenPlayerUnitToBattleTroop,
} from '@shared/utils/resolveTroopBattleCaps';
import { fetchWithTimeout } from '@/services/httpClient';
const base = () => import.meta.env.BASE_URL;

/** 战斗地图部队图标：`san_1_battle/player|enemy/`（与 TroopLayer 一致） */
function getTroopImg(troop) {
  const attempts = getBattleFieldTroopPortraitUrlAttempts(troop, base());
  return attempts[0] || '';
}

/** 第二顺位 URL（稀有度通用图，与 getBattleFieldTroopPortraitUrlAttempts 链一致） */
export function getTroopImgFallback(troop) {
  const attempts = getBattleFieldTroopPortraitUrlAttempts(troop, base());
  return attempts[attempts.length - 1] || '';
}

export function useBattleMap() {
  // ── 地图状态 ──
  const [mapResult, setMapResult] = useState(null);
  const [mapLabel, setMapLabel] = useState('');
  const [currentRarity, setCurrentRarity] = useState('common');
  const [seedInput, setSeedInput] = useState('');

  // ── 部队状态 ──
  const [allTroops, setAllTroops] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [battleTroops, setBattleTroops] = useState([]);

  // ── 战斗状态 ──
  const [isBattle, setIsBattle] = useState(false);
  const [showTroops, setShowTroops] = useState(true);
  const [battlePlaying, setBattlePlaying] = useState(false);
  const [roundNum, setRoundNum] = useState(0);
  const [logs, setLogs] = useState([]);
  /** 与 logs 同步追加，供战后结算写库时读取（避免仅依赖 setState 时序导致战报截断） */
  const battleLogsSyncRef = useRef([]);
  /** 开战瞬间敌方编制数；战报击杀 = 此值 − 仍有兵力的敌方编制数 */
  const initialEnemyStackCountRef = useRef(null);
  const prevBattlePlayingRef = useRef(false);
  const [silverAmount, setSilverAmount] = useState(100);
  const [activeFormation, setActiveFormation] = useState(null);

  /** 战斗结束原因：'max_rounds' | 'min_rounds' | 'campaign_boss_win' | 'campaign_hero_loss' | null */
  const [battleEndReason, setBattleEndReason] = useState(null);

  // ── 自动战斗/阵型 ──
  const [autoBattle, setAutoBattle] = useState(() => localStorage.getItem('san_autoBattle') === 'true');
  const [autoFormation, setAutoFormation] = useState(() => localStorage.getItem('san_autoFormation') === 'true');

  // ── 日志 ──
  const addLog = useCallback((text, cls = '') => {
    const entry = { text, cls, id: Date.now() + Math.random() };
    battleLogsSyncRef.current = [...battleLogsSyncRef.current, entry];
    setLogs((prev) => [...prev, entry]);
  }, []);

  useEffect(() => {
    if (battlePlaying && !prevBattlePlayingRef.current) {
      initialEnemyStackCountRef.current = battleTroops.filter((t) => t.faction === 'enemy').length;
    }
    prevBattlePlayingRef.current = battlePlaying;
  }, [battlePlaying, battleTroops]);

  // ── 从API加载部队/将领 ──
  useEffect(() => {
    const load = async () => {
      try {
        const [troopRes, charRes] = await Promise.all([
          fetchWithTimeout(`${API_CONFIG.BASE_URL}/config/troops?season=san_1`),
          fetchWithTimeout(`${API_CONFIG.BASE_URL}/config/characters?season=san_1`),
        ]);
        const troopData = await troopRes.json();
        const charData = await charRes.json();
        if (troopData.success && troopData.troops) setAllTroops(troopData.troops);
        if (charData.success && charData.characters) setAllCharacters(charData.characters);
      } catch (err) {
        console.error('[API] 加载失败:', err);
      }
    };
    load();
  }, []);

  // ── 分配战场部队（真实编组 + 事件稀有度敌方） ──
  /**
   * @param {Array} playerUnits - 我方单位（1~5个）
   * @param {string} eventRarity - 事件稀有度（common/rare/epic/legendary/core）；无 enemySlotRarities 时映射为匪寨档四槽（core→legendary 档）
   * @param {object} [opts]
   * @param {string[]} [opts.enemySlotRarities] - 长度 4 时每槽独立稀有度（匪寨等）；与 5 将领位惩罚战互斥
   * @param {boolean} [opts.eventPunishmentExtraSlot] - 探索事件惩罚战：选项因子为 type-b 时在默认 4 编制上多 1 支部队（将领/部队池同事件稀有度，无指定主将 ID）
   */
  const assignRealBattleTroops = useCallback((playerUnits, eventRarity = 'common', opts = {}) => {
    const t = filterTroopsForSmallMapPveEnemy(allTroops);
    const c = allCharacters;
    const rawExtra = opts.extraEnemyCharacterIds;
    const extraIds = (Array.isArray(rawExtra) ? rawExtra : rawExtra ? [rawExtra] : []).filter(Boolean);
    const useFiveEnemy = extraIds.length > 0 || opts.eventPunishmentExtraSlot === true;

    // 我方位置（最多5个，前排优先部署）
    const playerPositions = [
      { y: 8, x: 1 }, { y: 8, x: 4 }, { y: 8, x: 7 },
      { y: 9, x: 2 }, { y: 9, x: 5 },
    ];
    // 敌方位置：默认 4 支；指定额外将领（事件 punishment 5v5）时为 5 支
    const enemyPositions = useFiveEnemy
      ? [
          { y: 0, x: 1 }, { y: 0, x: 4 }, { y: 0, x: 7 },
          { y: 1, x: 2 }, { y: 1, x: 5 },
        ]
      : [
          { y: 0, x: 1 }, { y: 0, x: 5 },
          { y: 1, x: 3 }, { y: 1, x: 7 },
        ];
    const enemyCount = useFiveEnemy ? 5 : 4;

    const catalogById = buildTroopCatalogById(allTroops);
    const playerResult = playerUnits.slice(0, 5).map((unit, i) =>
      flattenPlayerUnitToBattleTroop(unit, i, {
        pos: playerPositions[i],
        catalogById,
        baseUrl: base(),
        getPortraitAttempts: (trMeta, bUrl) =>
          getBattleFieldTroopPortraitUrlAttempts(trMeta, bUrl),
      }),
    );

    // ── 敌方：按事件稀有度从配置池选将领 + 部队（可选：指定额外敌方将领 → 5 部队 / 3 将领位） ──
    const rarityMap = { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary', core: 'core' };
    let targetRarity = rarityMap[eventRarity] || 'common';
    // 与匪寨 legendary 档一致：核心难度按传奇池抽卡（非抽 core 段）
    if (targetRarity === 'core') targetRarity = 'legendary';
    const mixedSlots =
      !useFiveEnemy && Array.isArray(opts.enemySlotRarities) && opts.enemySlotRarities.length === 4;

    let enemyChars;
    let enemyTroopConfigs;
    if (useFiveEnemy) {
      const forced = [];
      const forcedIds = new Set();
      for (const id of extraIds) {
        const found = c.find((ch) => ch.id === id);
        if (found && !forcedIds.has(found.id)) {
          forcedIds.add(found.id);
          forced.push(found);
        }
      }
      const charPool = c.filter((ch) => ch.rarity === targetRarity && !forcedIds.has(ch.id));
      const charSrc = charPool.length >= 1 ? charPool : c.filter((ch) => !forcedIds.has(ch.id));
      const shuffled = [...charSrc].sort(() => Math.random() - 0.5);
      enemyChars = [...forced];
      let si = 0;
      while (enemyChars.length < 3) {
        const pick = shuffled[si % shuffled.length];
        if (!pick) break;
        if (!enemyChars.some((ec) => ec && ec.id === pick.id)) enemyChars.push(pick);
        si += 1;
        if (si > shuffled.length * 4) break;
      }
      while (enemyChars.length < 3) enemyChars.push(shuffled[0] || null);
      const troopPool = t.filter((tr) => tr.rarity === targetRarity);
      const troopSrc = troopPool.length > 0 ? troopPool : t;
      const shuffledTroops = [...troopSrc].sort(() => Math.random() - 0.5);
      enemyTroopConfigs = [];
      for (let i = 0; i < enemyCount; i++) {
        enemyTroopConfigs.push(shuffledTroops[i % shuffledTroops.length]);
      }
    } else if (mixedSlots) {
      const picks = buildSmallMapEnemyRosterPicks(t, c, opts.enemySlotRarities);
      enemyChars = picks.pairChars;
      enemyTroopConfigs = picks.troops;
    } else {
      const tier = eventCardRarityToBanditTier(eventRarity);
      const slotRarities = banditTierSlotRarities(tier);
      const picks = buildSmallMapEnemyRosterPicks(t, c, slotRarities);
      enemyChars = picks.pairChars;
      enemyTroopConfigs = picks.troops;
    }

    const enemyResult = enemyTroopConfigs.map((tr, i) => {
      const pos = enemyPositions[i];
      // 2 将领：各带 2 部队；3 将领（5 部队）：0,1 / 2,3 / 4
      const char = enemyChars[Math.floor(i / 2)] || null;
      const charBase = char
        ? {
            name: char.courtesyName || char.name,
            courtesyName: char.courtesyName || char.name,
            luck: char.luck,
            courage: char.courage,
            combat: char.combat,
            command: char.command,
            intelligence: char.intelligence,
            politics: char.politics,
            charm: char.charm,
            trait: char.trait,
            traitModifier: char.traitModifier ?? char.trait_modifier ?? 0,
          }
        : null;
      const { troop: enrichedTroop, character: charForBattle } = enrichBattleUnitWithSkillPhases({
        troop: tr,
        character: charBase,
        skillIdSource: char,
        skillsMap: opts.skillsMap,
      });
      const morale = initialMoraleFromCharacter(char);
      const attempts = getBattleFieldTroopPortraitUrlAttempts({ ...tr, faction: 'enemy' }, base());
      return {
        ...enrichedTroop,
        id: tr.id + '_e' + i,
        faction: 'enemy',
        y: pos.y,
        x: pos.x,
        currentTroops: tr.maxTroops,
        initialTroops: tr.maxTroops,
        character: charForBattle,
        displayName: char ? (char.courtesyName || char.name) : tr.name,
        morale,
        imgSrc: attempts[0],
        imgPortraitAttempts: attempts,
        imgFallback: attempts[attempts.length - 1],
      };
    });

    const result = [...playerResult, ...enemyResult];
    initBattlePhase2Runtime(result);
    const { w: tw, h: th } = getMapTerrainDimensions(mapResult);
    initBattlePhase3HealRuntime(result, th, tw);
    initBattlePhase4DamageRuntime(result, th, tw);
    initBattlePhase5CompositeRuntime(result, th, tw);
    setBattleTroops(result);
    return result;
  }, [allTroops, allCharacters]);

  // API数据加载后不再自动分配部队（由 EventBattle 调用 assignRealBattleTroops）

  // ── 生成地图 ──
  const generate = useCallback((forceComplexity) => {
    const CL = { simple: '简洁', standard: '标准', complex: '复杂' };
    const RL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const r = generateSmallMap({ battleRarity: currentRarity, forceComplexity });
    r.meta.battleRarity = currentRarity;
    const label = forceComplexity
      ? `${CL[forceComplexity]}地图 · ${RL[currentRarity] || currentRarity}`
      : `随机地图 · ${RL[currentRarity] || currentRarity}`;
    setMapResult(r);
    setMapLabel(label);
    setSeedInput(String(r.meta.seed));
    return r;
  }, [currentRarity]);

  const generateWithSeed = useCallback(() => {
    const RL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const seed = seedInput.trim() ? parseInt(seedInput) : null;
    const r = generateSmallMap({ seed, battleRarity: currentRarity });
    r.meta.battleRarity = currentRarity;
    setMapResult(r);
    setMapLabel(`种子复现 #${r.meta.seed} · ${RL[currentRarity] || currentRarity}`);
    setSeedInput(String(r.meta.seed));
  }, [seedInput, currentRarity]);

  // ── 战斗切换 ──
  const toggleBattle = useCallback(() => {
    setIsBattle(prev => {
      if (prev) {
        battleLogsSyncRef.current = [];
        setLogs([]); setRoundNum(0); setActiveFormation(null); setBattleEndReason(null);
      }
      return !prev;
    });
  }, [setBattleEndReason]);

  const toggleTroops = useCallback(() => setShowTroops(prev => !prev), []);

  // ── 自动战斗/阵型 toggle ──
  const toggleAutoBattle = useCallback((val) => {
    setAutoBattle(val);
    localStorage.setItem('san_autoBattle', val);
  }, []);
  const toggleAutoFormation = useCallback((val) => {
    setAutoFormation(val);
    localStorage.setItem('san_autoFormation', val);
  }, []);

  return {
    // 地图（战役模式可 setMapResult 写入切片，不必 generateSmallMap）
    mapResult, setMapResult, mapLabel, setMapLabel, currentRarity, setCurrentRarity, seedInput, setSeedInput,
    generate, generateWithSeed,
    // 部队
    allTroops, allCharacters, battleTroops, setBattleTroops, assignRealBattleTroops,
    // 战斗
    isBattle, toggleBattle, showTroops, toggleTroops,
    battleEndReason, setBattleEndReason,
    battlePlaying, setBattlePlaying, roundNum, setRoundNum,
    logs, addLog, setLogs, battleLogsSyncRef, initialEnemyStackCountRef,
    silverAmount, setSilverAmount,
    activeFormation, setActiveFormation,
    autoBattle, toggleAutoBattle, autoFormation, toggleAutoFormation,
    // utils
    getTroopImg: getTroopImg,
  };
}
