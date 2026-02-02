import express from 'express'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 获取新闻数据
router.get('/', async (req, res) => {
  try {
    const newsPath = join(__dirname, '../../public/news.json')
    const newsData = await readFile(newsPath, 'utf-8')
    const news = JSON.parse(newsData)
    
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
    const newsPath = join(__dirname, '../../public/news.json')
    const newsData = await readFile(newsPath, 'utf-8')
    const news = JSON.parse(newsData)
    
    const dateNews = news[date] || {}
    
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