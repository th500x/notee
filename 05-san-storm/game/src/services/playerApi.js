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
      '请确认已启动 05-san-storm/backend（默认 3005）、前端 API 基址指向该进程，并已拉取含道路遭遇路由的代码后重启后端。';
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

  /** 地图 Tab：san_1 七势力概览（与势力信息同源） */
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

  /** 道路：本人 `road_jun_id` / `road_position_*` / `road_intercept` 与粮草日累计（02 §2.1.2） */
  async getRoadSelf(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/self`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 道路：开启/关闭开战模式（守门）；`enable` + 可选 `clientRequestId` */
  async setRoadIntercept(playerId, enable, clientRequestId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/intercept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable, clientRequestId }),
      },
    );
    return response.json();
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

  /**
   * 口谕 👍👎 嘉奖：`reaction` 为 `up`（银两）或 `down`（声望）；服务端按 20 分钟槽幂等。
   * @param {string} playerId
   * @param {{ reaction: 'up' | 'down', scope?: 'casual' | 'active_war' }} body
   */
  async submitKingEdictFeedback(playerId, body) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/king-edict-feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return jsonFromApiResponse(response, '口谕嘉奖');
  },

  /** 道路：战后解锁遭遇实例；`defenderWon` 由客户端战报结果传入 */
  async resolveRoadEncounter(playerId, body) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/resolve-encounter`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return jsonFromApiResponse(response, '道路遭遇解锁');
  },

  /** 道路守方：遇袭轮询（fighting 且立点在交战格时返回 encounter，否则 null） */
  async getRoadPendingEncounter(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/pending-encounter`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return jsonFromApiResponse(response, '道路遇袭轮询');
  },

  /**
   * 道路遭遇：拉取 BattleArena 数据（与攻城 siegeData 对齐）。
   * @param {{ spectator?: boolean }} [opts] `spectator:true` 为守方观战（query `spectator=1`）。
   */
  async getRoadEncounterBattle(playerId, encounterId, opts = {}) {
    const q = new URLSearchParams();
    if (encounterId != null && String(encounterId).trim() !== '') {
      q.set('encounterId', String(encounterId).trim());
    }
    if (opts?.spectator) q.set('spectator', '1');
    const qs = q.toString();
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/encounter-battle${qs ? `?${qs}` : ''}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return jsonFromApiResponse(response, '道路遭遇开战数据');
  },

  /** 道路遭遇：服务端权威单场推演并结算（与披挂攻城 `siegePvpSkirmish` 同源） */
  async resolveRoadEncounterAuthoritative(playerId, encounterId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/encounter-authoritative-resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: encounterId != null ? String(encounterId).trim() : '' }),
      },
    );
    return jsonFromApiResponse(response, '道路遭遇权威结算');
  },

  /** 道路遭遇：裁定结果轮询（攻守均可；fighting 时 pending） */
  async getRoadEncounterAuthoritativeOutcome(playerId, encounterId) {
    const q = new URLSearchParams();
    if (encounterId != null && String(encounterId).trim() !== '') q.set('encounterId', String(encounterId).trim());
    const qs = q.toString();
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/encounter-authoritative-outcome${qs ? `?${qs}` : ''}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return jsonFromApiResponse(response, '道路遭遇裁定查询');
  },

  /** 道路遭遇：战后结算（防守兵力/银两声望/解锁遭遇） */
  async submitRoadEncounterBattleResult(playerId, body) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/road/encounter-battle-result`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      },
    );
    return jsonFromApiResponse(response, '道路遭遇结算');
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

  /** 互动 · 朝贡：当日已上缴 / 剩余额度 */
  async getSanGongFuTributeStatus(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/tribute-status`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 朝贡：销毁所选军营池部队卡并发奖 */
  async submitSanGongFuTribute(playerId, instanceIds) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/tribute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceIds }),
      },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 俸禄：当日是否已领、国力档位、是否可领 */
  async getSanGongFuStipendStatus(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/stipend-status`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  /** 互动 · 封赏 · 俸禄：领取当日银两与粮草（服务器日历日每账号 1 次） */
  async claimSanGongFuStipend(playerId) {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/san-gong-fu/stipend-claim`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
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
   * 匪寨攻打次数（与探索分立）。`banditPoiId`：**匪寨地图对象 ID** `san_*_bandit_*`（04-1 §15），与行军 `targetPoiId` 同族。
   */
  async getBanditRaidQuota(playerId, banditPoiId) {
    const q = encodeURIComponent(String(banditPoiId || '').trim());
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${playerId}/bandit-raid-quota?banditPoiId=${q}`,
    );
    return jsonFromApiResponse(response, '获取匪寨攻打配额');
  },

  /**
   * 匪寨攻打配额变更：`consume` 开战扣次；`reset_tower` 战败放弃，层进度回到第 1 层（不返还次数）。
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
   * 获取探索配额（服务端存储）
   */
  async getExploreQuota(playerId) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/explore-quota`);
    return response.json();
  },

  /**
   * 更新探索配额
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
};
