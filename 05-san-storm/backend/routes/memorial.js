/**
 * 纪念图 API（MVP：Battle）
 * - 每日限 1 次战斗纪念图生成
 * - 图片上传阿里云 OSS（battle/ 前缀），无本地落盘
 */

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../database/connection');
const { putPngBuffer } = require('../utils/ossMemorial');

const router = express.Router();

/** 生产/测试：纪念图每日次数不限（便于验收；正式玩家仍为每日 1 次） */
const MEMORIAL_UNLIMITED_PLAYER_IDS = new Set(['04DO']);

function isMemorialUnlimitedTester(playerId) {
  return MEMORIAL_UNLIMITED_PLAYER_IDS.has(String(playerId || ''));
}

const MEMORIAL_ROOT = path.join(__dirname, '..', 'storage', 'memorial', 'battle');
/** 与 vite.config publicDir 一致：05-san-storm/public（非 game/public） */
const GAME_PUBLIC_MEMORIAL_ILLUS = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'assets',
  'san_1_memorial',
  'illus_battle'
);

function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function stripDataUrlPrefix(base64) {
  if (typeof base64 !== 'string') return '';
  const match = base64.match(/^data:image\/png;base64,(.+)$/);
  return match ? match[1] : base64;
}

async function getTodayBattleMemorial(playerId) {
  const [rows] = await pool.query(
    `SELECT id, battle_id, image_url, created_at
       FROM memorial_images
      WHERE player_id = ?
        AND image_type = 'battle'
        AND event_date = CURDATE()
      ORDER BY id DESC
      LIMIT 1`,
    [playerId]
  );
  return rows[0] || null;
}

router.get('/battle/quota', async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    const today = await getTodayBattleMemorial(playerId);
    const used = Boolean(today);
    const isUnlimitedTester = isMemorialUnlimitedTester(playerId);
    return res.json({
      success: true,
      data: {
        dailyLimit: isUnlimitedTester ? 9999 : 1,
        usedToday: used ? 1 : 0,
        remaining: isUnlimitedTester ? 9999 : (used ? 0 : 1),
        todayRecord: today,
      },
    });
  } catch (error) {
    console.error('[memorial/battle/quota] 失败:', error);
    return res.status(500).json({ success: false, error: '获取纪念图配额失败' });
  }
});

/**
 * 代理下载：前端对 OSS 直链 fetch 会触发 CORS，改为同源请求本接口，由服务端拉取 OSS 再流式返回。
 * GET /api/memorial/battle/download?playerId=&id=（memorial_images.id）
 */
router.get('/battle/download', async (req, res) => {
  try {
    const { playerId, id } = req.query;
    if (!playerId || id == null || String(id).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少 playerId 或 id' });
    }
    const [rows] = await pool.query(
      `SELECT id, image_url FROM memorial_images
        WHERE id = ? AND player_id = ? AND image_type = 'battle'
        LIMIT 1`,
      [id, playerId]
    );
    const row = rows[0];
    if (!row || !row.image_url) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    const imageUrl = String(row.image_url).trim();

    if (imageUrl.startsWith('/api/memorial/file/')) {
      const file = imageUrl.split('/').pop();
      if (!/^[a-zA-Z0-9._-]+\.png$/.test(file)) {
        return res.status(400).json({ success: false, error: '非法文件名' });
      }
      const absPath = path.join(MEMORIAL_ROOT, file);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
      return res.sendFile(absPath);
    }

    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({ success: false, error: '无效 image_url' });
    }

    const client = imageUrl.startsWith('https') ? https : http;
    client
      .get(imageUrl, (upstream) => {
        if (upstream.statusCode !== 200) {
          upstream.resume();
          if (!res.headersSent) {
            res.status(502).json({ success: false, error: '图片拉取失败' });
          }
          return;
        }
        const fn = `memorial_battle_${id}.png`;
        res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
        upstream.pipe(res);
      })
      .on('error', (err) => {
        console.error('[memorial/battle/download]', err);
        if (!res.headersSent) {
          res.status(502).json({ success: false, error: '下载失败' });
        }
      });
  } catch (error) {
    console.error('[memorial/battle/download]', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '下载失败' });
    }
  }
});

