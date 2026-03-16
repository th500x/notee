/**
 * 角色创建页面
 * 
 * @description 完整的角色创建流程：势力选择 → 角色名 → 属性随机 → 初始部队
 */

import { useState, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';
import { getRandomName } from '@/data/literaryNames';
import { loadSharedData } from '@/services/dataService';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import FactionCard from '@shared/components/card/FactionCard';

const CharacterCreationPage = ({ user, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1=势力, 2=选择形象, 3=角色名, 4=属性, 5=部队
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 步骤1: 势力选择
  const [factions, setFactions] = useState([]);
  const [selectedFaction, setSelectedFaction] = useState(null);

  // 步骤2: 选择形象
  const [avatarCategories, setAvatarCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  // 步骤3: 角色名
  const [characterName, setCharacterName] = useState('');
  const [nameError, setNameError] = useState('');

  // 步骤4: 属性随机
  const [attributeOptions, setAttributeOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [remainingSilver, setRemainingSilver] = useState(50); // 剩余银两
  const [randomCost] = useState(10); // 每次随机成本
  const [currentBatch, setCurrentBatch] = useState(1); // 当前查看的批次号
  const [randomBatches, setRandomBatches] = useState([]); // 所有批次的历史记录
  const [selectedOptionBatch, setSelectedOptionBatch] = useState(null); // 选中的方案所在批次
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null); // 选中的方案索引

  // 步骤5: 初始部队
  const [availableTroops, setAvailableTroops] = useState([]);
  const [selectedTroops, setSelectedTroops] = useState([]);

  // 技能数据
  const [skillsMap, setSkillsMap] = useState({});

  // 加载技能数据
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const skillsData = await loadSharedData('skills');
        // 将技能数组转换为Map，以skill_id为键
        const map = {};
        if (skillsData && skillsData.skills) {
          skillsData.skills.forEach(skill => {
            map[skill.id] = skill;
          });
        }
        setSkillsMap(map);
      } catch (error) {
        console.error('[CharacterCreation] 加载技能数据失败:', error);
      }
    };
    loadSkills();
  }, []);

  // 当用户变化时，从后端加载创建进度
  useEffect(() => {
    if (user) {
      loadCreationProgress();
    }
  }, [user?.id]); // 监听用户ID变化

  // 从后端加载创建进度
  const loadCreationProgress = async () => {
    try {
      setLoading(true);
      const result = await playerAPI.getCreationProgress(user.id);
      
      if (result.success && result.data) {
        // 恢复之前的进度
        const progress = result.data;
        setCurrentStep(progress.current_step || 1);
        setSelectedFaction(progress.selected_faction_id ? {
          faction_id: progress.selected_faction_id,
          faction_name: progress.selected_faction_name
        } : null);
        setSelectedAvatar(progress.selected_avatar || null);
        setCharacterName(progress.character_name || '');
        
        // 恢复批次数据
        setRandomBatches(progress.random_batches || []);
        setCurrentBatch(progress.current_batch || 1);
        setAttributeOptions(progress.random_batches?.[progress.current_batch - 1]?.options || []);
        setSelectedOptionBatch(progress.selected_option_batch);
        setSelectedOptionIndex(progress.selected_option_index);
        
        // 恢复选中的方案
        if (progress.selected_option_batch !== null && progress.selected_option_index !== null) {
          const selectedBatch = progress.random_batches?.[progress.selected_option_batch - 1];
          if (selectedBatch) {
            setSelectedOption(selectedBatch.options[progress.selected_option_index]);
          }
        } else {
          setSelectedOption(null);
        }
        
        setRemainingSilver(progress.remaining_silver !== undefined ? progress.remaining_silver : 50);
        setAvailableTroops([]); // 部队数据需要重新加载
        setSelectedTroops(progress.selected_troops || []);
      } else {
        // 没有进度记录，初始化新的创建流程
        setCurrentStep(1);
        setSelectedFaction(null);
        setSelectedAvatar(null);
        setCharacterName('');
        setNameError('');
        setAttributeOptions([]);
        setSelectedOption(null);
        setRemainingSilver(50);
        setRandomBatches([]);
        setCurrentBatch(1);
        setSelectedOptionBatch(null);
        setSelectedOptionIndex(null);
        setAvailableTroops([]);
        setSelectedTroops([]);
        setError('');
      }
    } catch (err) {
      console.error('加载创建进度失败:', err);
      setError('加载创建进度失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存创建进度到后端
  const saveProgress = async () => {
    if (!user) return;
    
    try {
      const progressData = {
        current_step: currentStep,
        selected_faction_id: selectedFaction?.faction_id || null,
        selected_faction_name: selectedFaction?.faction_name || null,
        selected_avatar: selectedAvatar || null,
        character_name: characterName || null,
        remaining_silver: remainingSilver,
        random_cost: randomCost,
        current_batch: currentBatch,
        random_batches: randomBatches,
        selected_option_batch: selectedOptionBatch,
        selected_option_index: selectedOptionIndex,
        selected_troops: selectedTroops.map(t => t.troop_id)
      };
      
      await playerAPI.saveCreationProgress(user.id, progressData);
    } catch (err) {
      console.error('保存创建进度失败:', err);
    }
  };

  // 每次关键状态变化时保存进度
  useEffect(() => {
    if (user && currentStep > 1) {
      saveProgress();
    }
  }, [currentStep, selectedFaction, selectedAvatar, characterName, remainingSilver, randomBatches, currentBatch, selectedOptionBatch, selectedOptionIndex, selectedTroops]);

  // 加载可用势力
  useEffect(() => {
    if (user && currentStep === 1) {
      loadFactions();
    }
  }, [user, currentStep]);

  // 加载头像列表（恢复进度到步骤2时）
  useEffect(() => {
    if (user && currentStep === 2 && avatarCategories.length === 0) {
      loadAvatars();
    }
  }, [user, currentStep]);

  const loadFactions = async () => {
    try {
      setLoading(true);
      console.log('[CharacterCreation] 开始加载势力列表...');
      const result = await playerAPI.getAvailableFactions(user.id);
      console.log('[CharacterCreation] API返回结果:', result);
      if (result.success) {
        console.log('[CharacterCreation] 设置势力数据:', result.data.factions);
        // 调试：打印第一个势力的详细字段
        if (result.data.factions.length > 0) {
          const f = result.data.factions[0];
          console.log('[CharacterCreation] 第一个势力详细:', {
            faction_name: f.faction_name,
            leader_name: f.leader_name,
            faction_bonuses: f.faction_bonuses,
            bonuses_type: typeof f.faction_bonuses,
            bonuses_isArray: Array.isArray(f.faction_bonuses),
            description: f.description,
            style: f.style,
            difficulty: f.difficulty,
            max_players: f.max_players,
            icon: f.icon,
            all_keys: Object.keys(f)
          });
        }
        setFactions(result.data.factions);
      } else {
        console.error('[CharacterCreation] API返回失败:', result);
        setError('加载势力列表失败');
      }
    } catch (err) {
      console.error('[CharacterCreation] 加载势力列表异常:', err);
      setError('加载势力列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 步骤1: 选择势力
  const handleFactionSelect = (faction) => {
    if (faction.is_full) {
      setError('该势力已满员，请选择其他势力');
      return;
    }
    setSelectedFaction(faction);
    setError('');
  };

  const handleStep1Next = () => {
    if (!selectedFaction) {
      setError('请选择一个势力');
      return;
    }
    // 加载头像列表
    loadAvatars();
    setCurrentStep(2);
    setError('');
  };

  // 步骤2: 选择形象
  const loadAvatars = async () => {
    try {
      const result = await playerAPI.getAvatars();
      if (result.success && result.data.categories) {
        setAvatarCategories(result.data.categories);
        // 默认选中第一个分类
        if (result.data.categories.length > 0) {
          setActiveCategory(result.data.categories[0].id);
        }
      }
    } catch (err) {
      console.error('[CharacterCreation] 加载头像列表失败:', err);
    }
  };

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
    setError('');
  };

  const handleStep2Next = () => {
    if (!selectedAvatar) {
      setError('请选择一个形象');
      return;
    }
    setCurrentStep(3);
    setError('');
  };

  // 步骤3: 输入角色名
  const handleNameChange = (e) => {
    const value = e.target.value;
    setCharacterName(value);
    setNameError('');
  };

  // 随机生成角色名
  const handleRandomName = () => {
    const randomName = getRandomName();
    setCharacterName(randomName);
    setNameError('');
  };

  const validateName = async () => {
    if (!characterName) {
      setNameError('请输入角色名');
      return false;
    }

    try {
      const result = await playerAPI.validateName(characterName, user.serverId);
      if (result.success) {
        if (!result.data.valid) {
          setNameError(result.data.error);
          return false;
        }
        return true;
      }
    } catch (err) {
      setNameError('验证角色名失败');
      return false;
    }
  };

  const handleStep3Next = async () => {
    const isValid = await validateName();
    if (isValid) {
      // 第一次进入属性随机步骤，生成初始方案
      if (randomBatches.length === 0) {
        await generateAttributes();
      }
      setCurrentStep(4);
    }
  };

  // 步骤4: 属性随机
  const generateAttributes = async () => {
    try {
      setLoading(true);
      const result = await playerAPI.generateAttributesBatch(user.id, 'common');
      if (result.success) {
        // 更新批次数据
        const newBatches = [...randomBatches, result.data];
        setRandomBatches(newBatches);
        setCurrentBatch(result.data.batch);
        setAttributeOptions(result.data.options);
        setRemainingSilver(result.data.remaining_silver);
        setSelectedOption(null); // 清空之前的选择
      }
    } catch (err) {
      setError('生成属性方案失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeSelect = async (option, index) => {
    setSelectedOption(option);
    setSelectedOptionBatch(currentBatch);
    setSelectedOptionIndex(index);
    setError('');
    
    // 保存选择到后端
    try {
      await playerAPI.selectOption(user.id, currentBatch, index);
    } catch (err) {
      console.error('保存选择失败:', err);
    }
  };

  const handleRegenerate = () => {
    if (remainingSilver < randomCost) {
      setError(`银两不足，需要${randomCost}银两才能重新随机`);
      return;
    }
    
    // 生成新批次
    generateAttributes();
  };
  
  // 切换批次
  const handlePreviousBatch = () => {
    if (currentBatch > 1) {
      const newBatch = currentBatch - 1;
      setCurrentBatch(newBatch);
      setAttributeOptions(randomBatches[newBatch - 1].options);
    }
  };
  
  const handleNextBatch = () => {
    if (currentBatch < randomBatches.length) {
      const newBatch = currentBatch + 1;
      setCurrentBatch(newBatch);
      setAttributeOptions(randomBatches[newBatch - 1].options);
    }
  };

  const handleStep4Next = async () => {
    if (!selectedOption) {
      setError('请选择一个属性方案');
      return;
    }

    // 加载初始部队选项 - 每次都重新从后端加载，不使用缓存
    try {
      setLoading(true);
      const result = await playerAPI.getInitialTroops(user.id, selectedFaction.faction_id);
      if (result.success) {
        // 强制更新部队数据，覆盖任何缓存
        setAvailableTroops(result.data.troops);
        setSelectedTroops([]); // 清空已选择的部队
        setCurrentStep(5);
      }
    } catch (err) {
      setError('加载部队选项失败');
    } finally {
      setLoading(false);
    }
  };

  // 步骤5: 选择初始部队
  const handleTroopToggle = (troop) => {
    if (selectedTroops.find(t => t.troop_id === troop.troop_id)) {
      setSelectedTroops(selectedTroops.filter(t => t.troop_id !== troop.troop_id));
    } else {
      if (selectedTroops.length >= 2) {
        setError('最多只能选择2个部队');
        return;
      }
      setSelectedTroops([...selectedTroops, troop]);
      setError('');
    }
  };

  const handleCreateCharacter = async () => {
    if (selectedTroops.length !== 2) {
      setError('请选择2个初始部队');
      return;
    }

    try {
      setLoading(true);
      
      // 创建角色，将剩余银两带入游戏
      const result = await playerAPI.createCharacter({
        playerId: user.id,
        characterName,
        factionId: selectedFaction.faction_id,
        factionName: selectedFaction.faction_name,
        attributes: selectedOption.attributesInt,
        skills: selectedOption.skills || null,
        initialTroops: selectedTroops.map(t => t.troop_id),
        serverId: user.serverId,
        initialSilver: remainingSilver, // 将剩余银两带入游戏
        avatar: selectedAvatar // 头像路径
      });

      if (result.success) {
        // 角色创建成功，删除临时数据
        try {
          await playerAPI.deleteCreationProgress(user.id);
        } catch (err) {
          console.error('删除创建进度失败:', err);
        }
        
        // 调用完成回调
        onComplete && onComplete(result.data);
      } else {
        setError(result.error || '创建角色失败');
      }
    } catch (err) {
      setError(err.message || '创建角色失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回上一步
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  if (loading && currentStep === 1) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    );
  }

  if (error && currentStep === 1) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 进度指示器 */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex items-center justify-center space-x-2 sm:space-x-4 min-w-0">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                step === currentStep 
                  ? 'bg-blue-600 text-white' 
                  : step < currentStep 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-300 text-gray-600'
              }`}>
                {step < currentStep ? '✓' : step}
              </div>
              {step < 5 && (
                <div className={`w-6 sm:w-12 h-1 ${step < currentStep ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4 space-x-4 sm:space-x-12 text-xs sm:text-sm text-gray-600">
          <span className={currentStep === 1 ? 'font-bold text-blue-600' : ''}>选择{'\n'}势力</span>
          <span className={currentStep === 2 ? 'font-bold text-blue-600' : ''}>选择{'\n'}形象</span>
          <span className={currentStep === 3 ? 'font-bold text-blue-600' : ''}>角色{'\n'}名</span>
          <span className={currentStep === 4 ? 'font-bold text-blue-600' : ''}>属性{'\n'}随机</span>
          <span className={currentStep === 5 ? 'font-bold text-blue-600' : ''}>初始{'\n'}部队</span>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* 步骤1: 势力选择 */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">选择你的势力</h2>
          
          <div className="flex flex-wrap justify-center gap-6 pb-4">
            {factions.map((faction) => (
              <FactionCard
                key={faction.faction_id}
                faction={faction}
                leaderName={faction.leader_name || faction.faction_name}
                selected={selectedFaction?.faction_id === faction.faction_id}
                disabled={faction.is_full}
                onClick={(f) => handleFactionSelect(f)}
              />
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleStep1Next}
              disabled={!selectedFaction}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              下一步 →
            </button>
          </div>
        </div>
      )}

      {/* 步骤2: 选择形象 */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">选择你的形象</h2>
          
          {avatarCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p>加载头像中...</p>
            </div>
          ) : (
            <>
              {/* 分类标签 */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {avatarCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 当前分类的头像网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center mb-6">
                {avatarCategories
                  .find(c => c.id === activeCategory)
                  ?.avatars.map((avatar, index) => (
                    <div
                      key={avatar}
                      onClick={() => handleAvatarSelect(avatar)}
                      className={`w-[100px] h-[100px] sm:w-[128px] sm:h-[128px] rounded-lg cursor-pointer transition-all border-2 overflow-hidden ${
                        selectedAvatar === avatar
                          ? 'border-blue-500 ring-4 ring-blue-300 scale-105'
                          : 'border-gray-300 hover:border-blue-300 hover:scale-105'
                      }`}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}${avatar}`}
                        alt={`头像${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </>
          )}

          <div className="mt-8 flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
            <button
              onClick={handleStep2Next}
              disabled={!selectedAvatar}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              下一步 →
            </button>
          </div>
        </div>
      )}

      {/* 步骤3: 角色名输入 */}
      {currentStep === 3 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">输入角色名</h2>

          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色名（1-3个中文字符）
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={characterName}
                  onChange={handleNameChange}
                  maxLength={3}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="请输入角色名"
                />
                <button
                  onClick={handleRandomName}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium whitespace-nowrap"
                  title="随机生成文艺名字"
                >
                  🎲 随机
                </button>
              </div>
              {nameError && (
                <p className="mt-2 text-sm text-red-600">{nameError}</p>
              )}
              {characterName && !nameError && (
                <p className="mt-2 text-sm text-green-600">✓ 角色名格式正确</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">💡 命名规则：</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 1-3个中文字符</li>
                <li>• 仅限中文（简体/繁体）</li>
                <li>• 不能包含英文、数字、符号</li>
                <li>• 同服务器内不能重名</li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">已选择势力：</h4>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{selectedFaction.icon}</span>
                <span className="font-bold text-gray-900">{selectedFaction.faction_name}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
            <button
              onClick={handleStep3Next}
              disabled={!characterName || loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? '验证中...' : '下一步 →'}
            </button>
          </div>
        </div>
      )}

      {/* 步骤4: 属性随机 - 临时显示30个方案 */}
      {currentStep === 4 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">属性随机</h2>
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              选择一个属性方案，或花费银两重新随机
            </p>
            <div className="inline-flex items-center space-x-4 bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-3">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">💰</span>
                <span className="text-lg font-bold text-yellow-800">剩余银两: {remainingSilver}</span>
              </div>
              <div className="text-sm text-yellow-700">
                重新随机需要 {randomCost} 银两
              </div>
            </div>
            
            {/* 批次导航 */}
            {randomBatches.length > 1 && (
              <div className="mt-4 flex items-center justify-center space-x-4">
                <button
                  onClick={handlePreviousBatch}
                  disabled={currentBatch === 1}
                  className="px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  ← 上一批
                </button>
                <span className="text-gray-700 font-medium">
                  第 {currentBatch} 批 / 共 {randomBatches.length} 批
                </span>
                <button
                  onClick={handleNextBatch}
                  disabled={currentBatch === randomBatches.length}
                  className="px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  下一批 →
                </button>
              </div>
            )}
          </div>

          {/* 3个方案响应式排列：手机1列，平板2列，PC 3列 */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {attributeOptions.map((option, index) => {
              // 将option数据适配为CharacterCard需要的character格式
              const characterData = {
                id: `option_${index}`,
                name: characterName,
                avatar: selectedAvatar,
                rarity: 'common',  // 玩家角色初始为common
                stage: 'early',    // 玩家角色初始为early
                luck: parseFloat(option.attributes.luck),
                courage: parseFloat(option.attributes.courage),
                combat: parseFloat(option.attributes.combat),
                command: parseFloat(option.attributes.command),
                intelligence: parseFloat(option.attributes.intelligence),
                politics: parseFloat(option.attributes.politics),
                charm: parseFloat(option.attributes.charm),
                skills: option.skills ? [
                  option.skills.skill_1?.id || option.skills.skill_1,
                  option.skills.skill_2?.id || option.skills.skill_2
                ].filter(Boolean) : []
              };
              
              const isSelected = selectedOption === option && 
                                selectedOptionBatch === currentBatch && 
                                selectedOptionIndex === index;
              
              return (
                <CharacterCard
                  key={index}
                  character={characterData}
                  skillsMap={skillsMap}  // 传入技能映射
                  showDetails={true}  // 显示技能
                  baseUrl={import.meta.env.BASE_URL}
                  onSelect={() => handleAttributeSelect(option, index)}
                  isSelected={isSelected}
                  characterType={option.type}  // 显示类型标签（武官/文官/文武）
                  totalPoints={option.totalPoints}  // 显示总点数
                />
              );
            })}
          </div>

          <div className="flex justify-center mb-6">
            <button
              onClick={handleRegenerate}
              disabled={remainingSilver < randomCost || loading}
              className="px-6 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {remainingSilver < randomCost 
                ? '💰 银两不足' 
                : `🔄 重新随机 (花费 ${randomCost} 银两)`
              }
            </button>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
            <button
              onClick={handleStep4Next}
              disabled={!selectedOption || loading}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? '加载中...' : '下一步 →'}
            </button>
          </div>
        </div>
      )}

      {/* 步骤5: 选择初始部队 */}
      {currentStep === 5 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">选择初始部队</h2>
          <p className="text-center text-gray-600 mb-6">
            从以下部队中选择2个作为你的初始部队
          </p>

          {/* 使用共享TroopCard组件展示部队 */}
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            {availableTroops.map((troop) => {
              const isSelected = selectedTroops.find(t => t.troop_id === troop.troop_id);
              
              // 转换数据格式以匹配TroopCard组件的props
              const troopCardData = {
                id: troop.troop_id,
                name: troop.troop_name,
                rarity: troop.rarity || 'rare',
                troopType: troop.troop_type,
                weaponType: troop.weapon_type,
                faction: troop.faction, // 添加势力字段
                attack: troop.attack / 10,
                defense: troop.defense / 10,
                speed: troop.speed,
                movement: troop.movement || 4,
                maxTroops: troop.max_troops,
                range: troop.range,
                infantryCounter: troop.infantry_counter || 1.0,
                cavalryCounter: troop.cavalry_counter || 1.0,
                archerCounter: troop.archer_counter || 1.0,
                siegeCounter: troop.siege_counter || 1.0,
                plainAdapt: troop.plain_adapt || 1.0,
                hillAdapt: troop.hill_adapt || 1.0,
                forestAdapt: troop.forest_adapt || 1.0,
                siegeAdapt: troop.siege_adapt || 1.0,
                skills: troop.skills || [],
                description: troop.description
              };

              return (
                <div
                  key={troop.troop_id}
                  onClick={() => handleTroopToggle(troop)}
                  className={`relative cursor-pointer transition-all ${
                    isSelected ? 'ring-4 ring-blue-500 rounded-xl' : ''
                  }`}
                >
                  <TroopCard 
                    troop={troopCardData} 
                    showDetails={true}
                    baseUrl={import.meta.env.BASE_URL}
                  />
                  
                  {/* 选中标记 */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10 text-xl">
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              已选择: {selectedTroops.length}/2
              {selectedTroops.length > 0 && (
                <span className="ml-2">
                  ({selectedTroops.map(t => t.troop_name).join(', ')})
                </span>
              )}
            </p>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
            <button
              onClick={handleCreateCharacter}
              disabled={selectedTroops.length !== 2 || loading}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? '创建中...' : '完成创建 ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterCreationPage;
