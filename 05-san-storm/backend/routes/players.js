/**
 * 玩家路由
 *
 * 纯 HTTP 适配层：参数解析、格式校验、Service 调用、响应序列化。
 * 不包含任何直接 SQL；业务逻辑均委托对应 Service。
 */

const express = require('express');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { roadMoveLimiter } = require('../middleware/rateLimit');
const Player = require('../models/Player');
const PlayerService = require('../services/playerService');
const equipmentSetService = require('../services/equipmentSetService');
const characterRankService = require('../services/characterRankService');
const playerCardLineupService = require('../services/playerCardLineupService');
const playerExploreEventService = require('../services/playerExploreEventService');
const playerExploreQuotaService = require('../services/playerExploreQuotaService');
const playerBanditRaidQuotaService = require('../services/playerBanditRaidQuotaService');
const playerItemsService = require('../services/playerItemsService');
const playerRerollService = require('../services/playerRerollService');
const playerProfileService = require('../services/playerProfileService');
const playerStatisticsService = require('../services/playerStatisticsService');
const playerEventRewardsService = require('../services/playerEventRewardsService');
const playerCreationService = require('../services/playerCreationService');
const playerMainCityService = require('../services/playerMainCityService');
const { getAvatarCategories } = require('../services/avatarService');
const mainCityBarracksStorageService = require('../services/mainCityBarracksStorageService');
const positionPromotionService = require('../services/positionPromotionService');
const factionOverviewService = require('../services/factionOverviewService');
const factionBulletinService = require('../services/factionBulletinService');
const sanGongTributeService = require('../services/sanGongTributeService');
const sanGongStipendService = require('../services/sanGongStipendService');
const roadEncounterService = require('../services/roadEncounterService');
const pvpWarService = require('../services/pvpWarService');
const cityService = require('../services/cityService');
const kingEdictFeedbackService = require('../services/kingEdictFeedbackService');

const router = express.Router();

/**
 * 鉴权（必改 #1）：
 *   - `router.use(requireAuth)` —— 本路由全部接口都要求合法 JWT。
 *   - `router.param('playerId', requireSelf())` —— 任何 URL 含 `:playerId` 的路由，须 token.sub 与之匹配（admin 角色除外）。
 *   - `/:playerId/texts/*` 由子路由 `texts.js` 承载，使用 `mergeParams:true`；上行 requireAuth 已覆盖，
 *     这里在挂载点再显式套一层 `requireSelf()` 以避免 `router.param` 不传播到子路由的歧义（见
 *     [Express 4.x router.param docs](https://expressjs.com/en/4x/api.html#router.param)）。
 *   - 注意：`/avatars`、`/check/:playerId`、`/generate-attributes`、`/validate-name`、`/create`
 *     等不带或带 `:playerId` 的注册 / 角色创建辅助接口同样要求 token；前端 `gameUserAPI.login`
 *     成功后即写入 token，再进入角色创建流程，因此不会破坏现有用户路径。
 */
router.use(requireAuth);
router.param('playerId', requireSelf());

// ── 头像 ────────────────────────────────────────────────────────────────────

/**
 * GET /api/players/avatars
 * 获取可用头像列表（按分类分组）
 *
 * 实现：见 `services/avatarService.js` —— 异步 fs.promises.readdir + TTL 缓存（生产 5 分钟、
 * 开发 30 秒；可由 `AVATAR_CACHE_TTL_MS` 覆盖）+ 单飞防击穿。本路由仅做 HTTP 适配。
 */
router.get('/avatars', async (req, res, next) => {
  try {
    const categories = await getAvatarCategories();
    res.set('Cache-Control', 'private, max-age=60');
    res.json({ success: true, data: { categories } });
  } catch (error) {
    return next(wrap500(error, '获取头像列表失败'));
  }
});

// ── 账号检查 ─────────────────────────────────────────────────────────────────

/**
 * GET /api/players/check/:playerId
 * 检查玩家是否存在
 */
router.get('/check/:playerId', async (req, res, next) => {
  try {
    const exists = await Player.exists(req.params.playerId);
    res.json({ success: true, data: { exists } });
  } catch (error) {
    return next(wrap500(error, '检查玩家失败'));
  }
});

const textsRouter = require('./texts');
const { wrap500 } = require('../utils/httpError');
router.use('/:playerId/texts', requireSelf(), textsRouter);

// ── 角色创建辅助 ──────────────────────────────────────────────────────────────

/**
 * POST /api/players/generate-attributes
 * 生成属性方案（9选1）
 */
