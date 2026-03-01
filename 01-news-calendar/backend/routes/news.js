import express from 'express'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 日志脱敏函数
function sanitizeLog(data) {
  if (!data || typeof data !== 'object') return data
  
  const sanitized = { ...data }
  
  // 脱敏IP地址
  if (sanitized.ip && typeof sanitized.ip === 'string') {
    const parts = sanitized.ip.split('.')
    if (parts.length === 4) {
      sanitized.ip = `${parts[0]}.${parts[1]}.***.***.***`
    }
  }
  
  return sanitized
}

// 验证日期格式中间件
function validateDateFormat(req, res, next) {
  const { date } = req.params
  
  if (!date) {
    return res.status(400).json({
      success: false,
      error: '日期参数不能为空'
    })
  }
  
  // 验证日期格式：YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    console.warn('[Security] 无效的日期格式:', sanitizeLog({ 
      date, 
      ip: req.clientIP 
    }))
    return res.status(400).json({
      success: false,
      error: '无效的日期格式，应为YYYY-MM-DD'
    })
  }
  
  // 验证日期是否有效
  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  
  if (dateObj.getFullYear() !== year || 
      dateObj.getMonth() !== month - 1 || 
      dateObj.getDate() !== day) {
    return res.status(400).json({
      success: false,
      error: '无效的日期'
    })
  }
  
  // 验证日期范围（2026年）
  if (year !== 2026) {
    return res.status(400).json({
      success: false,
      error: '日期超出有效范围'
    })
  }
  
  next()
}

// 根据日期获取对应的月份文件名
function getMonthlyFileName(date) {
  if (!date) return null
  
  // 防止路径遍历攻击
  if (date.includes('..') || date.includes('/') || date.includes('\\')) {
    console.warn('[Security] 检测到路径遍历攻击尝试:', date)
    return null
  }
  
  const year = date.substring(0, 4)
  const month = date.substring(5, 7)
  return `news-calendar-${year}${month}.json`
}

// 读取指定月份的新闻数据
async function readMonthlyNews(monthFileName) {
  try {
    // 验证文件名格式（防止路径遍历）
    if (!monthFileName || typeof monthFileName !== 'string') {
      return {}
    }
    
    if (monthFileName.includes('..') || monthFileName.includes('/') || monthFileName.includes('\\')) {
      console.warn('[Security] 检测到路径遍历攻击尝试:', monthFileName)
      return {}
    }
    
    const newsPath = join(__dirname, '../../public', monthFileName)
    
    if (!existsSync(newsPath)) {
      return {}
    }
    
    const newsData = await readFile(newsPath, 'utf-8')
    return JSON.parse(newsData)
  } catch (error) {
    console.error(`[News] 读取月份文件 ${monthFileName} 失败:`, error.message)
    return {}
  }
}

// 读取所有月份的新闻数据（只读取存在的文件）
async function readAllNews() {
  const allNews = {}
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  
  for (const month of months) {
    const fileName = `news-calendar-2026${month}.json`
    const newsPath = join(__dirname, '../../public', fileName)
    
    // 只读取存在的文件
    if (existsSync(newsPath)) {
      const monthNews = await readMonthlyNews(fileName)
      Object.assign(allNews, monthNews)
    }
  }
  
  return allNews
}

// 获取新闻数据
router.get('/', async (req, res) => {
  try {
    const news = await readAllNews()
    res.json({
      success: true,
      data: news
    })
  } catch (error) {
    console.error('[News] 读取新闻数据失败:', sanitizeLog({ 
      error: error.message,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '无法获取新闻数据，请稍后重试'
      : `无法获取新闻数据: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

// 获取特定日期的新闻
router.get('/:date', validateDateFormat, async (req, res) => {
  try {
    const { date } = req.params
    const monthFileName = getMonthlyFileName(date)
    
    if (!monthFileName) {
      return res.status(400).json({
        success: false,
        error: '无效的日期格式'
      })
    }
    
    const monthNews = await readMonthlyNews(monthFileName)
    const dateNews = monthNews[date] || {}
    
    res.json({
      success: true,
      data: dateNews,
      date: date
    })
  } catch (error) {
    console.error('[News] 读取新闻数据失败:', sanitizeLog({ 
      error: error.message,
      date: req.params.date,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '无法获取新闻数据，请稍后重试'
      : `无法获取新闻数据: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

export default router