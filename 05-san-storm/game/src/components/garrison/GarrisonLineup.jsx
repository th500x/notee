/**
 * 驻地编组界面 — 守城卡池A/B配置
 * 
 * 复用 LineupTab 的视觉风格（EquipmentLayout / LandscapeQuadrant）
 * 每个卡池 = 2将领 + 4部队（每将领带2部队）+ 称号等
 * 
 * 竖屏：Tab切换 驻地A / 驻地B，子Tab 将领1/将领2，左3槽+角色卡+右3槽
 * 横屏：2×2布局，左上锁定（玩家角色），右上将领1，右下将领2，左下军营
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { garrisonAPI } from '@/services/garrisonApi';
import { loadSharedData } from '@/services/dataService';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';

const CITY_ID = 'san_1_city_3_xinye';
const CITY_NAME = '新野';

/** 驻地编组面板打开期间：与上阵编组一致，定时轻量拉档案以更新兵力自然恢复等 */
const GARRISON_PROFILE_POLL_MS = 60_000;

/** 槽位定义 — 与 LineupTab 的 GENERAL_SLOTS 一致 */
const GENERAL_SLOTS = [
  { id: 'troop1',    label: '部队1',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'troop2',    label: '部队2',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'equipment', label: '装备卡', icon: '🛡️', side: 'left',  implemented: false },
  { id: 'title',       label: '称号', icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement', label: '成就', icon: '🏆', side: 'right', implemented: false },
  { id: 'treasure',    label: '宝物', icon: '💎', side: 'right', implemented: false },
];

const RARITY_DOTS = [
  { key: 'common',    color: 'bg-gray-400' },
  { key: 'rare',      color: 'bg-blue-400' },
  { key: 'epic',      color: 'bg-purple-400' },
  { key: 'legendary', color: 'bg-orange-400' },
  { key: 'core',      color: 'bg-yellow-400' },
];
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

export default function GarrisonLineup({ onClose }) {
  const { player, cards, refresh, attributeBonusBySlot } = usePlayerContext();
  const [activePool, setActivePool] = useState('A');
  const [activeChar, setActiveChar] = useState('char1');
  const [garrisonA, setGarrisonA] = useState(null);
  const [garrisonB, setGarrisonB] = useState(null);
  const [skillsMap, setSkillsMap] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCard, setDetailCard] = useState(null);
  const [saving, setSaving] = useState(false);
  /** 编队已满将、领但总兵力未达守军下限时的提示（不弹窗） */
  const [activationHint, setActivationHint] = useState(null);

  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth >= 768 && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    const h = () => setIsLandscape(window.innerWidth >= 768 && window.innerWidth > window.innerHeight);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    loadSharedData('skills').then(d => {
      if (d?.skills) {
        const map = {};
        d.skills.forEach(s => { map[s.id] = s; });
        setSkillsMap(map);
      }
    }).catch(() => {});
  }, []);

  const loadGarrisons = useCallback(async () => {
    if (!player?.player_id) return;
    try {
      const res = await garrisonAPI.getAll(player.player_id);
      if (res.success) {
        setGarrisonA(res.garrisons.find(g => g.garrison_slot === 1) || null);
        setGarrisonB(res.garrisons.find(g => g.garrison_slot === 2) || null);
      }
    } catch (e) {
      console.error('[GarrisonLineup] 加载驻守数据失败:', e);
    }
  }, [player?.player_id]);

  useEffect(() => { loadGarrisons(); }, [loadGarrisons]);

  useEffect(() => {
    refresh({ silent: true });
    const id = setInterval(() => refresh({ silent: true }), GARRISON_PROFILE_POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    setActivationHint(null);
  }, [activePool]);

  const currentGarrison = activePool === 'A' ? garrisonA : garrisonB;
  const currentSlotNum = activePool === 'A' ? 1 : 2;

  // 从 garrison 行获取卡牌实例
  const getCardFromGarrison = useCallback((fieldName) => {
    if (!currentGarrison) return null;
    const instanceId = currentGarrison[fieldName];
    if (!instanceId) return null;
    return cards.find(c => c.instance_id === instanceId) || null;
  }, [currentGarrison, cards]);

  // 所有被驻守占用的 instance_id
  const getOccupiedIds = useCallback(() => {
    const ids = new Set();
    const fields = [
      'char1_card', 'char1_troop1', 'char1_troop2', 'char1_title',
      'char2_card', 'char2_troop1', 'char2_troop2', 'char2_title',
    ];
    [garrisonA, garrisonB].forEach(g => {
      if (!g) return;
      fields.forEach(f => { if (g[f]) ids.add(g[f]); });
    });
    return ids;
  }, [garrisonA, garrisonB]);

  // 保存驻守配置
  const saveGarrison = useCallback(async (fieldName, instanceId) => {
    if (!player?.player_id) return;
    setSaving(true);
    try {
      const base = currentGarrison || {};
      const config = {
        cityId: CITY_ID, cityName: CITY_NAME,
        char1_card: base.char1_card || null, char1_equipment_card: base.char1_equipment_card || null,
        char1_title: base.char1_title || null, char1_achievement: base.char1_achievement || null,
        char1_treasure: base.char1_treasure || null, char1_troop1: base.char1_troop1 || null,
        char1_troop2: base.char1_troop2 || null,
        char2_card: base.char2_card || null, char2_equipment_card: base.char2_equipment_card || null,
        char2_title: base.char2_title || null, char2_achievement: base.char2_achievement || null,
        char2_treasure: base.char2_treasure || null, char2_troop1: base.char2_troop1 || null,
        char2_troop2: base.char2_troop2 || null,
      };
      config[fieldName] = instanceId;
      const res = await garrisonAPI.save(player.player_id, currentSlotNum, config);
      if (res.success) {
        await loadGarrisons();
        await refresh();
        if (res.belowTroopThreshold) {
          setActivationHint(
            `本卡池总兵力 ${res.garrisonTroopTotal ?? '—'}，需 ≥ ${res.minTroopsForActive ?? 800} 才计入守城并允许作战（已保存，补足后保存即生效）。`
          );
        } else {
          setActivationHint(null);
        }
      } else {
        alert(res.error || '保存失败');
      }
    } catch (e) {
      console.error('[GarrisonLineup] 保存失败:', e);
    }
    setSaving(false);
  }, [player?.player_id, currentSlotNum, currentGarrison, loadGarrisons, refresh]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  const occupiedIds = getOccupiedIds();
  const characterCards = cards.filter(c => c.card_type === 'character');
  const troopCards = cards.filter(c => c.card_type === 'troop');
  const titleCards = cards.filter(c => c.card_type === 'title');

  // 可用卡牌 = 未上阵 + 未被驻守占用；金(core) 耐久用尽不可再编入驻守（与上阵规则一致）
  const getAvailableCards = useCallback((type) => {
    const pool = type === 'character' ? characterCards
      : type === 'troop' ? troopCards
      : type === 'title' ? titleCards : [];
    return pool.filter((c) => {
      if (c.is_equipped || occupiedIds.has(c.instance_id)) return false;
      if (type !== 'troop') return true;
      const maxBattle = c.max_battle_count ?? 10;
      const count = Math.max(0, c.battle_count ?? 0);
      const isExpired = count >= maxBattle;
      if (!isExpired) return true;
      return c.rarity === 'legendary';
    });
  }, [characterCards, troopCards, titleCards, occupiedIds]);

  // 获取槽位内容（复用 LineupTab 的 getSlotContent 模式）
  const getSlotContent = useCallback((slot, charKey) => {
    const troops = [
      getCardFromGarrison(`${charKey}_troop1`),
      getCardFromGarrison(`${charKey}_troop2`),
    ].filter(Boolean);
    const title = getCardFromGarrison(`${charKey}_title`);
    switch (slot.id) {
      case 'troop1': return troops.find(c => {
        const g = currentGarrison;
        return g && c.instance_id === g[`${charKey}_troop1`];
      }) || null;
      case 'troop2': return troops.find(c => {
        const g = currentGarrison;
        return g && c.instance_id === g[`${charKey}_troop2`];
      }) || null;
      case 'title': return title;
      default: return null;
    }
  }, [getCardFromGarrison, currentGarrison]);

  // 点击槽位
  const handleSlotClick = useCallback((slot, content, charKey) => {
    if (!slot.implemented) return;
    if (content) {
      setDetailCard({ card: content, slot, charKey });
    } else {
      setSelectedSlot({ ...slot, charKey, pool: activePool });
      setDrawerOpen(true);
    }
  }, [activePool]);

  // 装备卡牌到驻守
  const handleEquip = useCallback(async (card) => {
    if (!selectedSlot) return;
    const charKey = selectedSlot.charKey;
    const slotId = selectedSlot.id;
    const fieldName = slotId === 'character' ? `${charKey}_card` : `${charKey}_${slotId}`;
    await saveGarrison(fieldName, card.instance_id);
    closeDrawer();
  }, [selectedSlot, saveGarrison, closeDrawer]);

  // 装备将领卡
  const handleEquipCharacter = useCallback(async (card, charKey) => {
    await saveGarrison(`${charKey}_card`, card.instance_id);
  }, [saveGarrison]);

  // 点击将领角色卡 → 详情浮层
  const handleGeneralCardClick = useCallback((card, charKey) => {
    const virtualSlot = { id: 'character', label: '将领', icon: '👤', implemented: true };
    setDetailCard({ card, slot: virtualSlot, charKey });
  }, []);

  const leftSlots = GENERAL_SLOTS.filter(s => s.side === 'left');
  const rightSlots = GENERAL_SLOTS.filter(s => s.side === 'right');

  // 获取驻守将领的属性加成（从后端 profile 的 attributeBonusBySlot 读取，和上阵编组一致）
  const getGarrisonBonus = useCallback((charKey) => {
    const slotKey = `garrison${currentSlotNum}_${charKey}`;
    return attributeBonusBySlot?.[slotKey] || {};
  }, [attributeBonusBySlot, currentSlotNum]);

  // 渲染将领象限（复用 LineupTab 的 EquipmentLayout 竖屏模式）
  const renderCharPortrait = (charKey) => {
    const charCard = getCardFromGarrison(`${charKey}_card`);
    const charLabel = charKey === 'char1' ? '将领1' : '将领2';

    if (!charCard) {
      return (
        <GeneralNotRecruited label={charLabel}
          unequippedCharacters={getAvailableCards('character')}
          onEquipCharacter={(card) => handleEquipCharacter(card, charKey)}
          skillsMap={skillsMap} />
      );
    }

    const baseUrl = import.meta.env.BASE_URL;
    const charData = toCharData(charCard, getGarrisonBonus(charKey));

    return (
      <div className="px-1 py-4">
        <div className="flex items-start justify-center">
          {/* 左侧槽位 */}
          <div className="flex flex-col justify-between w-[64px] -mr-4" style={{ height: '276px' }}>
            {leftSlots.map(slot => {
              const content = getSlotContent(slot, charKey);
              return (
                <EquipSlot key={slot.id} slot={slot} content={content}
                  isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                  onClick={() => handleSlotClick(slot, content, charKey)}
                  baseUrl={baseUrl} skillsMap={skillsMap} />
              );
            })}
          </div>

          {/* 中央角色卡 */}
          <div className="flex-shrink-0 cursor-pointer" style={{ height: '276px', overflow: 'hidden' }}
            onClick={() => handleGeneralCardClick(charCard, charKey)}>
            <div className="transform scale-[0.72] origin-top">
              <CharacterCard character={charData} skillsMap={skillsMap}
                showDetails={true} baseUrl={baseUrl} />
            </div>
          </div>

          {/* 右侧槽位 */}
          <div className="flex flex-col justify-between w-[64px] -ml-4" style={{ height: '276px' }}>
            {rightSlots.map(slot => {
              const content = getSlotContent(slot, charKey);
              return (
                <EquipSlot key={slot.id} slot={slot} content={content}
                  isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                  onClick={() => handleSlotClick(slot, content, charKey)}
                  baseUrl={baseUrl} skillsMap={skillsMap} />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // 渲染横屏象限（复用 LineupTab 的 LandscapeQuadrant 模式）
  const renderCharLandscape = (charKey) => {
    const charCard = getCardFromGarrison(`${charKey}_card`);
    const charLabel = charKey === 'char1' ? '将领1' : '将领2';

    if (!charCard) {
      return (
        <GeneralNotRecruited label={charLabel}
          unequippedCharacters={getAvailableCards('character')}
          onEquipCharacter={(card) => handleEquipCharacter(card, charKey)}
          skillsMap={skillsMap} />
      );
    }

    const baseUrl = import.meta.env.BASE_URL;
    const charData = toCharData(charCard, getGarrisonBonus(charKey));
    const cardScale = 0.82;
    const cardHeight = Math.round(384 * cardScale);

    return (
      <div className="flex items-stretch h-full p-1">
        {/* 左侧：角色卡 */}
        <div className="flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={() => handleGeneralCardClick(charCard, charKey)}>
          <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left', height: `${cardHeight}px` }}>
            <CharacterCard character={charData} skillsMap={skillsMap}
              showDetails={true} baseUrl={baseUrl} />
          </div>
        </div>

        {/* 右侧：2行×3列 槽位网格 + 编组数据 */}
        <div className="ml-1">
          <div className="grid grid-cols-3 gap-3">
            {GENERAL_SLOTS.map(slot => {
              const content = getSlotContent(slot, charKey);
              return (
                <EquipSlot key={slot.id} slot={slot} content={content}
                  isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                  onClick={() => handleSlotClick(slot, content, charKey)}
                  baseUrl={import.meta.env.BASE_URL} skillsMap={skillsMap} mini />
              );
            })}
          </div>

          {/* 编组数据（和上阵编组 LandscapeQuadrant 位置一致） */}
          <GarrisonStatsPanel garrison={currentGarrison} charKey={charKey} cards={cards}
            getCardFromGarrison={getCardFromGarrison} attributeBonus={getGarrisonBonus(charKey)} compact />
        </div>
      </div>
    );
  };

  // 可用卡牌（未上阵+未驻守）
  const availableCards = cards.filter(c => !c.is_equipped && !occupiedIds.has(c.instance_id));

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex flex-col">
      {/* 顶部栏：规则与城市说明合并为一行 + 驻地A/B Tab */}
      <div className="flex flex-col border-b border-amber-900/50 bg-stone-900/80 sticky top-0 z-10">
        <div className="px-3 py-1.5 text-[10px] text-stone-500 leading-snug border-b border-stone-700/40 text-left space-y-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span>🏯 {CITY_NAME}城</span>
            <span className="text-stone-600">|</span>
            <span>卡池A 总兵力≥800（首轮）；卡池B 总兵力≥800（第二轮）</span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-400">
              当前编辑：卡池{activePool}（{activePool === 'A' ? '首轮防守' : '第二轮防守'}）
            </span>
            {saving && <span className="text-amber-400 animate-pulse">保存中…</span>}
          </div>
          {activationHint && (
            <div className="text-amber-500/90 text-[11px] leading-snug">{activationHint}</div>
          )}
        </div>
        <div className="flex items-center">
        <div className="flex flex-1">
          {['A', 'B'].map(pool => (
            <button key={pool}
              onClick={() => { setActivePool(pool); setActiveChar('char1'); closeDrawer(); }}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative
                ${activePool === pool ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}>
              🏰 驻地{pool}
              {activePool === pool && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="flex-shrink-0 px-3 py-3 text-stone-500 hover:text-white transition-colors">✕</button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 overflow-y-auto">
        {isLandscape ? (
          /* ===== 横屏：2×2 布局 ===== */
          <div className="grid grid-cols-2 grid-rows-2 h-full">
            {/* 左上：玩家角色（锁定） */}
            <div className="border-r border-b border-stone-700/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-stone-900/70 z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-30">🔒</div>
                  <p className="text-stone-500 text-xs">驻地编组无需配置玩家角色</p>
                </div>
              </div>
              {player && (
                <div className="opacity-20 blur-[2px] p-2">
                  <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                    <CharacterCard character={{
                      id: player.player_id, name: player.character_name, rarity: 'common',
                      luck: player.luck / 10, courage: player.courage / 10, combat: player.combat / 10,
                      command: player.command / 10, intelligence: player.intelligence / 10,
                      politics: player.politics / 10, charm: player.charm / 10,
                    }} skillsMap={skillsMap} showDetails={false} baseUrl={import.meta.env.BASE_URL} />
                  </div>
                </div>
              )}
            </div>

            {/* 右上：将领1 */}
            <div className="border-b border-stone-700/40 overflow-y-auto">
              {renderCharLandscape('char1')}
            </div>

            {/* 左下：军营 */}
            <div className="border-r border-stone-700/40 overflow-y-auto">
              <GarrisonBackpack cards={availableCards} skillsMap={skillsMap} />
            </div>

            {/* 右下：将领2 */}
            <div className="overflow-y-auto">
              {renderCharLandscape('char2')}
            </div>
          </div>
        ) : (
          /* ===== 竖屏 ===== */
          <>
            {/* 将领子Tab */}
            <div className="flex border-b border-stone-700/30 bg-stone-800/50">
              {['char1', 'char2'].map(ck => (
                <button key={ck}
                  onClick={() => { setActiveChar(ck); closeDrawer(); }}
                  className={`flex-1 py-2 text-xs font-medium text-center transition-colors relative
                    ${activeChar === ck ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}>
                  {ck === 'char1' ? '将领1' : '将领2'}
                  {activeChar === ck && (
                    <div className="absolute bottom-0 left-1/3 right-1/3 h-0.5 bg-amber-500/60 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {renderCharPortrait(activeChar)}

            {/* 编组数据 */}
            <GarrisonStatsPanel
              garrison={currentGarrison}
              charKey={activeChar}
              cards={cards}
              getCardFromGarrison={getCardFromGarrison}
              attributeBonus={getGarrisonBonus(activeChar)}
            />

            {/* 军营 */}
            <GarrisonBackpack cards={availableCards} skillsMap={skillsMap} />
          </>
        )}
      </div>

      {/* 详情浮层 */}
      {detailCard && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center"
          onClick={() => setDetailCard(null)}>
          <div className="bg-stone-900 rounded-xl p-4 border border-amber-500/30 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-amber-400 text-sm font-bold">
                {detailCard.slot.id === 'character' ? '将领详情' : '卡牌详情'}
              </span>
              <button onClick={() => setDetailCard(null)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <div className="flex justify-center mb-3">
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
                {detailCard.card.card_type === 'character' ? (
                  <CharacterCard character={toCharData(detailCard.card)} skillsMap={skillsMap}
                    showDetails={true} baseUrl={import.meta.env.BASE_URL} />
                ) : detailCard.card.card_type === 'troop' ? (
                  <TroopCard troop={toTroopData(detailCard.card)} skillsMap={skillsMap}
                    showDetails={true} baseUrl={import.meta.env.BASE_URL} />
                ) : detailCard.card.card_type === 'title' ? (
                  <TitleAchievementCard item={toTitleData(detailCard.card)} type="title"
                    baseUrl={import.meta.env.BASE_URL} />
                ) : detailCard.card.card_type === 'equipment' ? (
                  <EquipmentCard equipment={toEquipData(detailCard.card)}
                    baseUrl={import.meta.env.BASE_URL} />
                ) : (
                  <div className="text-stone-400 text-sm text-center py-8">卡牌预览</div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                const field = detailCard.slot.id === 'character'
                  ? `${detailCard.charKey}_card`
                  : `${detailCard.charKey}_${detailCard.slot.id}`;
                saveGarrison(field, null);
                setDetailCard(null);
              }}
                className="flex-1 py-2 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 text-sm
                  hover:bg-red-800/50 transition-colors">
                卸下
              </button>
              <button onClick={() => {
                // 关闭详情 → 打开选择抽屉（替换）
                const slot = detailCard.slot;
                const charKey = detailCard.charKey;
                setDetailCard(null);
                setSelectedSlot({ ...slot, charKey, pool: activePool });
                setDrawerOpen(true);
              }}
                className="flex-1 py-2 rounded-lg bg-amber-900/50 border border-amber-700/50 text-amber-300 text-sm
                  hover:bg-amber-800/50 transition-colors">
                更换
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部抽屉 */}
      {drawerOpen && selectedSlot && (
        <GarrisonDrawer
          slot={selectedSlot}
          cards={getAvailableCards(
            selectedSlot.id === 'character' ? 'character'
            : selectedSlot.id === 'title' ? 'title' : 'troop'
          )}
          skillsMap={skillsMap}
          onSelect={handleEquip}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}


/** 将领未招募 → 显示将领选择界面（复用 LineupTab 的 GeneralNotRecruited 模式） */
function GeneralNotRecruited({ label, unequippedCharacters, onEquipCharacter, skillsMap }) {
  const baseUrl = import.meta.env.BASE_URL;
  if (!unequippedCharacters || unequippedCharacters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-600 flex items-center justify-center mb-4">
          <span className="text-3xl opacity-40">🎴</span>
        </div>
        <p className="text-stone-500 text-sm">{label} — 尚未配置</p>
        <p className="text-stone-600 text-xs mt-1">暂无可用将领卡</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-4">
      <p className="text-amber-400 text-sm font-bold mb-3">选择{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {unequippedCharacters.map(card => (
          <div key={card.instance_id} className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style={{ width: 128, height: 192 }}
            onClick={() => onEquipCharacter(card)}>
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
              <CharacterCard character={toCharData(card)} skillsMap={skillsMap} showDetails={false} baseUrl={baseUrl} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 装备槽位组件 — 完全复用 LineupTab 的 EquipSlot 视觉风格 */
function EquipSlot({ slot, content, isSelected, onClick, baseUrl, skillsMap, mini = false }) {
  const isEmpty = !content;
  const isLocked = !slot.implemented;
  const isTroopSlot = slot.id === 'troop1' || slot.id === 'troop2';
  const slotW = mini ? 96 : 64;
  const slotH = mini ? 96 : 64;

  // 已装备部队卡 — 纯文字摘要
  if (!isLocked && !isEmpty && isTroopSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.card_id;
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const maxBattle = content.max_battle_count ?? 10;
    const used = Math.max(0, Math.min(content.battle_count ?? 0, maxBattle));
    const remaining = Math.max(0, maxBattle - used);
    const troops = `${content.current_troops ?? cfg.maxTroops ?? '?'}`;
    const maxTroops = (cfg.maxTroops || 0) + (content.bonus_max_troops || 0);
    const atk = ((cfg.attack || 0) + (content.bonus_attack || 0) / 10).toFixed(0);
    const def = ((cfg.defense || 0) + (content.bonus_defense || 0) / 10).toFixed(0);
    const spd = (cfg.speed ?? 0) + (content.bonus_speed || 0);
    const mov = (cfg.movement ?? 0) + (content.bonus_movement || 0);
    const range = cfg.range ?? 1;
    const rangeBlocks = Array.from({ length: range }, (_, i) => (
      <span key={i} className="inline-block rounded-[1px]"
        style={{ width: mini ? '3px' : '2px', height: mini ? '3px' : '2px', background: '#f87171' }} />
    ));
    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';
    const isLastUse = remaining === 1;
    const bgClass = isLastUse ? 'bg-red-900/30' : 'bg-stone-800/90';
    const fs1 = mini ? '9px' : '6px';
    const fs2 = mini ? '9px' : '6px';
    const fsR = mini ? '8px' : '5.5px';

    return (
      <button onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} ${bgClass}
          overflow-hidden transition-all duration-200 relative
          cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}>
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className={isLastUse ? 'text-red-400' : 'text-stone-400'} style={{ fontSize: fs2 }}>🚩{remaining}/{maxBattle}</span>
          <span className={parseInt(troops) >= maxTroops ? 'text-green-400' : 'text-yellow-400'} style={{ fontSize: fs2 }}>👥{troops}</span>
        </div>
        <div className="flex items-center gap-0.5 w-full">
          <span className="text-stone-500" style={{ fontSize: fs2 }}>距</span>
          <div className="flex gap-[1px]">{rangeBlocks}</div>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-red-400" style={{ fontSize: fs2 }}>攻{atk}</span>
          <span className="text-blue-400" style={{ fontSize: fs2 }}>防{def}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-cyan-400" style={{ fontSize: fs2 }}>速{spd}</span>
          <span className="text-amber-400" style={{ fontSize: fs2 }}>移{mov}</span>
        </div>
      </button>
    );
  }

  // 已装备称号卡
  const isTitleSlot = slot.id === 'title';
  if (!isLocked && !isEmpty && isTitleSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.card_id;
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const bonus = cfg.attributeBonus || {};
    const bonusLabels = { luck: '运', courage: '勇', combat: '武', command: '统', intelligence: '智', politics: '政', charm: '魅' };
    const bonusEntries = Object.entries(bonus).filter(([, v]) => v > 0);
    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';
    const fs1 = mini ? '9px' : '6px';
    const fs2 = mini ? '9px' : '6px';
    const fsR = mini ? '8px' : '5.5px';

    return (
      <button onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
          overflow-hidden transition-all duration-200 relative text-left
          cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}>
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        {cfg.specialEffectDesc && (
          <div className="w-full">
            <span className="text-green-400 truncate block text-left" style={{ fontSize: fs2 }}>✨{cfg.specialEffectDesc}</span>
          </div>
        )}
        {bonusEntries.length > 0 ? (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonusEntries.slice(0, 3).map(([key, val]) => (
              <span key={key} className="text-amber-400" style={{ fontSize: fs2 }}>
                {bonusLabels[key] || key}+{(val / 10).toFixed(1)}
              </span>
            ))}
          </div>
        ) : (
          <div className="w-full text-left">
            <span className="text-stone-500" style={{ fontSize: fs2 }}>无属性加成</span>
          </div>
        )}
      </button>
    );
  }

  // 锁定槽位
  if (isLocked) {
    return (
      <div className="rounded-lg border-2 border-stone-700/50 bg-stone-800/30
        flex items-center justify-center opacity-40"
        style={{ width: `${slotW}px`, height: `${slotH}px` }}>
        <div className="text-center">
          <span className="text-stone-600 text-xs">🔒</span>
          <div className="text-stone-600 text-[8px] mt-0.5">{slot.label}</div>
        </div>
      </div>
    );
  }

  // 空槽位
  return (
    <button onClick={onClick}
      className={`rounded-lg border-2 border-dashed
        ${isSelected ? 'border-amber-400 bg-amber-900/20' : 'border-stone-600 bg-stone-800/50 hover:border-amber-500/50'}
        flex items-center justify-center transition-all cursor-pointer active:scale-95`}
      style={{ width: `${slotW}px`, height: `${slotH}px` }}>
      <div className="text-center">
        <span className="text-stone-500 text-sm">{slot.icon}</span>
        <div className="text-stone-600 text-[8px] mt-0.5">{slot.label}</div>
      </div>
    </button>
  );
}

/** 军营区域 — 2×3卡片网格 + 稀有度圆点 + 点击展开卡牌列表 */
function GarrisonBackpack({ cards, skillsMap }) {
  const [expandedType, setExpandedType] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const baseUrl = import.meta.env.BASE_URL;

  const GRID_TYPES = [
    { type: 'character',   label: '将领',   icon: '\u{1F464}' },
    { type: 'troop',       label: '部队',   icon: '\u2694\uFE0F' },
    { type: 'equipment',   label: '装备卡', icon: '\u{1F6E1}\uFE0F' },
    { type: 'title',       label: '称号',   icon: '\u{1F396}\uFE0F' },
    { type: 'achievement', label: '成就',   icon: '\u{1F3C6}' },
    { type: 'treasure',    label: '宝物',   icon: '\u{1F48E}' },
  ];

  const byType = {};
  cards.forEach(card => {
    const t = card.card_type || 'troop';
    if (!byType[t]) byType[t] = [];
    byType[t].push(card);
  });

  const countByRarity = (typeCards) => {
    const counts = {};
    (typeCards || []).forEach(c => {
      const r = c.config?.rarity || c.rarity || 'common';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  };

  const groupByRarity = (typeCards) => {
    const grouped = {};
    (typeCards || []).forEach(card => {
      const r = card.config?.rarity || card.rarity || 'common';
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(card);
    });
    return Object.keys(grouped)
      .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99))
      .map(r => ({ rarity: r, cards: grouped[r] }));
  };

  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <div className="mx-3 mt-4 mb-4">
      <h4 className="text-stone-400 text-xs font-medium mb-2">
        🏕️ 军营（{cards.length}）
      </h4>

      {/* 2×3 卡片网格 */}
      <div className="grid grid-cols-3 gap-2">
        {GRID_TYPES.map(({ type, label, icon }) => {
          const typeCards = byType[type] || [];
          const counts = countByRarity(typeCards);
          const total = typeCards.length;
          const isExpanded = expandedType === type;

          return (
            <button key={type}
              onClick={() => setExpandedType(isExpanded ? null : (total > 0 ? type : null))}
              className={`rounded-lg p-2 text-center transition-colors
                ${isExpanded ? 'bg-amber-900/30 border border-amber-700/40' :
                  total > 0 ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
                  : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`}>
              <div className="text-lg">{icon}</div>
              <div className="text-stone-300 text-xs">{label}</div>
              {total > 0 ? (
                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                  {RARITY_DOTS.map(({ key, color }) => {
                    const count = counts[key];
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-0.5">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-stone-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
              )}
            </button>
          );
        })}
      </div>

      {/* 展开的卡牌列表 */}
      {expandedType && (byType[expandedType]?.length > 0) && (
        <div className="mt-2 p-2 bg-stone-800/40 rounded-lg border border-stone-700/30">
          {(expandedType === 'character') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 192 }}
                      className="cursor-pointer overflow-hidden" onClick={() => setPreviewCard({ card, type: 'character' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <CharacterCard character={toCharData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'troop') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 192 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'troop' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TroopCard troop={toTroopData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'equipment') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 96 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'equipment' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <EquipmentCard equipment={toEquipData(card)} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'title') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 96 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'title' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TitleAchievementCard item={toTitleData(card)} type="title" baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-stone-500 text-xs text-center py-3">尚未实装</div>
          )}
        </div>
      )}

      <p className="text-stone-600 text-[10px] mt-1.5 text-center">
        驻地编组与上阵编组互斥，请合理分配
      </p>

      {/* 卡牌预览浮层 */}
      {previewCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}>
          <div onClick={e => e.stopPropagation()}>
            {previewCard.type === 'character' && (
              <CharacterCard character={toCharData(previewCard.card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'troop' && (
              <TroopCard troop={toTroopData(previewCard.card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'equipment' && (
              <EquipmentCard equipment={toEquipData(previewCard.card)} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'title' && (
              <TitleAchievementCard item={toTitleData(previewCard.card)} type="title" baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/** 编组数据面板 — 复用 LineupTab 的 LineupStatsPanel 公式 */
function GarrisonStatsPanel({ garrison, charKey, cards, getCardFromGarrison, compact = false, attributeBonus = {} }) {
  if (!garrison) return null;

  const charCard = getCardFromGarrison(`${charKey}_card`);
  if (!charCard) return null;

  const cfg = charCard.config || {};

  // 属性加成从后端 attributeBonusBySlot 读取（和上阵编组一致）
  const combat = (cfg.combat ?? 0) + ((attributeBonus.combat || 0) / 10);
  const command = (cfg.command ?? 0) + ((attributeBonus.command || 0) / 10);
  const courage = (cfg.courage ?? 0) + ((attributeBonus.courage || 0) / 10);
  const luck = (cfg.luck ?? 0) + ((attributeBonus.luck || 0) / 10);

  const troop1 = getCardFromGarrison(`${charKey}_troop1`);
  const troop2 = getCardFromGarrison(`${charKey}_troop2`);
  const troops = [troop1, troop2].filter(Boolean);

  if (troops.length === 0) return null;

  let totalPower = 0;
  let totalDeployCost = 0;

  troops.forEach(card => {
    const tc = card.config || {};
    const atk = tc.attack || 0;
    const def = tc.defense || 0;
    const maxTroops = (tc.maxTroops || 0) + (card.bonus_max_troops || 0);
    const currentTroops = card.current_troops ?? maxTroops;

    const unitAtk = (atk + combat * 6) * (1 + courage / 40);
    const unitDef = def + command * 5 + combat * 3;
    const power = Math.round((unitAtk + unitDef) * currentTroops / 1000);
    const deployCost = Math.ceil(currentTroops / 20);

    totalPower += power;
    totalDeployCost += deployCost;
  });

  const critRate = ((courage + luck) / 80 * 100).toFixed(1);
  const dodgeRate = (luck).toFixed(1);

  return (
    <div className={`${compact ? 'mx-0 mt-1 mb-1 p-2' : 'mx-3 mt-2 mb-2 p-3'} bg-stone-800/50 rounded-lg border border-stone-700/30`}>
      <h4 className="text-stone-400 text-xs font-medium mb-2">📊 编组数据</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-stone-500">⚔️ 组合战力</span>
          <span className="text-amber-400 font-bold">{totalPower || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">💥 暴击率</span>
          <span className="text-orange-400">{critRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🌾 防守消耗</span>
          <span className="text-green-400">{totalDeployCost || '—'} 粮</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">� 闪避率</span>
          <span className="text-cyan-400">{dodgeRate}%</span>
        </div>
      </div>
    </div>
  );
}

/** 底部抽屉 — 复用 LineupTab 的 CardDrawer 模式 */
function GarrisonDrawer({ slot, cards, skillsMap, onSelect, onClose }) {
  const baseUrl = import.meta.env.BASE_URL;
  const isCharSlot = slot.id === 'character';
  const isTitleSlot = slot.id === 'title';

  const grouped = {};
  cards.forEach(card => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  const sortedRarities = Object.keys(grouped).sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99));
  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[110]" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[111] bg-stone-900 border-t-2 border-amber-700/50
        rounded-t-2xl flex flex-col" style={{ top: '56px' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h3 className="text-amber-400 text-sm font-bold">
            {slot.icon} 选择{slot.label}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">暂无可装备的{slot.label}</div>
          ) : (
            sortedRarities.map(rarity => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-xs mb-1.5 px-1">{rarityLabel[rarity]}（{grouped[rarity].length}）</div>
                <div className="flex flex-wrap gap-2">
                  {grouped[rarity].map(card => {
                    return (
                      <div key={card.instance_id} onClick={() => onSelect(card)}
                        className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                        style={{ width: 128, height: isCharSlot ? 192 : isTitleSlot ? 96 : 192 }}>
                        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                          {isCharSlot ? (
                            <CharacterCard character={toCharData(card)} skillsMap={skillsMap} showDetails={false} baseUrl={baseUrl} />
                          ) : isTitleSlot ? (
                            <TitleAchievementCard item={toTitleData(card)} type="title" baseUrl={baseUrl} />
                          ) : (
                            <TroopCard troop={toTroopData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── 数据转换工具函数 ──

function toCharData(card, attributeBonus) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common',
    stage: cfg.stage,
    luck: cfg.luck,
    courage: cfg.courage,
    combat: cfg.combat,
    command: cfg.command,
    intelligence: cfg.intelligence,
    politics: cfg.politics,
    charm: cfg.charm,
    troopAffinity: cfg.troopAffinity,
    trait: cfg.trait,
    traitModifier: cfg.traitModifier,
    skills: cfg.skills || [],
    bond: cfg.bond,
    biography: cfg.biography,
    description: cfg.description,
    avatar: cfg.avatar,
    morale: card.morale ?? null,
    attributeBonus: attributeBonus || {},
  };
}

function toTroopData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id, name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity, troopType: cfg.troopType,
    weaponType: cfg.weaponType, attack: cfg.attack || 0, defense: cfg.defense || 0,
    speed: cfg.speed, movement: cfg.movement, range: cfg.range,
    maxTroops: (cfg.maxTroops || 0) + (card.bonus_max_troops || 0),
    currentTroops: card.current_troops, skills: cfg.skills || [],
    description: cfg.description, battleCount: card.battle_count ?? 0,
    maxBattleCount: card.max_battle_count ?? 10,
    infantryCounter: cfg.infantryCounter, cavalryCounter: cfg.cavalryCounter,
    archerCounter: cfg.archerCounter, siegeCounter: cfg.siegeCounter,
    plainAdapt: cfg.plainAdapt, hillAdapt: cfg.hillAdapt,
    forestAdapt: cfg.forestAdapt, siegeAdapt: cfg.siegeAdapt,
  };
}

function toEquipData(card) {
  const cfg = card.config || {};
  const bonusKeys = ['luck', 'courage', 'combat', 'command', 'intelligence', 'politics', 'charm'];
  const bonus = bonusKeys.filter(k => cfg[`${k}Bonus`]).map(k => ({ key: k, value: cfg[`${k}Bonus`] }));
  return {
    id: cfg.equipmentId || card.card_id, name: cfg.equipmentName || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common', equipmentType: cfg.equipmentType || 'weapon',
    bonus, specialEffect: cfg.specialEffect, description: cfg.description,
  };
}

function toTitleData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id, name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common', description: cfg.description,
    attributeBonus: cfg.attributeBonus || {}, specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
  };
}