router.post('/generate-attributes', async (req, res, next) => {
  try {
    const { rarity = 'common' } = req.body;
    const options = await PlayerService.generateAttributeOptions(rarity);
    res.json({ success: true, data: { options } });
  } catch (error) {
    return next(wrap500(error, '生成属性方案失败'));
  }
});

/**
 * POST /api/players/validate-name
 * 验证角色名（格式 + 重名检查）
 */
router.post('/validate-name', async (req, res, next) => {
  try {
    const { characterName, serverId } = req.body;
    const validation = PlayerService.validateCharacterName(characterName);
    if (!validation.valid) {
      return res.json({ success: true, data: { valid: false, error: validation.error } });
    }
    const nameTaken = await Player.isNameTaken(characterName, serverId);
    if (nameTaken) {
      return res.json({ success: true, data: { valid: false, error: '该角色名已被使用，请重新输入' } });
    }
    res.json({ success: true, data: { valid: true } });
  } catch (error) {
    return next(wrap500(error, '验证角色名失败'));
  }
});

/**
 * POST /api/players/create
 * 创建玩家角色
 */
router.post('/create', async (req, res, next) => {
  try {
    const {
      playerId, characterName, factionId, factionName,
      attributes, skills, initialTroops, serverId, initialSilver, avatar,
    } = req.body;

    if (!playerId || !characterName || !factionId || !factionName || !attributes || !serverId) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const devBypass = req.player._devBypass && req.player.sub == null;
    if (!devBypass && req.player.role !== 'admin' && String(playerId) !== String(req.player.sub)) {
      return res.status(403).json({ success: false, error: '无权为他人创建角色', code: 'FORBIDDEN' });
    }

    const player = await PlayerService.createCharacter({
      playerId, characterName, factionId, factionName, attributes,
      skills: skills || null, serverId, initialSilver: initialSilver || 0, avatar: avatar || null,
    });

    if (initialTroops && initialTroops.length > 0) {
      await PlayerService.addInitialTroops(playerId, initialTroops);
    }

    res.json({ success: true, message: '角色创建成功', data: player });
  } catch (error) {
    return next(wrap500(error, '创建角色失败'));
  }
});

/**
 * GET /api/players/:playerId/factions/available
 * 获取可用势力列表（含当前玩家数与推荐标记）
 */
router.get('/:playerId/factions/available', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    console.log('[Factions] 获取可用势力列表, playerId:', playerId);
    const result = await playerCreationService.getAvailableFactions(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    res.json({ success: true, data: { factions: result.factions } });
  } catch (error) {
    return next(wrap500(error, '获取可用势力失败'));
  }
});

/**
 * GET /api/players/:playerId/faction/overview
 * 势力 Tab「势力信息」象限：官职、人数、城市摘要、五维档位、储备（camelCase）
 */
router.get('/:playerId/faction/overview', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await factionOverviewService.getFactionOverviewForPlayer(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    const d = result.data;
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        factionId: d.factionId,
        factionName: d.factionName,
        reserveSilver: d.reserveSilver,
        reserveFood: d.reserveFood,
        totals: d.totals,
        supplyTier: d.supplyTier,
        playerCountReal: d.playerCountReal,
        playerCountNpc: d.playerCountNpc,
        legionCount: d.legionCount,
        cityCount: d.cityCount,
        officeHolders: d.officeHolders,
        citiesMajorLines: d.citiesMajorLines,
        citiesMediumLines: d.citiesMediumLines,
        citiesSmallByZhou: d.citiesSmallByZhou,
        citiesGateByZhou: d.citiesGateByZhou,
        citiesFortByZhou: d.citiesFortByZhou,
        playersReal: d.playersReal,
        playersNpc: d.playersNpc,
        legions: d.legions,
        citiesList: d.citiesList,
      },
    });
  } catch (error) {
    return next(wrap500(error, '获取势力信息失败'));
  }
});

/**
 * GET /api/players/:playerId/faction/bulletin?limit=50
 * 势力 Tab「公告」象限：按玩家所属势力拉取战事/系统流水（新在前）。
 */
router.get('/:playerId/faction/bulletin', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const row = await Player.getById(playerId);
    if (!row) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    const factionId = row.faction_id || null;
    if (!factionId) {
      return res.json({ success: true, data: { entries: [] } });
    }
    const entries = await factionBulletinService.listForFaction(factionId, { limit: lim });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { entries, factionId } });
  } catch (error) {
    return next(wrap500(error, '获取势力公告失败'));
  }
});

/**
 * GET /api/players/:playerId/troops/initial
 * 获取初始部队选项
 */
