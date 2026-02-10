import { useBook } from '../contexts/BookContext'

function ChapterNavigation({ book, currentChapter, onChapterSelect, onClose }) {
  const { getReadingProgress, getBookmarks } = useBook()
  
  const progress = getReadingProgress(book.id)
  const bookmarks = getBookmarks(book.id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="chapter-nav max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gold border-opacity-30">
          <h3 className="text-xl font-semibold text-ink font-title">📖 章节导航</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          {/* 章节列表 */}
          <div className="p-4">
            <h4 className="text-lg font-medium text-ink mb-3">章节目录</h4>
            <div className="space-y-2">
              {book.chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    chapter.id === currentChapter.id
                      ? 'bg-gold bg-opacity-20 border border-gold'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => onChapterSelect(chapter.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-bold text-gold w-8">
                      {index + 1}
                    </div>
                    <div>
                      <h5 className="font-medium text-ink">{chapter.title}</h5>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {chapter.id === currentChapter.id && (
                      <span className="text-xs bg-gold text-white px-2 py-1 rounded">
                        当前
                      </span>
                    )}
                    {progress && chapter.id === progress.currentChapter && chapter.id !== currentChapter.id && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                        上次
                      </span>
                    )}
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 书签列表 */}
          {Object.keys(bookmarks).length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <h4 className="text-lg font-medium text-ink mb-3">我的书签</h4>
              <div className="space-y-2">
                {Object.entries(bookmarks)
                  .sort(([,a], [,b]) => new Date(b.createdAt) - new Date(a.createdAt))
                  .slice(0, 5)
                  .map(([bookmarkId, bookmark]) => {
                    const chapter = book.chapters.find(c => c.id === bookmark.chapterId)
                    return (
                      <div
                        key={bookmarkId}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => {
                          onChapterSelect(bookmark.chapterId)
                          // TODO: 滚动到书签位置
                        }}
                      >
                        <div>
                          <div className="font-medium text-ink text-sm">
                            📖 {chapter?.title}
                          </div>
                          {bookmark.note && (
                            <div className="text-xs text-gray-600 mt-1">
                              {bookmark.note}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(bookmark.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <div className="text-sm text-gray-600">
            共 {book.chapters.length} 章节
          </div>
          <button
            onClick={onClose}
            className="bg-wood text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChapterNavigation