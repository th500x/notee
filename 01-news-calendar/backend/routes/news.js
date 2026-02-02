import express from 'express'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 根据日期获取对应的月份文件名
function getMonthlyFileName(date) {
  if (!date) return null
  const year = date.substring(0, 4)
  const month = date.substring(5, 7)
  return `news_${year}${month}.json`
}

// 读取指定月份的新闻数据
async function readMonthlyNews(monthFileName) {
  try {
    const newsPath = join(__dirname, '../../public', monthFileName)
    if (!existsSync(newsPath)) {
      return {}
    }
    const newsData = await readFile(newsPath, 'utf-8')
    return JSON.parse(newsData)
  } catch (error) {
    console.error(`读取月份文件 ${monthFileName} 失败:`, error)
    return {}
  }
}

// 读取所有月份的新闻数据
async function readAllNews() {
  const allNews = {}
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
  
  for (const month of months) {
    const fileName = `news_2026${month}.json`
    const monthNews = await readMonthlyNews(fileName)
    Object.assign(allNews, monthNews)
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
    console.error('读取新闻数据失败:', error)
    res.status(500).json({
      success: false,
      error: '无法获取新闻数据'
    })
  }
})

// 获取特定日期的新闻
router.get('/:date', async (req, res) => {
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
    console.error('读取新闻数据失败:', error)
    res.status(500).json({
      success: false,
      error: '无法获取新闻数据'
    })
  }
})

export default router