router.get('/:playerId/troops/initial', async (req, res, next) => {
  try {
    const { factionId } = req.query;
    if (!factionId) {
      return res.status(400).json({ success: false, error: '缺少势力ID' });
    }
    const result = await playerCreationService.getInitialTroopOptions(factionId);
    res.json({ success: true, data: result });
  } catch (error) {
    return next(wrap500(error, '获取初始部队选项失败'));
  }
});

/**
 * GET /api/players/:playerId/creation-progress
 * 获取角色创建进度草稿
 */
router.get('/:playerId/creation-progress', async (req, res, next) => {
  try {
    const progress = await playerCreationService.getCreationProgress(req.params.playerId);
    res.json({ success: true, data: progress });
  } catch (error) {
    return next(wrap500(error, '获取角色创建进度失败'));
  }
});

/**
 * POST /api/players/:playerId/creation-progress
 * 保存角色创建进度草稿
 */
router.post('/:playerId/creation-progress', async (req, res, next) => {
  try {
    await playerCreationService.saveCreationProgress(req.params.playerId, req.body);
    res.json({ success: true, message: '进度已保存' });
  } catch (error) {
    return next(wrap500(error, '保存角色创建进度失败'));
  }
});

/**
 * POST /api/players/:playerId/generate-attributes-batch
 * 生成属性方案（新批次），扣除银两
 */
router.post('/:playerId/generate-attributes-batch', async (req, res, next) => {
  try {
    const { rarity = 'common' } = req.body;
    const result = await playerCreationService.generateAttributesBatch(req.params.playerId, rarity);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '未找到角色创建进度' });
    }
    if (result.insufficientSilver) {
      return res.status(400).json({ success: false, error: `银两不足，需要${result.cost}银两才能重新随机` });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '生成属性批次失败'));
  }
});

/**
 * POST /api/players/:playerId/select-option
 * 选择属性方案
 */
router.post('/:playerId/select-option', async (req, res, next) => {
  try {
    const { batch, index } = req.body;
    if (batch === undefined || index === undefined) {
      return res.status(400).json({ success: false, error: '缺少批次号或索引' });
    }
    await playerCreationService.selectAttributeOption(req.params.playerId, batch, index);
    res.json({ success: true, message: '方案已选择' });
  } catch (error) {
    return next(wrap500(error, '选择属性方案失败'));
  }
});

/**
 * DELETE /api/players/:playerId/creation-progress
 * 删除角色创建进度草稿（角色创建完成后调用）
 */
router.delete('/:playerId/creation-progress', async (req, res, next) => {
  try {
    await playerCreationService.deleteCreationProgress(req.params.playerId);
    res.json({ success: true, message: '进度已删除' });
  } catch (error) {
    return next(wrap500(error, '删除角色创建进度失败'));
  }
});

// ── 玩家档案与进度 ────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/character-rank?bucket=…
 * bucket：main:player | main:character1 | main:character2 | garrison:槽位:char1|char2
 */
router.get('/:playerId/character-rank', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const bucket = req.query.bucket;
    if (!bucket || typeof bucket !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 bucket 参数' });
    }
    const data = await characterRankService.getCharacterRankForBucket(playerId, bucket);
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '查询将领排名失败'));
  }
});

/**
 * GET /api/players/:playerId/statistics
 * 个人中心「统计」：读取 statistics 表一行（camelCase）
 */
router.get('/:playerId/statistics', async (req, res, next) => {
  try {
    const result = await playerStatisticsService.getPlayerStatistics(req.params.playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '统计数据不存在' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '获取统计数据失败'));
  }
});

/**
 * GET /api/players/:playerId/profile
 * 获取玩家完整档案（基础信息 + 卡牌）
 */
/**
 * POST /api/players/:playerId/main-city
 * body: { cityId } — 设为主城（存卡）；首次免费，再次更换 500 银 + 24h 冷却；仅大城/中城、本势力占城。
 */
router.post('/:playerId/main-city', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const { cityId } = req.body || {};
    const out = await playerMainCityService.setPlayerMainCity(playerId, cityId);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '设置主城失败'));
  }
});

// ── 道路守门 / 沿路移动 / 遭遇（02 §2.1.2、31-6） ─────────────────────────────

/**
 * POST /api/players/:playerId/road/intercept
 * body: { enable: boolean, clientRequestId?: string }
 * 开启（0→1）扣 40 银；已为 1 不再扣；enable:false 关闭（默认不退费）。
 */
router.post('/:playerId/road/intercept', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const { enable, clientRequestId } = req.body || {};
    if (typeof enable !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enable 必须为 boolean' });
    }
    const out = await roadEncounterService.setIntercept(playerId, enable, clientRequestId);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '切换道路开战模式失败'));
  }
});

