/**
 * 玩家API服务
 * 
 * @description 处理玩家相关的API请求
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

/** 道路遭遇等：非 JSON / 连错端口时避免 `response.json()` 抛错导致界面无声失败 */
async function jsonFromApiResponse(response, contextLabel) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok) {
    if (ct.includes('application/json')) {
      try {
        const j = await response.json();
        if (j && typeof j === 'object') return j;
      } catch (_) {
        /* fall through */
      }
    }
    let snippet = '';
    try {
      const t = await response.text();
      snippet = String(t || '').replace(/\s+/g, ' ').slice(0, 200);
    } catch (_) {
      /* ignore */
    }
    const hint404 =
      '请确认已启动 33-san-storm/backend（默认 3005）、前端 API 基址指向该进程，并已拉取含道路遭遇路由的代码后重启后端。';
    return {
      success: false,
      error:
        response.status === 404
          ? `${contextLabel} HTTP 404（${hint404}）`
          : `${contextLabel} 失败（HTTP ${response.status}）`,
      rawBodySnippet: snippet || undefined,
    };
  }
  try {
    const j = await response.json();
    if (j && typeof j === 'object') return j;
    return { success: false, error: `${contextLabel}：响应体不是 JSON 对象` };
  } catch (e) {
    return { success: false, error: `${contextLabel}：响应不是合法 JSON`, message: e?.message };
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
      return jsonFromApiResponse(response, '检查玩家');
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
   * 势力 Tab「势力信息」：官职、人数、城市摘要、五维档位、储备
   */
  async getFactionOverview(playerId) {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/faction/overview`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('获取势力信息失败:', error);
      throw error;
    }
  },

  /** 大地图坞：san_1 三势力概览（三王/汉室/黄巾；与势力信息同源） */
  async getFactionWorldOverviews(playerId) {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/faction/world-overviews`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('获取全图势力概览失败:', error);
      throw error;
    }
  },

  async getFactionBulletin(playerId, { limit = 50, category = null } = {}) {
    try {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (category) qs.set('category', String(category));
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/faction/bulletin?${qs.toString()}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('获取势力公告失败:', error);
      throw error;
    }
  },

  /**
   * 设置主城（存卡）：首次免费；再次更换 500 银 + 24h 冷却；仅大城/中城、本势力占城。
   */
  async setMainCity(playerId, cityId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/main-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId }),
    });
    return response.json();
  },

  /** 道路：本人 `road_jun_id` / `road_position_*` 与粮草日累计（02 §2.1.2） */
  async getRoadSelf(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/self`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /**
   * 大地图立足无效（非道路/城/寨/大本营/战场）：服务端修复或强制随机战场入口。
   * @param {string} playerId
   */
  async repairRoadStand(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/repair-stand`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    return jsonFromApiResponse(response, '修复道路立足');
  },

  /**
   * 道路：沿路移动（权威写格位 + 粮草）；须 `confirmFoodCost: true` 与唯一 `clientRequestId`。
   * @param {string} playerId
   * @param {{ season: string, junId: string, path: Array<{x:number,y:number}>, clientRequestId: string, confirmFoodCost: true, targetPoiId?: string }} body
   * `targetPoiId` 可选：31-6 §7 本势力城心（`cities` 主键）或郡内匪寨（**`banditPoiId` / `san_*_bandit_*`**）终点时传入；服务端重算 path 并校验 POI。
   */
  async roadMove(playerId, body) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/move`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return jsonFromApiResponse(response, '道路移动');
  },

  /** 三公府 · 官职：下一品阶可晋升列表 */
  async getSanGongFuPromotions(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/promotions`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 三公府 · 官职晋升（与事件奖励授予官职同源：更新 players 官职列） */
  async promoteSanGongFu(playerId, positionId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/promote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
      },
    );
    return response.json();
  },

  /** 三公府 · 同级官职切换（Lv1/Lv2；24h CD） */
  async switchSanGongFuPeerPosition(playerId, positionId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/switch-peer-position`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
      },
    );
    return response.json();
  },

  /** 互动 · 朝贡：当日已上缴 / 剩余额度 */
  async getSanGongFuTributeStatus(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/tribute-status`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 朝贡：销毁所选军营池卡并发奖 */
  async submitSanGongFuTribute(playerId, instanceIds, cardType = 'troop') {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/tribute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceIds,
          cardType: cardType === 'character' ? 'character' : 'troop',
        }),
      },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 银粮兑换：四包预览（含松紧系数与当日额度） */
  async getSanGongFuResourceExchangePreview(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/resource-exchange-preview`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 银粮兑换：提交指定兑换包 */
  async submitSanGongFuResourceExchange(playerId, packId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/resource-exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 礼盒：传奇宝物兑换预览 */
  async getSanGongFuGiftBoxPreview(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/gift-box-preview`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 礼盒：消耗贡献兑换指定传奇宝物 */
  async submitSanGongFuGiftBox(playerId, treasureId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/gift-box`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treasureId }),
      },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 军备：贡献兑兵符/玉牌预览 */
  async getSanGongFuArmamentPreview(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/armament-preview`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 军备：消耗贡献兑换兵符或玉牌 */
  async submitSanGongFuArmament(playerId, offerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/armament`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      },
    );
    return response.json();
  },

  /** 三公府 · 朝政：本势力攻方进行中的攻城类 PVP 战事列表（品阶 Lv≤1） */
  async getSanGongFuPvpAttackingWars(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/pvp-attacking-wars`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 三公府 · 朝政：主动结束一条攻方 siege 战事（结算统计 TODO） */
  async cancelSanGongFuPvpAttackingWar(playerId, pvpWarId, body = {}) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/pvp-attacking-wars/${encodeURIComponent(pvpWarId)}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      },
    );
    return response.json();
  },

  /** 三公府 · 朝政：结束本势力有参与的进行中中立城 PVE（`wars`），品阶门闸与 PVP 撤战一致 */
  async cancelSanGongFuPveAttackingWar(playerId, warId, body = {}) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/pve-attacking-wars/${encodeURIComponent(warId)}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      },
    );
    return response.json();
  },

  /** 势力 Tab · 公告：谕旨 / 文书 / 战事（只读）+ 外交占位 */
  async getSanGongFuBulletin(playerId, { limitPerCategory = 30 } = {}) {
    const qs = new URLSearchParams({ limitPerCategory: String(limitPerCategory) });
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/bulletin?${qs.toString()}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 三公府 · 朝政 · 文书：当日发布次数（一品 position_level = 1） */
  async getSanGongFuDocumentStatus(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/document-status`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 三公府 · 朝政 · 文书：发布（body 为正文，每日最多 3 条） */
  async postSanGongFuDocument(playerId, body) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/document`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      },
    );
    return response.json();
  },

  /** 军营池 → 主城驻军所仓库 */
  async transferMainCityBarracksIn(playerId, instanceIds) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/main-city-barracks/transfer-in`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceIds }),
      },
    );
    return response.json();
  },

  /** 驻军所仓库 → 军营池（受军营部队张数上限） */
  async transferMainCityBarracksOut(playerId, instanceIds) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/main-city-barracks/transfer-out`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceIds }),
      },
    );
    return response.json();
  },

  /**
   * 个人中心「统计」：player_statistics 表一行
   */
  async getStatistics(playerId) {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/statistics`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    } catch (error) {
      console.error('获取统计数据失败:', error);
      throw error;
    }
  },

  /**
   * 个人中心「称号」：config_titles 全量 + 是否持有（player_cards.card_type=title）
   */
  async getTitleCatalog(playerId) {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/titles/catalog`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('获取称号目录失败:', error);
      throw error;
    }
  },

  /**
   * 个人中心「成就」：config_achievements 全量 + 是否持有（player_cards.card_type=achievement）
   */
  async getAchievementCatalog(playerId) {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/achievements/catalog`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('获取成就目录失败:', error);
      throw error;
    }
  },

  /**
   * 手动领取成就（条件已达成 + 链前置已领取）
   * @param {string} playerId
   * @param {string} achievementId
   */
  async claimAchievement(playerId, achievementId) {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/players/${playerId}/achievements/${encodeURIComponent(achievementId)}/claim`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      return response.json();
    } catch (error) {
      console.error('领取成就失败:', error);
      throw error;
    }
  },

  /**
   * 将领排名（同服、同 bucket）
   * @param {string} bucket - main:player | main:character1 | main:character2 | garrison:槽位:char1|char2
   */
  async getCharacterRank(playerId, bucket) {
    const q = encodeURIComponent(bucket);
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/character-rank?bucket=${q}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    return response.json();
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
      return jsonFromApiResponse(response, '获取可用势力');
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
      return jsonFromApiResponse(response, '删除角色创建进度');
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

  /** 获取或创建当前草稿装备卡（equipmentSet） */
  async getEquipmentSetDraft(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/equipment-set/draft`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    return response.json();
  },

  /** 单条套装（已命名装备卡编辑） */
  async getEquipmentSetById(playerId, setInstanceId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/equipment-set/${encodeURIComponent(setInstanceId)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    return response.json();
  },

  /** 已命名套装重命名（1～12 字，与 finalize 一致） */
  async renameEquipmentSet(playerId, setInstanceId, displayName) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/equipment-set/rename`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setInstanceId, displayName }),
      }
    );
    return response.json();
  },

  /** 草稿套装槽位：equipmentInstanceId 为 null 表示卸下 */
  async assignEquipmentSetSlot(playerId, setInstanceId, slot, equipmentInstanceId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/equipment-set/slot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setInstanceId, slot, equipmentInstanceId }),
      }
    );
    return response.json();
  },

  /** 四槽填满后为草稿套装命名 */
  async finalizeEquipmentSet(playerId, setInstanceId, displayName) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/equipment-set/finalize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setInstanceId, displayName }),
      }
    );
    return response.json();
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

  /**
   * 编组-道具使用：部队徽章 → 指定传奇/核心部队恢复满耐久
   * @param {string} playerId
   * @param {{ itemId: string, instanceId: string }} payload
   */
  async useItem(playerId, payload) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/items/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return jsonFromApiResponse(response, '使用道具');
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
  },

  /**
   * 匪寨攻打门闸（兵符）。`banditPoiId`：**匪寨地图对象 ID** `san_*_bandit_*`（04-1 §15），与行军 `targetPoiId` 同族。
   */
  async getBanditRaidQuota(playerId, banditPoiId) {
    const q = encodeURIComponent(String(banditPoiId || '').trim());
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/bandit-raid-quota?banditPoiId=${q}`,
    );
    return jsonFromApiResponse(response, '获取匪寨攻打门闸');
  },

  /**
   * 匪寨攻打：`consume` 开战扣 1 兵符；`reset_tower` 战败放弃，层进度回到第 1 层（不退兵符）。
   * @param {'consume'|'reset_tower'} action
   */
  async updateBanditRaidQuota(playerId, banditPoiId, action) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/bandit-raid-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banditPoiId, action }),
    });
    return jsonFromApiResponse(response, '更新匪寨攻打配额');
  },

  /**
   * 匪寨层间连战：粮草快补兵力（胜利结算点「继续」且选了补兵档时调用；不改 player_cards）。
   * @param {'light'|'heavy'} tier
   * @param {Array<{ instanceId: string, currentTroops: number, maxTroops: number }>} troops
   */
  async applyBanditRaidBetweenLayerHeal(playerId, tier, troops) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/bandit-raid-between-layer-heal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, troops }),
      },
    );
    return jsonFromApiResponse(response, '匪寨层间补兵');
  },

  /**
   * 获取探索开链兵符状态
   */
  async getExploreChainToken(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/explore-chain-token`);
    return response.json();
  },

  /**
   * 探索开链兵符 consume / refund
   * @param {{ action: 'consume'|'refund', continueChain?: boolean, triggerContext?: string }} body
   */
  async updateExploreChainToken(playerId, body) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/explore-chain-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return response.json();
  },

  /**
   * 获取探索配额（服务端存储）— **已改为返回兵符持有数**（兼容旧路径）
   */
  async getExploreQuota(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/explore-quota`);
    return response.json();
  },

  /**
   * 更新探索配额 — **已改为兵符扣/退**（fillMax 为 no-op 数据）
   * @param {string} action - 'consume' | 'refund' | 'fillMax'
   */
  async updateExploreQuota(playerId, action) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/explore-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    return response.json();
  },

  /**
   * 写入探索/教程链服务端会话锁（链进行中置位；结束或取消传 null）；与 GET …/events/explore 的 sessionLock 对齐。
   */
  async patchExploreSessionLock(playerId, sessionLock) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/events/explore/session-lock`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionLock }),
      }
    );
    return response.json();
  },

  /**
   * 大地图「攻城」滚屏：本人有参与的 **active PVE `wars`**（与 `wars_pvp` 共用 `player_events` 攻城次数）。
   * @param {string} playerId
   * @param {string} factionId
   * @param {string} season
   */
  async getActivePveSiegeWarsMap(playerId, factionId, season) {
    const qs = new URLSearchParams({
      playerId: String(playerId || ''),
      factionId: String(factionId || ''),
      season: String(season || ''),
    }).toString();
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/active-pve-siege-wars?${qs}`);
    return jsonFromApiResponse(response, '活跃 PVE 攻城');
  },

  /** 真三日报 · 面板数据（32-6） */
  async getDailyReport(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/daily-report`);
    return jsonFromApiResponse(response, '获取真三日报');
  },

  /** 真三日报 · 当日签到 */
  async postDailyReportCheckIn(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/daily-report/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return jsonFromApiResponse(response, '真三日报签到');
  },

  /** 真三日报 · 顶栏红点（轻量） */
  async getDailyReportCheckinNotify(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/daily-report/check-in-notify`,
    );
    return jsonFromApiResponse(response, '获取真三日报红点');
  },

  /** 真三日报 · 战事公议投票面板 */
  async getDailyReportWarVote(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/daily-report/war-vote`,
    );
    return jsonFromApiResponse(response, '获取战事公议');
  },

  /** 真三日报 · 战事公议投票（可改投） */
  async castDailyReportWarVote(playerId, cityId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/daily-report/war-vote`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId }),
      },
    );
    return jsonFromApiResponse(response, '战事公议投票');
  },
};
