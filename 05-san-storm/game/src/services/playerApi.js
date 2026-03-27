/**
 * 玩家API服务
 * 
 * @description 处理玩家相关的API请求
 */

import { API_CONFIG } from '../constants';

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

export const playerAPI = {
  /**
   * 获取可用头像列表
   */
  async getAvatars() {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/avatars`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取头像列表失败:', error);
      throw error;
    }
  },

  /**
   * 检查玩家是否存在
   */
  async checkExists(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/check/${playerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('检查玩家失败:', error);
      throw error;
    }
  },

  /**
   * 获取玩家完整档案（基础信息 + 卡牌）
   * 用于GamePage
   */
  async getProfile(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/profile`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取玩家档案失败:', error);
      throw error;
    }
  },

  /**
   * 获取玩家信息
   */
  async getPlayer(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取玩家信息失败:', error);
      throw error;
    }
  },

  /**
   * 生成属性方案（9选1）
   */
  async generateAttributes(rarity = 'common') {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/generate-attributes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rarity })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('生成属性方案失败:', error);
      throw error;
    }
  },

  /**
   * 验证角色名
   */
  async validateName(characterName, serverId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/validate-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, serverId })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证角色名失败:', error);
      throw error;
    }
  },

  /**
   * 创建角色
   */
  async createCharacter(data) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('创建角色失败:', error);
      throw error;
    }
  },

  /**
   * 获取可用势力列表
   */
  async getAvailableFactions(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/factions/available`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取可用势力失败:', error);
      throw error;
    }
  },

  /**
   * 获取初始部队选项
   */
  async getInitialTroops(playerId, factionId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/troops/initial?factionId=${factionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取初始部队选项失败:', error);
      throw error;
    }
  },

  /**
   * 获取角色创建进度
   */
  async getCreationProgress(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/creation-progress`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取角色创建进度失败:', error);
      throw error;
    }
  },

  /**
   * 保存角色创建进度
   */
  async saveCreationProgress(playerId, progressData) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/creation-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('保存角色创建进度失败:', error);
      throw error;
    }
  },

  /**
   * 生成属性方案（新批次）
   */
  async generateAttributesBatch(playerId, rarity = 'common') {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/generate-attributes-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rarity })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('生成属性批次失败:', error);
      throw error;
    }
  },

  /**
   * 选择属性方案
   */
  async selectOption(playerId, batch, index) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/select-option`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch, index })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('选择属性方案失败:', error);
      throw error;
    }
  },

  /**
   * 删除角色创建进度
   */
  async deleteCreationProgress(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/creation-progress`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('删除角色创建进度失败:', error);
      throw error;
    }
  },

  /**
   * 装备卡牌到指定槽位
   */
  async equipCard(playerId, instanceId, equippedBy, equippedSlot) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/cards/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, equippedBy, equippedSlot })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('装备卡牌失败:', error);
      throw error;
    }
  },

  /**
   * 卸下卡牌
   */
  async unequipCard(playerId, instanceId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/cards/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('卸下卡牌失败:', error);
      throw error;
    }
  },

  /**
   * 更新新手引导进度
   */
  async updateTutorialStep(playerId, step) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/progress/tutorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新新手引导进度失败:', error);
      throw error;
    }
  },

  /**
   * 获取玩家道具列表
   */
  async getItems(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/items`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取玩家道具失败:', error);
      throw error;
    }
  },

  // ── 属性随机系统 ──

  /**
   * 获取属性随机状态
   */
  async getRerollStatus(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/reroll-status`);
    return response.json();
  },

  /**
   * 执行属性随机（扣银两、生成3方案）
   */
  async rerollAttributes(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/reroll-attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  },

  /**
   * 确认选择属性方案
   */
  async rerollConfirm(playerId, batch, index) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/reroll-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch, index })
    });
    return response.json();
  }
};