/**
 * GET /api/players/:playerId/road/self
 * 返回本人 road_jun_id / road_position_x/y / road_intercept / road_updated_at。
 */
router.get('/:playerId/road/self', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await roadEncounterService.getSelfRoadState(playerId);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '读取道路状态失败'));
  }
});

/**
 * POST /api/players/:playerId/road/move
 * body: { season, junId, path:[{x,y}], clientRequestId, confirmFoodCost:true, targetPoiId? }
 * 权威写 players.road_position_* + 粮草链路（player.food → factions.reserve_food 日上限 500）。
 * 可选 targetPoiId：31-6 §9.4 城心/匪寨终点（cities.city_id），见 04-1 §15.4。
 */
router.post('/:playerId/road/move', roadMoveLimiter, async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await roadEncounterService.moveAlongRoad(playerId, req.body || {});
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '沿路移动失败'));
  }
});

/**
 * POST /api/players/:playerId/road/resolve-encounter
 * body: { encounterId, battleId?, defenderWon: boolean }
 * 战后解锁：road_encounters.status='resolved'；守门方战败关闭 road_intercept。
 */
router.post('/:playerId/road/resolve-encounter', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await roadEncounterService.resolveEncounter(playerId, req.body || {});
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '解锁道路遭遇失败'));
  }
});

/**
 * GET /api/players/:playerId/road/pending-encounter
 * 守方立点与交战格一致且 fighting 时返回遇袭摘要，否则 encounter=null（与 `/pvp/pending` 对称）。
 */
router.get('/:playerId/road/pending-encounter', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await roadEncounterService.getPendingDefenderEncounter(playerId);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '道路遇袭轮询失败'));
  }
});

/**
 * GET /api/players/:playerId/road/encounter-battle?encounterId=&spectator=1
 * 道路遭遇：默认进攻方开战数据；`spectator=1` 时为守方观战（skipSiegeResult + npcGarrison=攻方上阵）。
 */
router.get('/:playerId/road/encounter-battle', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const encounterId = req.query.encounterId != null ? String(req.query.encounterId).trim() : '';
    const spectator = String(req.query.spectator || '').trim() === '1';
    const out = await roadEncounterService.getEncounterBattlePayload(playerId, encounterId, { spectator });
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '道路遭遇开战数据失败'));
  }
});

/**
 * POST /api/players/:playerId/road/encounter-authoritative-resolve
 * body: { encounterId } — 与披挂攻城同源 `runSiegePvpSkirmish` 单场服务端推演并写库（进攻方）
 */
router.post('/:playerId/road/encounter-authoritative-resolve', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const encounterId = req.body?.encounterId != null ? String(req.body.encounterId).trim() : '';
    const out = await roadEncounterService.resolveAuthoritativeRoadEncounter(playerId, encounterId);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '道路权威结算失败'));
  }
});

/**
 * GET /api/players/:playerId/road/encounter-authoritative-outcome?encounterId=
 * 攻守双方轮询：fighting 时 pending；resolved 后返回推演快照 JSON
 */
router.get('/:playerId/road/encounter-authoritative-outcome', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const encounterId = req.query.encounterId != null ? String(req.query.encounterId).trim() : '';
    const out = await roadEncounterService.getRoadEncounterAuthoritativeOutcome(playerId, encounterId);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '道路裁定查询失败'));
  }
});

/**
 * POST /api/players/:playerId/road/encounter-battle-result
 * body: { encounterId, factionId, killedIndices, result, silverSpent?, battleScore?, battleReportSaved?, battleId? }
 */
router.post('/:playerId/road/encounter-battle-result', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await roadEncounterService.recordEncounterBattleSettlement(playerId, req.body || {});
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '道路遭遇结算失败'));
  }
});

/**
 * POST /api/players/:playerId/main-city-barracks/transfer-in
 * body: { instanceIds: string[] } — 军营池 → 主城驻军所仓库
 */
router.post('/:playerId/main-city-barracks/transfer-in', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await mainCityBarracksStorageService.transferIn(playerId, req.body?.instanceIds);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true });
  } catch (error) {
    return next(wrap500(error, '驻军所转入失败'));
  }
});

/**
 * POST /api/players/:playerId/main-city-barracks/transfer-out
 * body: { instanceIds: string[] } — 驻军所仓库 → 军营池（受军营部队 20 张上限约束）
 */
router.post('/:playerId/main-city-barracks/transfer-out', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await mainCityBarracksStorageService.transferOut(playerId, req.body?.instanceIds);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true });
  } catch (error) {
    return next(wrap500(error, '驻军所转出失败'));
  }
});