router.post('/battle', async (req, res) => {
  try {
    const { playerId, battleId, imageBase64 } = req.body || {};
    if (!playerId || !battleId || !imageBase64) {
      return res.status(400).json({ success: false, error: '缺少必填字段 playerId/battleId/imageBase64' });
    }

    const isUnlimitedTester = isMemorialUnlimitedTester(playerId);
    const today = await getTodayBattleMemorial(playerId);
    if (today && !isUnlimitedTester) {
      return res.status(400).json({
        success: false,
        code: 'DAILY_LIMIT',
        error: '今日生成次数1/1，请明日再来',
        data: { todayRecord: today },
      });
    }

    const [battles] = await pool.query(
      `SELECT battle_id, battle_type, opponent_name, result,
              total_damage_dealt, total_damage_taken, total_kills, duration, battle_log
         FROM battles
        WHERE battle_id = ? AND player_id = ?
        LIMIT 1`,
      [battleId, playerId]
    );
    const battle = battles[0];
    if (!battle) {
      return res.status(404).json({ success: false, error: '战斗记录不存在或不属于当前玩家' });
    }

    const pngBase64 = stripDataUrlPrefix(imageBase64);
    const buffer = Buffer.from(pngBase64, 'base64');
    if (!buffer || buffer.length < 100) {
      return res.status(400).json({ success: false, error: '图片数据无效' });
    }

    const filename = `${playerId}_${toDateKey()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const ossKey = `battle/${filename}`;

    let imageUrl;
    try {
      imageUrl = await putPngBuffer(buffer, ossKey);
    } catch (ossErr) {
      console.error('[memorial/battle] OSS 上传失败:', ossErr);
      const msg =
        ossErr.code === 'OSS_CONFIG'
          ? ossErr.message
          : `OSS 上传失败: ${ossErr.message || String(ossErr)}`;
      return res.status(502).json({
        success: false,
        code: ossErr.code === 'OSS_CONFIG' ? 'OSS_CONFIG' : 'OSS_UPLOAD',
        error: msg,
      });
    }
    const eventData = {
      type: 'battle_memorial',
      battle_id: battle.battle_id,
      battle_type: battle.battle_type,
      opponent_name: battle.opponent_name,
      result: battle.result,
      battle_summary: {
        duration: battle.duration,
        total_damage_dealt: battle.total_damage_dealt,
        total_damage_taken: battle.total_damage_taken,
        total_kills: battle.total_kills,
      },
      battle_log_excerpt: (battle.battle_log || '').slice(0, 1200),
    };

    let memorialId = null;
    if (today && isUnlimitedTester) {
      // 测试账号允许同日重复生成：覆盖今天已有 battle 纪念图记录
      await pool.query(
        `UPDATE memorial_images
            SET battle_id = ?, image_url = ?, oss_key = ?, file_size = ?, event_data = ?, created_at = NOW()
          WHERE id = ?`,
        [battleId, imageUrl, ossKey, buffer.length, JSON.stringify(eventData), today.id]
      );
      memorialId = today.id;
    } else {
      const [insertResult] = await pool.query(
        `INSERT INTO memorial_images
           (player_id, season_id, server_id, image_type, event_date, battle_id,
            image_url, oss_key, file_size, event_data, expires_at)
         VALUES
           (?, 'san_1', 'san_1_server_1', 'battle', CURDATE(), ?,
            ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
        [playerId, battleId, imageUrl, ossKey, buffer.length, JSON.stringify(eventData)]
      );
      memorialId = insertResult.insertId;
    }

    return res.json({
      success: true,
      data: {
        id: memorialId,
        battleId,
        imageUrl,
        usedToday: 1,
        remaining: isUnlimitedTester ? 9999 : 0,
      },
    });
  } catch (error) {
    console.error('[memorial/battle] 失败:', error);
    return res.status(500).json({ success: false, error: '生成战斗纪念图失败' });
  }
});

/**
 * 列出纪念海报底图文件名（png/jpg/webp），供客户端随机选图。
 * 管理员往 05-san-storm/public/assets/san_1_memorial/illus_battle/ 增删文件即可（与 Vite publicDir 一致）。
 */
router.get('/illus-battle-list', async (req, res) => {
  try {
    await fs.mkdir(GAME_PUBLIC_MEMORIAL_ILLUS, { recursive: true });
    const names = await fs.readdir(GAME_PUBLIC_MEMORIAL_ILLUS);
    const files = names.filter((n) => /\.(png|jpg|jpeg|webp)$/i.test(n));
    return res.json({ success: true, files });
  } catch (error) {
    console.error('[memorial/illus-battle-list] 失败:', error);
    return res.json({ success: true, files: [] });
  }
});

/**
 * 兼容旧数据：早期 image_url 指向本地 /api/memorial/file/xxx 时仍可访问。
 * 新记录均为 OSS HTTPS 直链，不再写入本地。
 */
router.get('/file/:filename', async (req, res) => {
  try {
    const file = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9._-]+\.png$/.test(file)) {
      return res.status(400).json({ success: false, error: '非法文件名' });
    }
    const absPath = path.join(MEMORIAL_ROOT, file);
    return res.sendFile(absPath);
  } catch (error) {
    console.error('[memorial/file] 失败:', error);
    return res.status(404).json({ success: false, error: '文件不存在' });
  }
});

module.exports = router;

