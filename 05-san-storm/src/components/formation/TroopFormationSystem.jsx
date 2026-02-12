/**
 * 部队编组系统组件
 * 
 * @description M2验证模块 - 武将+部队卡组合机制
 */

import React, { useState, useMemo } from 'react';
import { useCharacters } from '@/hooks/useCharacters';
import { useTroops } from '@/hooks/useTroops';

// 临时占位符图标组件
const PlaceholderIcon = ({ type, size = 'w-8 h-8' }) => {
  const icons = {
    character: '👤',
    troop: '🛡️',
    formation: '⚔️',
    power: '💪',
    add: '➕',
    remove: '❌',
    auto: '🎯'
  };
  
  return (
    <div className={`${size} flex items-center justify-center text-2xl bg-gray-100 rounded-lg border-2 border-dashed border-gray-300`}>
      {icons[type] || '❓'}
    </div>
  );
};

// 稀有度等级定义（从低到高）
const RARITY_LEVELS = {
  'common': 1,    // 普通
  'rare': 2,      // 稀有
  'epic': 3,      // 史诗
  'legendary': 4, // 传奇
  'core': 5       // 核心
};

// 检查武将是否可以装备部队
const canEquipTroop = (characterRarity, troopRarity) => {
  const charLevel = RARITY_LEVELS[characterRarity] || 1;
  const troopLevel = RARITY_LEVELS[troopRarity] || 1;
  
  // 武将可以装备同等级及以下的部队，或高一级的部队（有惩罚）
  return troopLevel <= charLevel + 1;
};

// 检查是否有稀有度惩罚
const hasRarityPenalty = (characterRarity, troopRarity) => {
  const charLevel = RARITY_LEVELS[characterRarity] || 1;
  const troopLevel = RARITY_LEVELS[troopRarity] || 1;
  
  // 装备高一级稀有度部队时有-10%惩罚
  return troopLevel === charLevel + 1;
};

// 按稀有度排序（从高到低）
const sortByRarity = (items) => {
  return [...items].sort((a, b) => {
    const aLevel = RARITY_LEVELS[a.rarity] || 1;
    const bLevel = RARITY_LEVELS[b.rarity] || 1;
    return bLevel - aLevel; // 从高到低排序
  });
};
const applyRarityPenalty = (troop, hasPenalty) => {
  if (!hasPenalty) return troop;
  
  return {
    ...troop,
    attack: Math.floor((troop.attack || 0) * 0.9),
    defense: Math.floor((troop.defense || 0) * 0.9),
    // maxTroops 不受惩罚影响
  };
};
const parseAffinityString = (affinityStr) => {
  const affinities = {};
  if (!affinityStr) return affinities;
  
  affinityStr.split(';').forEach(pair => {
    const [troopType, bonus] = pair.split(':');
    affinities[troopType] = parseInt(bonus) || 0;
  });
  
  return affinities;
};

// 获取适应性加成
const getAffinityBonus = (characterAffinity, troopType) => {
  const affinities = parseAffinityString(characterAffinity);
  return affinities[troopType] || 0;
};

// 获取适应性等级和颜色
const getAffinityLevel = (bonus) => {
  if (bonus >= 20) return { level: '卓越', color: 'text-orange-600' };
  if (bonus >= 15) return { level: '优秀', color: 'text-purple-600' };
  if (bonus >= 10) return { level: '良好', color: 'text-blue-600' };
  if (bonus >= 5) return { level: '一般', color: 'text-green-600' };
  return { level: '不适应', color: 'text-gray-600' };
};