/**
 * GET /api/players/:playerId/san-gong-fu/promotions
 * 三公府 · 官职：下一品阶（position_level = 当前 − 1）可晋升列表
 */
router.get('/:playerId/san-gong-fu/promotions', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await positionPromotionService.getPromotionsForPlayer(playerId);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '获取晋升列表失败'));
  }
});

/**
 * POST /api/players/:playerId/san-gong-fu/promote
 * body: { positionId: string }
 */
router.post('/:playerId/san-gong-fu/promote', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const positionId = req.body?.positionId;
    const out = await positionPromotionService.promotePlayer(playerId, positionId);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '晋升失败'));
  }
});

/**
 * POST /api/players/:playerId/king-edict-feedback
 * body: { reaction: 'up' | 'down', scope?: 'casual' | 'active_war' } — 口谕 👍/👎；`scope` 缺省为 casual；与主动战事口谕分轨幂等。
 */
router.post('/:playerId/king-edict-feedback', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const reaction = req.body?.reaction;
    const scope = req.body?.scope === 'active_war' ? 'active_war' : 'casual';
    const out = await kingEdictFeedbackService.submitKingEdictFeedback(playerId, reaction, {
      scope,
    });
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '口谕嘉奖失败'));
  }
});

/**
 * GET /api/players/:playerId/san-gong-fu/tribute-status
 * 朝政 · 朝贡：当日已上缴张数 / 剩余额度
 */
router.get('/:playerId/san-gong-fu/tribute-status', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const data = await sanGongTributeService.getTributeDailyStatus(playerId);
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '朝贡额度查询失败'));
  }
});

/**
 * POST /api/players/:playerId/san-gong-fu/tribute
 * body: { instanceIds: string[] } — 销毁军营池部队卡，按攻城单杀银两/贡献 1.5 倍发玩家；势力储备银两同额、粮草=银两×5
 */
router.post('/:playerId/san-gong-fu/tribute', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await sanGongTributeService.submitTroopTribute(playerId, req.body?.instanceIds);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out });
  } catch (error) {
    return next(wrap500(error, '朝贡失败'));
  }
});

/**
 * GET /api/players/:playerId/san-gong-fu/stipend-status
 * 互动 · 封赏 · 俸禄：当日是否已领、国力档位、是否可领
 */
router.get('/:playerId/san-gong-fu/stipend-status', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const data = await sanGongStipendService.getStipendStatus(playerId);
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '俸禄状态查询失败'));
  }
});

/**
 * POST /api/players/:playerId/san-gong-fu/stipend-claim
 * 领取当日俸禄（服务器日历日每账号最多 1 次；银两/粮草由国力档位与随机区间结算）
 */
router.post('/:playerId/san-gong-fu/stipend-claim', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const out = await sanGongStipendService.claimStipend(playerId);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: out.error });
    }
    res.json({ success: true, data: out });
  } catch (error) {
    return next(wrap500(error, '领取俸禄失败'));
  }
});

/**
 * GET /api/players/:playerId/san-gong-fu/pvp-attacking-wars
 * 朝政 · 势力战事：本势力作为攻方、进行中的攻城类（siege）PVP 战事列表（品阶 Lv≤3）。
 */
router.get('/:playerId/san-gong-fu/pvp-attacking-wars', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const data = await pvpWarService.listSanGongAttackingSiegeWarsForPlayer(playerId);
    res.json({ success: true, data });
  } catch (error) {
    const code = Number(error.statusCode);
    if (code >= 400 && code < 500) {
      return res.status(code).json({ success: false, error: error.message });
    }
    return next(wrap500(error, '查询势力战事失败'));
  }
});

/**
 * POST /api/players/:playerId/san-gong-fu/pvp-attacking-wars/:pvpWarId/cancel
 * body: { reason?: string } — 攻方朝政入口主动撤战（结算统计 TODO，见 pvpWarService.cancelPvpWar）。
 */
router.post('/:playerId/san-gong-fu/pvp-attacking-wars/:pvpWarId/cancel', async (req, res, next) => {
  try {
    const { playerId, pvpWarId } = req.params;
    const data = await pvpWarService.cancelAttackingSiegeWarViaSanGongChaoZheng(
      playerId,
      pvpWarId,
      req.body || {},
    );
    res.json({ success: true, data });
  } catch (error) {
    const code = Number(error.statusCode);
    if (code >= 400 && code < 500) {
      return res.status(code).json({ success: false, error: error.message });
    }
    return next(wrap500(error, '结束势力战事失败'));
  }
});

