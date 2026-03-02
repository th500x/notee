import { useNavigate } from 'react-router-dom'
import { useBook } from '../contexts/BookContext'
import { useState, useEffect } from 'react'
import { login, isLoggedIn } from '../services/authService'
import { BOOK_CATEGORIES, CATEGORY_ICONS, PROTECTED_CATEGORIES } from '../constants'
import { validatePassword } from '../utils/inputValidation'
import { announcement } from '../config/announcement'

function Bookshelf() {
  const navigate = useNavigate()
  const { books, readingProgress, getReadingProgress } = useBook()
  const [selectedCategory, setSelectedCategory] = useState(BOOK_CATEGORIES.ALL)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [unlockedCategories, setUnlockedCategories] = useState(
    new Set([BOOK_CATEGORIES.ALL, BOOK_CATEGORIES.GAME_HISTORY, BOOK_CATEGORIES.TRAVEL])
  )
  const [pendingCategory, setPendingCategory] = useState('')

  // 检查是否已登录，自动解锁所有分类
  useEffect(() => {
    if (isLoggedIn()) {
      setUnlockedCategories(new Set(Object.values(BOOK_CATEGORIES)))
    }
  }, [])

  // 定义分类列表
  const categories = Object.values(BOOK_CATEGORIES)

  const handleCategoryClick = (category) => {
    // 如果是受保护的分类且未解锁
    if (PROTECTED_CATEGORIES.includes(category) && !unlockedCategories.has(category)) {
      setPendingCategory(category)
      setShowPasswordModal(true)
      setPasswordInput('')
      setPasswordError('')
    } else {
      setSelectedCategory(category)
    }
  }

  const handlePasswordSubmit = async () => {
    // 验证输入
    const validation = validatePassword(passwordInput)
    if (!validation.valid) {
      setPasswordError(validation.error)
      return
    }

    setIsAuthenticating(true)
    setPasswordError('')

    try {
      const result = await login(passwordInput.trim())
      
      if (result.success) {
        // 密码正确，解锁所有分类
        setUnlockedCategories(new Set(Object.values(BOOK_CATEGORIES)))
        setSelectedCategory(pendingCategory)
        setShowPasswordModal(false)
        setPasswordInput('')
        setPasswordError('')
      } else {
        // 密码错误，显示错误信息
        setPasswordError(result.error || '密码错误')
        setPasswordInput('')
      }
    } catch (error) {
      setPasswordError('验证失败，请稍后重试')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handlePasswordCancel = () => {
    setShowPasswordModal(false)
    setPasswordInput('')
    setPasswordError('')
    setPendingCategory('')
  }

  const handlePasswordKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePasswordSubmit()
    }
  }

  const handleBookClick = (bookId) => {
    const progress = getReadingProgress(bookId)
    if (progress && progress.currentChapter) {
      navigate(`/book/${bookId}/chapter/${progress.currentChapter}`)
    } else {
      navigate(`/book/${bookId}`)
    }
  }

  const getBookThemeClass = (theme) => {
    return `book-theme-${theme}`
  }

  const getReadingProgressPercent = (bookId) => {
    const book = books.find(b => b.id === bookId)
    const progress = getReadingProgress(bookId)
    
    if (!book || !progress) return 0
    
    const currentChapterIndex = book.chapters.findIndex(c => c.id === progress.currentChapter)
    if (currentChapterIndex === -1) return 0
    
    return Math.round(((currentChapterIndex + 1) / book.chapters.length) * 100)
  }

  // 根据选中的分类过滤书籍
  const filteredBooks = selectedCategory === BOOK_CATEGORIES.ALL 
    ? books.filter(book => !book.requirePassword) // "全部"标签不显示加密书籍
    : books.filter(book => book.category === selectedCategory)

  return (
    <div className="bookshelf-page">
      {/* 公告栏 */}
      {announcement.enabled && (
        <div className="announcement-bar">
          <span className="announcement-icon">📢</span>
          <span className="announcement-label">公告</span>
          <span className="announcement-date">{announcement.date}</span>
          <span className="announcement-content">{announcement.content}</span>
        </div>
      )}

      {/* 分类标签 */}
      <div className="category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category)}
          >
            <span className="category-icon">{CATEGORY_ICONS[category]}</span>
            <span className="category-name">{category}</span>
            {PROTECTED_CATEGORIES.includes(category) && !unlockedCategories.has(category) && (
              <span className="lock-icon">🔒</span>
            )}
          </button>
        ))}
      </div>

      {/* 书籍网格 */}
      <div className="books-grid">
        {filteredBooks.map((book) => {
          const progressPercent = getReadingProgressPercent(book.id)
          const progress = getReadingProgress(book.id)
          
          return (
            <div
              key={book.id}
              className="book-item"
              onClick={() => handleBookClick(book.id)}
            >
              {/* 书籍封面容器 */}
              <div className="book-cover-wrapper">
                <div className={`book-cover-3d ${getBookThemeClass(book.theme)}`}>
                  {/* 封面图片或默认内容 */}
                  {book.cover ? (
                    <img 
                      src={book.cover} 
                      alt={book.title}
                      className="book-cover-image"
                    />
                  ) : (
                    <div className="book-cover-content">
                      <div className="book-cover-title">{book.title}</div>
                      <div className="book-cover-decoration"></div>
                    </div>
                  )}
                  
                  {/* 阅读中徽章 */}
                  {progress && progress.lastRead && (
                    <div className="reading-badge">
                      <span>📖</span>
                    </div>
                  )}
                </div>
                
                {/* 阅读进度条 */}
                {progressPercent > 0 && (
                  <div className="progress-indicator">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 书籍信息 */}
              <div className="book-info">
                <h3 className="book-title">{book.title}</h3>
                <p className="book-description">{book.description}</p>
                <p className="book-meta">共 {book.chapters.length} 章</p>
                {progressPercent > 0 && (
                  <p className="book-progress-text">已读 {progressPercent}%</p>
                )}
              </div>
            </div>
          )
        })}
        
        {/* 添加新书的占位符 - 只在游戏史记和游记杂谈分类显示 */}
        {(selectedCategory === BOOK_CATEGORIES.GAME_HISTORY || selectedCategory === BOOK_CATEGORIES.TRAVEL) && (
          <div className="book-item book-item-placeholder">
            <div className="book-cover-wrapper">
              <div className="book-cover-3d placeholder-cover">
                <div className="placeholder-content">
                  <div className="placeholder-icon">📝</div>
                  <div className="placeholder-text">敬请期待</div>
                </div>
              </div>
            </div>
            <div className="book-info">
              <h3 className="book-title">更多内容</h3>
              <p className="book-meta">即将推出</p>
            </div>
          </div>
        )}
      </div>

      {/* 空状态提示 */}
      {filteredBooks.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <div className="empty-text">该分类暂无书籍</div>
          <div className="empty-hint">敬请期待更多精彩内容</div>
        </div>
      )}

      {/* 密码验证弹窗 */}
      {showPasswordModal && (
        <div className="password-modal-overlay" onClick={handlePasswordCancel}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="password-modal-header">
              <h3 className="password-modal-title">🔒 需要验证</h3>
              <button className="password-modal-close" onClick={handlePasswordCancel}>×</button>
            </div>
            <div className="password-modal-body">
              <label htmlFor="category-password-input" className="password-modal-hint">
                请输入密码以访问「{pendingCategory}」分类
              </label>
              <input
                id="category-password-input"
                name="categoryPassword"
                type="password"
                className="password-input"
                placeholder="请输入密码"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={handlePasswordKeyPress}
                autoFocus
              />
              {passwordError && (
                <p className="password-error">{passwordError}</p>
              )}
            </div>
            <div className="password-modal-footer">
              <button className="password-btn password-btn-cancel" onClick={handlePasswordCancel}>
                取消
              </button>
              <button 
                className="password-btn password-btn-submit" 
                onClick={handlePasswordSubmit}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? '验证中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Bookshelf
