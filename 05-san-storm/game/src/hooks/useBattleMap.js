/**
 * 战斗地图 Hook
 * 
 * 管理地图生成、部队加载/分配、战斗流程状态
 */

import { useState, useCallback, useEffect } from 'react';
import { generateSmallMap } from '@shared/utils/mapGenerator';
import { API_CONFIG } from '@/constants';

const RARITY_R = { common: 1, rare: 2, epic: 3, legendary: 4, core: 4 };

/** 稀有度→图片r编号 */
function rarityToR(rarity) { return RARITY_R[rarity] || 1; }

/** 从weaponType获取图片路径 */
function getTroopImg(troop) {
  const wt = troop.weaponType || '';
  const parts = wt.split('_');
  if (parts.length < 2) return '';
  const type = parts[0], weapon = parts.slice(1).join('_');
  return `${import.meta.env.BASE_URL}assets/san_1_battle/player/troop_r${rarityToR(troop.rarity)}_${type}_${weapon}.png`;
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
  const [silverAmount, setSilverAmount] = useState(100);
  const [activeFormation, setActiveFormation] = useState(null);

  // ── 自动战斗/阵型 ──
  const [autoBattle, setAutoBattle] = useState(() => localStorage.getItem('san_autoBattle') === 'true');
  const [autoFormation, setAutoFormation] = useState(() => localStorage.getItem('san_autoFormation') === 'true');

  // ── 日志 ──
  const addLog = useCallback((text, cls = '') => {
    setLogs(prev => [...prev, { text, cls, id: Date.now() + Math.random() }]);
  }, []);

  // ── 从API加载部队/将领 ──
  useEffect(() => {
    const load = async () => {
      try {
        const [troopRes, charRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}/config/troops?season=san_1`),
          fetch(`${API_CONFIG.BASE_URL}/config/characters?season=san_1`),
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
   * @param {string} eventRarity - 事件稀有度（common/rare/epic/legendary），决定敌方部队
   */
  const assignRealBattleTroops = useCallback((playerUnits, eventRarity = 'common') => {
    const t = allTroops;
    const c = allCharacters;

    // 我方位置（最多5个，从底部两行分布）
    const playerPositions = [
      { y: 9, x: 1 }, { y: 9, x: 4 }, { y: 9, x: 7 },
      { y: 8, x: 2 }, { y: 8, x: 5 },
    ];
    // 敌方位置（4支部队，顶部两行）
    const enemyPositions = [
      { y: 0, x: 1 }, { y: 0, x: 5 },
      { y: 1, x: 3 }, { y: 1, x: 7 },
    ];

    // 构建我方部队（最多5个）
    const playerResult = playerUnits.slice(0, 5).map((unit, i) => {
      const pos = playerPositions[i];
      const tr = unit.troop;
      const char = unit.character || null;
      const morale = unit.morale ?? 70;
      return {
        ...tr,
        id: tr.id + '_p' + i,
        faction: 'player',
        y: pos.y,
        x: pos.x,
        currentTroops: unit.currentTroops ?? tr.maxTroops,
        maxTroops: unit.maxTroops ?? tr.maxTroops,
        character: char,
        displayName: char ? (char.courtesyName || char.name) : tr.name,
        morale,
        imgSrc: getTroopImg(tr),
      };
    });

    // ── 敌方：按事件稀有度从配置池中选取 2将领 + 4部队 ──
    const rarityMap = { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary', core: 'core' };
    const targetRarity = rarityMap[eventRarity] || 'common';

    // 从将领池筛选同稀有度，随机2个
    const charPool = c.filter(ch => ch.rarity === targetRarity);
    const charSrc = charPool.length >= 2 ? charPool : c;
    const shuffledChars = [...charSrc].sort(() => Math.random() - 0.5);
    const enemyChars = [shuffledChars[0] || null, shuffledChars[1 % shuffledChars.length] || null];

    // 从部队池筛选同稀有度，随机4个（允许重复）
    const troopPool = t.filter(tr => tr.rarity === targetRarity);
    const troopSrc = troopPool.length > 0 ? troopPool : t;
    const shuffledTroops = [...troopSrc].sort(() => Math.random() - 0.5);
    const enemyTroopConfigs = [];
    for (let i = 0; i < 4; i++) {
      enemyTroopConfigs.push(shuffledTroops[i % shuffledTroops.length]);
    }

    const enemyResult = enemyTroopConfigs.map((tr, i) => {
      const pos = enemyPositions[i];
      // 将领1带部队0,1；将领2带部队2,3
      const char = enemyChars[Math.floor(i / 2)] || null;
      const baseMorale = Math.round(50 + Math.random() * 30);
      const traitMod = char ? (char.traitModifier || 0) : 0;
      const morale = Math.max(0, Math.min(100, baseMorale + traitMod));
      return {
        ...tr,
        id: tr.id + '_e' + i,
        faction: 'enemy',
        y: pos.y,
        x: pos.x,
        currentTroops: tr.maxTroops,
        character: char,
        displayName: char ? (char.courtesyName || char.name) : tr.name,
        morale,
        imgSrc: getTroopImg(tr),
      };
    });

    const result = [...playerResult, ...enemyResult];
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
      if (prev) { setLogs([]); setRoundNum(0); setActiveFormation(null); }
      return !prev;
    });
  }, []);

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
    // 地图
    mapResult, mapLabel, currentRarity, setCurrentRarity, seedInput, setSeedInput,
    generate, generateWithSeed,
    // 部队
    allTroops, allCharacters, battleTroops, setBattleTroops, assignRealBattleTroops,
    // 战斗
    isBattle, toggleBattle, showTroops, toggleTroops,
    battlePlaying, setBattlePlaying, roundNum, setRoundNum,
    logs, addLog, setLogs,
    silverAmount, setSilverAmount,
    activeFormation, setActiveFormation,
    autoBattle, toggleAutoBattle, autoFormation, toggleAutoFormation,
    // utils
    getTroopImg: getTroopImg,
  };
}