/**
 * POST /api/players/:playerId/san-gong-fu/pve-attacking-wars/:warId/cancel
 * body: { reason?: string } — 朝政入口结束本势力有参与的 **进行中** 中立城 PVE（`wars`）。
 */
router.post('/:playerId/san-gong-fu/pve-attacking-wars/:warId/cancel', async (req, res, next) => {
  try {
    const { playerId, warId } = req.params;
    const data = await cityService.cancelActivePveSiegeWarViaSanGongChaoZheng(
      playerId,
      warId,
      req.body || {},
    );
    res.json({ success: true, data });
  } catch (error) {
    const code = Number(error.statusCode);
    if (code >= 400 && code < 500) {
      return res.status(code).json({ success: false, error: error.message });
    }
    return next(wrap500(error, '结束中立城攻城战事失败'));
  }
});

router.get('/:playerId/profile', async (req, res, next) => {
  try {
    const result = await playerProfileService.getPlayerProfile(req.params.playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '获取玩家档案失败'));
  }
});

// ── 卡牌装备（阵容编组） ──────────────────────────────────────────────────────

/**
 * POST /api/players/:playerId/cards/equip
 * 装备卡牌到指定槽位
 * body: { instanceId, equippedBy, equippedSlot }
 */
router.post('/:playerId/cards/equip', async (req, res, next) => {
  try {
    const result = await playerCardLineupService.equipCard(req.params.playerId, req.body);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true });
  } catch (error) {
    return next(wrap500(error, '装备卡牌失败'));
  }
});

/**
 * POST /api/players/:playerId/cards/unequip
 * 卸下卡牌
 * body: { instanceId }
 */
router.post('/:playerId/cards/unequip', async (req, res, next) => {
  try {
    const result = await playerCardLineupService.unequipCard(req.params.playerId, req.body);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true });
  } catch (error) {
    return next(wrap500(error, '卸下卡牌失败'));
  }
});

// ── 装备套装 ──────────────────────────────────────────────────────────────────

/** 装备套装 Service 错误码 → HTTP 响应映射 */
function equipmentSetHttpFromError(err) {
  const table = {
    INVALID_SLOT:                [400, '槽位无效'],
    SET_NOT_FOUND:               [404, '套装卡不存在'],
    RENAME_DRAFT_USE_FINALIZE:   [400, '草稿套装请通过「完成封装」命名'],
    EQUIPMENT_NOT_FOUND:         [404, '装备件不存在'],
    ALREADY_EQUIPPED:            [400, '该装备件已上阵，请先卸下'],
    TYPE_MISMATCH:               [400, '装备类型与槽位不符'],
    BOUND_ELSEWHERE:             [400, '该装备件已编入其他套装'],
    DUPLICATE_PIECE:             [400, '套装内不能重复放入同一件'],
    CANNOT_REMOVE_FINALIZED_SLOT:[400, '已封装装备卡仅支持更换，不可卸下'],
    INVALID_NAME:                [400, '名称需在 1～12 字'],
    ALREADY_FINALIZED:           [400, '该套装已命名'],
    INCOMPLETE:                  [400, '四个槽位均需放入装备件后才能命名'],
  };
  const row = table[err?.code];
  if (row) return { status: row[0], body: { success: false, error: row[1], code: err.code } };
  return null;
}

/**
 * GET /api/players/:playerId/equipment-set/draft
 * 获取或创建当前唯一草稿装备卡
 */