// 计算粮草消耗
const calculateFoodConsumption = (formation) => {
  if (!formation.character || !formation.troops.some(troop => troop)) return 0;
  
  let totalTroops = 0;
  formation.troops.forEach(troop => {
    if (troop) {
      // 兵力数不受稀有度惩罚影响
      totalTroops += troop.maxTroops || 0;
    }
  });
  
  // 每20兵力消耗1粮草，向上取整
  return Math.ceil(totalTroops / 20);
};
// 单个编组卡片组件
const FormationCard = ({ formation, index, onRemove, onOpenSelector }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{formation.name}</h3>
        <button
          onClick={() => onOpenSelector(index, 'auto')}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors"
          title="一键编组"
        >
          <PlaceholderIcon type="auto" size="w-4 h-4" />
          一键编组
        </button>
      </div>
      
      <div className="space-y-4">
        {/* 武将选择 */}
        <div 
          className="border rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 hover:shadow-md"
          onClick={() => onOpenSelector(index, 'character')}
        >
          <div className="flex items-center gap-2 mb-2">
            <PlaceholderIcon type="character" size="w-6 h-6" />
            <span className="text-sm font-medium text-gray-700">武将</span>
            <span className="text-xs text-gray-500 ml-auto">点击选择</span>
          </div>
          {formation.character ? (
            <div className="bg-blue-50 rounded p-2">
              <div className="font-medium text-blue-900">{formation.character.name}</div>
              <div className="text-xs text-blue-700">
                攻击:{formation.character.combat} 防御:{formation.character.command} 智力:{formation.character.intelligence}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {formation.character.faction} | {formation.character.rarity}
              </div>
              {/* 显示兵种适应性 */}
              {formation.character.troopAffinity && (
                <div className="text-xs text-blue-800 mt-1 space-y-1">
                  {(() => {
                    const affinities = parseAffinityString(formation.character.troopAffinity);
                    const troopTypeMap = { infantry: '🛡️', cavalry: '🐎', archer: '🏹' };
                    const troopNameMap = { infantry: '步兵', cavalry: '骑兵', archer: '弓兵' };
                    return Object.entries(affinities).map(([type, bonus]) => {
                      const { level, color } = getAffinityLevel(bonus);
                      return (
                        <div key={type} className={`${color} font-medium`}>
                          {troopTypeMap[type]}{troopNameMap[type]} +{bonus}%
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm py-4 text-center border-2 border-dashed border-gray-300 rounded">
              点击选择武将
            </div>
          )}
        </div>

        {/* 部队选择区域 */}
        <div className="space-y-3">
          {formation.troops.map((troop, troopIndex) => (
            <div 
              key={troopIndex}
              className="border rounded-lg p-3 cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-all duration-200 hover:shadow-md"
              onClick={() => onOpenSelector(index, 'troop', troopIndex)}
            >
              <div className="flex items-center gap-2 mb-2">
                <PlaceholderIcon type="troop" size="w-6 h-6" />
                <span className="text-sm font-medium text-gray-700">
                  部队{formation.troops.length > 1 ? ` ${troopIndex + 1}` : ''}
                </span>
                <span className="text-xs text-gray-500 ml-auto">点击选择</span>
              </div>
              {troop ? (
                <div className="bg-green-50 rounded p-2">
                  <div className="font-medium text-green-900 flex items-center gap-2">
                    {troop.name}
                    {formation.character && hasRarityPenalty(formation.character.rarity, troop.rarity) && (
                      <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                        -10%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-green-700">
                    {(() => {
                      if (formation.character) {
                        const hasPenalty = hasRarityPenalty(formation.character.rarity, troop.rarity);
                        const effectiveTroop = applyRarityPenalty(troop, hasPenalty);
                        return `攻击:${effectiveTroop.attack} 防御:${effectiveTroop.defense} 兵力:${effectiveTroop.maxTroops}`;
                      }
                      return `攻击:${troop.attack} 防御:${troop.defense} 兵力:${troop.maxTroops}`;
                    })()}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {troop.troopType} | {troop.rarity}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 text-center border-2 border-dashed border-gray-300 rounded">
                  点击选择部队
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 组合战力和粮草消耗 */}
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            {/* 组合战力 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <PlaceholderIcon type="power" size="w-5 h-5" />
                <span className="text-sm font-medium text-yellow-800">组合战力</span>
              </div>
              {formation.character && formation.troops.some(troop => troop) ? (
                <div>
                  <div className="text-lg font-bold text-yellow-900">
                    {(() => {
                      const characterPower = (formation.character.combat || 0) + (formation.character.command || 0) + (formation.character.intelligence || 0);
                      let totalPower = characterPower;
                      let totalBonus = 0;
                      
                      formation.troops.forEach(troop => {
                        if (troop) {
                          // 应用稀有度惩罚
                          const hasPenalty = formation.character ? hasRarityPenalty(formation.character.rarity, troop.rarity) : false;
                          const effectiveTroop = applyRarityPenalty(troop, hasPenalty);
                          
                          const troopPower = (effectiveTroop.attack || 0) + (effectiveTroop.defense || 0) + (effectiveTroop.maxTroops || 0);
                          const basePower = characterPower + troopPower;
                          const affinityBonus = getAffinityBonus(formation.character.troopAffinity, troop.troopType);
                          const finalPower = Math.floor(basePower * (1 + affinityBonus / 100));
                          const bonusPower = finalPower - basePower;
                          
                          totalPower += troopPower + bonusPower;
                          totalBonus += bonusPower;
                        }
                      });
                      
                      return (
                        <div>
                          <div>{Math.floor(totalPower)}</div>
                          {totalBonus > 0 && (
                            <div className="text-xs text-yellow-700">
                              基础:{(totalPower - totalBonus).toFixed(1)} + 适应性:{totalBonus.toFixed(1)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-bold text-yellow-900">0</div>
              )}
            </div>
            
            {/* 粮草消耗 */}
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-sm font-medium text-orange-800">粮草消耗</span>
                <span className="text-lg">🌾</span>
              </div>
              <div className="text-lg font-bold text-orange-900">
                {calculateFoodConsumption(formation)}
              </div>
              {formation.character && formation.troops.some(troop => troop) && (
                <div className="text-xs text-orange-700">
                  {(() => {
                    let totalTroops = 0;
                    formation.troops.forEach(troop => {
                      if (troop) {
                        totalTroops += troop.maxTroops || 0; // 使用maxTroops
                      }
                    });
                    return `${totalTroops} ÷ 20`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 选择器组件
const CharacterSelector = ({ characters, onSelect, selectedIds = [] }) => {
  const [search, setSearch] = useState('');
  const [factionFilter, setFactionFilter] = useState('all');
  
  const filteredCharacters = useMemo(() => {
    const filtered = characters.filter(char => {
      const matchesSearch = char.name.toLowerCase().includes(search.toLowerCase());
      const matchesFaction = factionFilter === 'all' || char.faction === factionFilter;
      const notSelected = !selectedIds.includes(char.id);
      return matchesSearch && matchesFaction && notSelected;
    });
    
    // 按稀有度从高到低排序
    return sortByRarity(filtered);
  }, [characters, search, factionFilter, selectedIds]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="搜索武将..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select
          value={factionFilter}
          onChange={(e) => setFactionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">全部势力</option>
          <option value="刘备">刘备</option>
          <option value="曹操">曹操</option>
          <option value="孙坚">孙坚</option>
          <option value="通用">通用</option>
        </select>
      </div>
      
      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredCharacters.map(char => (
          <div
            key={char.id}
            onClick={() => onSelect(char)}
            className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <div className="font-medium">{char.name}</div>
            <div className="text-sm text-gray-600">
              {char.faction} | 攻击:{char.combat} 防御:{char.command} 智力:{char.intelligence}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              稀有度: {char.rarity}
            </div>
            {/* 显示适应性预览 */}
            {char.troopAffinity && (
              <div className="text-xs text-gray-500 mt-1">
                {(() => {
                  const affinities = parseAffinityString(char.troopAffinity);
                  const troopTypeMap = { infantry: '🛡️', cavalry: '🐎', archer: '🏹' };
                  return Object.entries(affinities)
                    .filter(([_, bonus]) => bonus > 0)
                    .map(([type, bonus]) => `${troopTypeMap[type]}${bonus}%`)
                    .join(' ');
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const TroopSelector = ({ troops, onSelect, selectedIds = [], characterRarity = 'common' }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const filteredTroops = useMemo(() => {
    const filtered = troops.filter(troop => {
      // 基础筛选条件
      if (selectedIds.includes(troop.id)) return false;
      if (typeFilter !== 'all' && troop.troopType !== typeFilter) return false;
      if (search && !troop.name.toLowerCase().includes(search.toLowerCase())) return false;
      
      // 稀有度限制
      const charLevel = RARITY_LEVELS[characterRarity] || 1;
      const troopLevel = RARITY_LEVELS[troop.rarity] || 1;
      return troopLevel <= charLevel + 1;
    });
    
    // 按稀有度从高到低排序
    return sortByRarity(filtered);
  }, [troops, search, typeFilter, selectedIds, characterRarity]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="搜索部队..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">全部兵种</option>
          <option value="infantry">步兵</option>
          <option value="cavalry">骑兵</option>
          <option value="archer">弓兵</option>
        </select>
      </div>
      
      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredTroops.map(troop => {
          const hasPenalty = hasRarityPenalty(characterRarity, troop.rarity);
          const effectiveTroop = applyRarityPenalty(troop, hasPenalty);
          
          return (
            <div
              key={troop.id}
              onClick={() => onSelect(troop)}
              className={`p-3 border rounded-lg hover:bg-green-50 cursor-pointer transition-colors ${
                hasPenalty ? 'border-orange-300 bg-orange-50' : ''
              }`}
            >
              <div className="font-medium flex items-center gap-2">
                {troop.name}
                {hasPenalty && (
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                    -10%惩罚
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {troop.troopType} | 攻击:{effectiveTroop.attack} 防御:{effectiveTroop.defense} 兵力:{effectiveTroop.maxTroops}
                {hasPenalty && (
                  <span className="text-orange-600 ml-2">
                    (原: 攻击:{troop.attack} 防御:{troop.defense})
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                稀有度: {troop.rarity}
              </div>
            </div>
          );
        })}
        
        {filteredTroops.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🚫</div>
            <p>没有可装备的部队</p>
            <p className="text-xs mt-1">武将稀有度限制了可选择的部队</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 主组件
const TroopFormationSystem = () => {
  const { characters, loading: charactersLoading } = useCharacters();
  const { troops, loading: troopsLoading } = useTroops();
  
  const [formations, setFormations] = useState([
    { character: null, troops: [null], name: '玩家编组' },
    { character: null, troops: [null, null], name: '编组 1' },
    { character: null, troops: [null, null], name: '编组 2' }
  ]);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showTroopSelector, setShowTroopSelector] = useState(false);
  const [currentFormationIndex, setCurrentFormationIndex] = useState(0);
  const [currentTroopIndex, setCurrentTroopIndex] = useState(0);
  const [selectionType, setSelectionType] = useState('character'); // 'character' | 'troop'

  // 添加新编组 - 移除此功能
  // const addFormation = () => {
  //   if (formations.length < 6) {
  //     setFormations([...formations, { character: null, troop: null }]);
  //   }
  // };

  // 移除编组 - 移除此功能
  // const removeFormation = (index) => {
  //   if (formations.length > 1) {
  //     setFormations(formations.filter((_, i) => i !== index));
  //   }
  // };

  // 选择武将
  const selectCharacter = (character) => {
    const newFormations = [...formations];
    newFormations[currentFormationIndex].character = character;
    setFormations(newFormations);
    setShowCharacterSelector(false);
  };

  // 选择部队
  const selectTroop = (troop) => {
    const newFormations = [...formations];
    newFormations[currentFormationIndex].troops[currentTroopIndex] = troop;
    setFormations(newFormations);
    setShowTroopSelector(false);
  };

  // 打开选择器
  const openSelector = (index, type, troopIndex = 0) => {
    if (type === 'auto') {
      // 一键编组单个编组
      autoSingleFormation(index);
      return;
    }
    
    setCurrentFormationIndex(index);
    setCurrentTroopIndex(troopIndex);
    setSelectionType(type);
    if (type === 'character') {
      setShowCharacterSelector(true);
      setShowTroopSelector(false);
    } else {
      setShowTroopSelector(true);
      setShowCharacterSelector(false);
    }
  };

  // 一键编组单个编组
  const autoSingleFormation = (index) => {
    const availableCharacters = characters.filter(char => 
      !formations.some(f => f.character?.id === char.id)
    );
    
    if (availableCharacters.length > 0) {
      const selectedCharacter = availableCharacters[0];
      
      // 根据武将稀有度筛选可用部队
      const availableTroops = troops.filter(troop => 
        !formations.some(f => f.troops.some(t => t?.id === troop.id)) &&
        canEquipTroop(selectedCharacter.rarity, troop.rarity)
      );

      if (availableTroops.length >= formations[index].troops.length) {
        const newFormations = [...formations];
        newFormations[index] = {
          ...newFormations[index],
          character: selectedCharacter,
          troops: formations[index].troops.map((_, troopIndex) => 
            availableTroops[troopIndex] || null
          )
        };
        setFormations(newFormations);
      }
    }
  };

  const selectedCharacterIds = formations.map(f => f.character?.id).filter(Boolean);
  const selectedTroopIds = formations.flatMap(f => f.troops.map(t => t?.id)).filter(Boolean);

  if (charactersLoading || troopsLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载数据中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和控制 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">部队编组系统</h2>
          <p className="text-gray-600">武将 + 部队卡组合机制验证</p>
        </div>
      </div>

      {/* 编组列表 - 固定3个编组 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {formations.map((formation, index) => (
          <div key={index}>
            <FormationCard
              formation={formation}
              index={index}
              onOpenSelector={openSelector}
            />
          </div>
        ))}
      </div>

      {/* 武将选择器模态框 */}
      {showCharacterSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">选择武将</h3>
              <button
                onClick={() => setShowCharacterSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <CharacterSelector
              characters={characters}
              onSelect={selectCharacter}
              selectedIds={selectedCharacterIds}
            />
          </div>
        </div>
      )}

      {/* 部队选择器模态框 */}
      {showTroopSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">选择部队</h3>
              <button
                onClick={() => setShowTroopSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <TroopSelector
              troops={troops}
              onSelect={selectTroop}
              selectedIds={selectedTroopIds}
              characterRarity={formations[currentFormationIndex]?.character?.rarity || 'common'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TroopFormationSystem;