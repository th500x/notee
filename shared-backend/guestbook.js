/**
 * 留言板API
 * 
 * @description 处理留言的提交、获取和管理
 * @module backend/guestbook
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'guestbook.json');

// 不良词汇过滤列表（示例）
const BLOCKED_WORDS = [
  '垃圾', '傻逼', '操', '妈的', '草泥马', 
  'fuck', 'shit', 'damn', 'bitch'
];

// 项目模块列表
const MODULES = [
  { id: '01-news-calendar', name: '新聞筆記' },
  { id: '02-tale-historical', name: '佚事雜錄' },
  { id: '04-coin-index', name: '幣圈指數' },
  { id: '05-san-storm', name: '真三風雲' },
  { id: 'general', name: '綜合留言' }
];

/**
 * 初始化数据文件
 */
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    // 文件不存在，创建初始数据
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify({ messages: [] }, null, 2));
  }
}

/**
 * 读取留言数据
 */
async function readMessages() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取留言数据失败:', error);
    return { messages: [] };
  }
}

/**
 * 写入留言数据
 */
async function writeMessages(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * 检查文本是否包含不良词汇
 */
function containsBlockedWords(text) {
  const lowerText = text.toLowerCase();
  return BLOCKED_WORDS.some(word => lowerText.includes(word));
}

/**
 * 验证留言内容
 */
function validateMessage(content) {
  // 检查长度（50个中文字符 = 150字节左右）
  if (!content || content.trim().length === 0) {
    return { valid: false, error: '留言内容不能为空' };
  }
  
  if (content.length > 50) {
    return { valid: false, error: '留言内容不能超过50个字符' };
  }
  
  // 检查不良词汇
  if (containsBlockedWords(content)) {
    return { valid: false, error: '留言包含不当内容，请修改后重试' };
  }
  
  return { valid: true };
}

/**
 * 获取客户端IP
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         'unknown';
}

/**
 * 获取模块列表
 * GET /api/guestbook/modules
 */
router.get('/modules', (req, res) => {
  res.json({ modules: MODULES });
});

/**
 * 获取留言列表
 * GET /api/guestbook/messages?module=xxx&limit=20
 */
router.get('/messages', async (req, res) => {
  try {
    const { module, limit = 20 } = req.query;
    const data = await readMessages();
    
    let messages = data.messages;
    
    // 按模块过滤
    if (module && module !== 'all') {
      messages = messages.filter(msg => msg.module === module);
    }
    
    // 按时间倒序排序
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 限制数量
    messages = messages.slice(0, parseInt(limit));
    
    res.json({ 
      success: true, 
      messages,
      total: messages.length 
    });
  } catch (error) {
    console.error('获取留言失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取留言失败' 
    });
  }
});

/**
 * 提交留言
 * POST /api/guestbook/messages
 * Body: { module, content }
 */
router.post('/messages', async (req, res) => {
  try {
    const { module, content } = req.body;
    
    // 验证模块
    if (!module || !MODULES.find(m => m.id === module)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的模块' 
      });
    }
    
    // 验证内容
    const validation = validateMessage(content);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }
    
    // 获取IP
    const ip = getClientIP(req);
    
    // 创建留言对象
    const message = {
      id: Date.now().toString(),
      module,
      content: content.trim(),
      ip,
      timestamp: new Date().toISOString(),
    };
    
    // 保存留言
    const data = await readMessages();
    data.messages.push(message);
    await writeMessages(data);
    
    res.json({ 
      success: true, 
      message: '留言提交成功',
      data: {
        id: message.id,
        timestamp: message.timestamp
      }
    });
  } catch (error) {
    console.error('提交留言失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '提交留言失败' 
    });
  }
});

/**
 * 删除留言（管理员功能，需要密码）
 * DELETE /api/guestbook/messages/:id
 * Body: { password }
 */
router.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    // 简单的密码验证（实际应该使用更安全的方式）
    if (password !== process.env.ADMIN_PASSWORD && password !== 'admin123') {
      return res.status(403).json({ 
        success: false, 
        error: '密码错误' 
      });
    }
    
    const data = await readMessages();
    const index = data.messages.findIndex(msg => msg.id === id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        error: '留言不存在' 
      });
    }
    
    data.messages.splice(index, 1);
    await writeMessages(data);
    
    res.json({ 
      success: true, 
      message: '留言已删除' 
    });
  } catch (error) {
    console.error('删除留言失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '删除留言失败' 
    });
  }
});

// 初始化
initDataFile().catch(console.error);

module.exports = router;