router.get('/:playerId/equipment-set/draft', async (req, res, next) => {
  try {
    const row  = await equipmentSetService.getOrCreateDraftSet(req.params.playerId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({ success: true, data: { instance_id: row.instance_id, equipment_set_data: data } });
  } catch (error) {
    return next(wrap500(error, '获取草稿套装失败'));
  }
});

/**
 * GET /api/players/:playerId/equipment-set/:setInstanceId
 * 单条套装（用于编辑已命名装备卡）
 */
router.get('/:playerId/equipment-set/:setInstanceId', async (req, res, next) => {
  try {
    const { playerId, setInstanceId } = req.params;
    const row  = await equipmentSetService.getEquipmentSetById(playerId, setInstanceId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({ success: true, data: { instance_id: row.instance_id, equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    return next(wrap500(error, '读取套装失败'));
  }
});

/**
 * POST /api/players/:playerId/equipment-set/rename
 * body: { setInstanceId, displayName }
 */
router.post('/:playerId/equipment-set/rename', async (req, res, next) => {
  try {
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    const data = await equipmentSetService.renameEquipmentSet(req.params.playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    return next(wrap500(error, '重命名失败'));
  }
});

/**
 * POST /api/players/:playerId/equipment-set/slot
 * body: { setInstanceId, slot, equipmentInstanceId|null }
 */
router.post('/:playerId/equipment-set/slot', async (req, res, next) => {
  try {
    const { setInstanceId, slot, equipmentInstanceId } = req.body || {};
    if (!setInstanceId || !slot) {
      return res.status(400).json({ success: false, error: '缺少 setInstanceId 或 slot' });
    }
    const data = await equipmentSetService.assignSlot(
      req.params.playerId, setInstanceId, slot, equipmentInstanceId || null,
    );
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    return next(wrap500(error, '更新套装槽位失败'));
  }
});

/**
 * POST /api/players/:playerId/equipment-set/finalize
 * body: { setInstanceId, displayName }
 */
router.post('/:playerId/equipment-set/finalize', async (req, res, next) => {
  try {
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    const data = await equipmentSetService.finalizeSet(req.params.playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    return next(wrap500(error, '命名套装失败'));
  }
});

// ── 事件系统 ──────────────────────────────────────────────────────────────────

/**
 * POST /api/players/:playerId/rewards
 * 执行奖励发放（后端重新计算 multiplier，不信任前端传值）
 */
router.post('/:playerId/rewards', async (req, res, next) => {
  try {
    const out = await playerEventRewardsService.executeEventRewards(req.params.playerId, req.body);
    if (!out.ok) return res.status(out.status).json(out.json);
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '执行奖励失败'));
  }
});

/**
 * GET /api/players/:playerId/events/explore
 * 获取玩家探索事件进度（含每日重置检查）
 */
router.get('/:playerId/events/explore', async (req, res, next) => {
  try {
    const result = await playerExploreEventService.getExploreEvents(req.params.playerId);
    res.json({ success: true, data: result });
  } catch (error) {
    return next(wrap500(error, '获取探索事件进度失败'));
  }
});

/**
 * PATCH /api/players/:playerId/events/explore/session-lock
 * body: { sessionLock: object | null } — 探索/教程链进行中会话（跨设备）；清空传 null
 */
router.patch('/:playerId/events/explore/session-lock', async (req, res, next) => {
  try {
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'sessionLock')) {
      return res.status(400).json({ success: false, error: '缺少 sessionLock 字段（清空锁请传 null）' });
    }
    const sessionLock = req.body.sessionLock;
    if (sessionLock !== null && typeof sessionLock !== 'object') {
      return res.status(400).json({ success: false, error: 'sessionLock 须为对象或 null' });
    }
    await playerExploreEventService.setExploreSessionLock(req.params.playerId, sessionLock);
    res.json({ success: true });
  } catch (error) {
    return next(wrap500(error, '更新探索会话锁失败'));
  }
});

/**
 * POST /api/players/:playerId/events
 * 记录事件进度
 * body: { eventId, eventType, status?, data? }
 */
router.post('/:playerId/events', async (req, res, next) => {
  try {
    const { eventId, eventType, status = 'completed', data = {} } = req.body;
    if (!eventId || !eventType) {
      return res.status(400).json({ success: false, error: '缺少 eventId 或 eventType' });
    }
    const result = await playerExploreEventService.recordEventProgress(
      req.params.playerId, { eventId, eventType, status, data },
    );
    if (result.badRequest) {
      return res.status(400).json({ success: false, error: result.badRequest });
    }
    res.json({ success: true, data: { eventId: result.eventId, field: result.field, status: result.status } });
  } catch (error) {
    return next(wrap500(error, '记录事件进度失败'));
  }
});

// ── 道具 ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/items
 * 获取玩家道具列表
 */
router.get('/:playerId/items', async (req, res, next) => {
  try {
    const result = await playerItemsService.listItems(req.params.playerId);
    if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
    res.json({ success: true, data: { items: result.items } });
  } catch (error) {
    return next(wrap500(error, '获取道具失败'));
  }
});

/**
 * POST /api/players/:playerId/items
 * 添加道具（事件奖励发放）
 * body: { itemId, quantity? }
 */
router.post('/:playerId/items', async (req, res, next) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const result = await playerItemsService.addItem(req.params.playerId, itemId, quantity);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: { itemId: result.itemId, quantity: result.quantity } });
  } catch (error) {
    return next(wrap500(error, '添加道具失败'));
  }
});

/**
 * DELETE /api/players/:playerId/items
 * 消耗道具（事件链 required_items 扣除）
 * body: { itemId, quantity? }
 */
router.delete('/:playerId/items', async (req, res, next) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const result = await playerItemsService.consumeItem(req.params.playerId, itemId, quantity);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: { itemId: result.itemId, remaining: result.remaining } });
  } catch (error) {
    return next(wrap500(error, '消耗道具失败'));
  }
});

// ── 匪寨攻打次数（战略格；与探索配额分立）──────────────────────────────────────

/**
 * GET /api/players/:playerId/bandit-raid-quota?banditPoiId=san_1_bandit_1_yingchuan
 * `banditPoiId`：匪寨地图对象 ID（04-1 §15），与 `targetPoiId` 同族。
 * `data.worldDurability`：null 或 { maxLayers, clearedLayers, layersRemaining }（与 `bandits` 列语义一致）。`data.junId`：该匪寨所属郡（攻打次数按郡共用）。
 */
router.get('/:playerId/bandit-raid-quota', async (req, res, next) => {
  try {
    const banditPoiId = req.query.banditPoiId;
    if (!banditPoiId || String(banditPoiId).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少 banditPoiId（匪寨地图对象 ID，04-1 §15）' });
    }
    const result = await playerBanditRaidQuotaService.getRaidQuotaState(req.params.playerId, banditPoiId);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '获取匪寨攻打配额失败'));
  }
});

/**
 * POST /api/players/:playerId/bandit-raid-quota
 * body: { banditPoiId, action: 'consume' | 'reset_tower' } — `reset_tower`：战败放弃，个人层进度回到第 1 层，不返还攻打次数。
 */
router.post('/:playerId/bandit-raid-quota', async (req, res, next) => {
  try {
    const { banditPoiId, action } = req.body || {};
    const result = await playerBanditRaidQuotaService.applyRaidQuotaAction(
      req.params.playerId,
      banditPoiId,
      action,
    );
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '更新匪寨攻打配额失败'));
  }
});

// ── 探索配额 ──────────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/explore-quota
 * 获取探索配额（服务端计算恢复，防跨浏览器重复恢复）
 */
router.get('/:playerId/explore-quota', async (req, res, next) => {
  try {
    const data = await playerExploreQuotaService.getExploreQuotaState(req.params.playerId);
    res.json({
      success: true,
      data: {
        remaining:      data.remaining,
        lastRefillTs:   data.lastRefillTs,
        max:            data.max,
        refillPerHour:  data.refillPerHour,
      },
    });
  } catch (error) {
    return next(wrap500(error, '获取探索配额失败'));
  }
});

/**
 * POST /api/players/:playerId/explore-quota
 * 更新探索配额（消耗/退还/填满）
 * body: { action: 'consume' | 'refund' | 'fillMax' }
 */
router.post('/:playerId/explore-quota', async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['consume', 'refund', 'fillMax'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的 action' });
    }
    const result = await playerExploreQuotaService.applyExploreQuotaAction(req.params.playerId, action);
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '更新探索配额失败'));
  }
});

// ── 属性随机（在线随机） ───────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/reroll-status
 * 获取属性随机状态
 */
router.get('/:playerId/reroll-status', async (req, res, next) => {
  try {
    const result = await playerRerollService.getRerollStatus(req.params.playerId);
    if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '获取属性随机状态失败'));
  }
});

/**
 * POST /api/players/:playerId/reroll-attributes
 * 执行属性随机（扣银两、生成3方案、记录批次）
 */
router.post('/:playerId/reroll-attributes', async (req, res, next) => {
  try {
    const result = await playerRerollService.rerollAttributes(req.params.playerId);
    if (result.notFound)   return res.status(404).json({ success: false, error: '玩家不存在' });
    if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '属性随机失败'));
  }
});

/**
 * POST /api/players/:playerId/reroll-confirm
 * 确认选择属性方案（更新7属性+技能）
 */
router.post('/:playerId/reroll-confirm', async (req, res, next) => {
  try {
    const { batch, index } = req.body;
    const result = await playerRerollService.rerollConfirm(req.params.playerId, batch, index);
    if (result.notFound)   return res.status(404).json({ success: false, error: '玩家不存在' });
    if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
    res.json({ success: true, data: result.data });
  } catch (error) {
    return next(wrap500(error, '确认属性方案失败'));
  }
});

// ── 玩家基础信息（必须放在所有 `/:playerId/...` 子路径之后，避免误匹配或维护时遮蔽）────

/**
 * GET /api/players/:playerId
 * 获取玩家信息
 */
router.get('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const player = await Player.getById(playerId);
    if (!player) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    res.json({ success: true, data: player });
  } catch (error) {
    return next(wrap500(error, '获取玩家信息失败'));
  }
});

module.exports = router;
