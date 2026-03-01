/**
 * 书籍目录组件
 * 显示书籍信息和章节列表
 * 
 * @component
 * @param {Object} props - 组件属性
 * @param {Object} props.book - 书籍对象
 * @param {string} props.book.title - 书籍标题
 * @param {string} props.book.description - 书籍描述
 * @param {Array<Object>} props.book.chapters - 章节列表
 * @param {Object} [props.progress] - 阅读进度
 * @param {string} props.progress.currentChapter - 当前章节ID
 * @param {Function} props.onChapterSelect - 章节选择回调
 * @param {Function} props.onBackToShelf - 返回书架回调
 * 
 * @description
 * 显示书籍的基本信息、章节列表和阅读进度。
 * 如果有阅读进度，会显示"继续阅读"按钮。
 * 
 * @example
 * <BookTableOfContents
 *   book={currentBook}
 *   progress={readingProgress}
 *   onChapterSelect={(chapterId) => navigate(`/chapter/${chapterId}`)}
 *   onBackToShelf={() => navigate('/')}
 * />
 */

function BookTableOfContents({ book, progress, onChapterSelect, onBackToShelf }) {
  if (!book) return null

  return (
    <div className="max-w-4xl mx-auto">
      {/* 书籍信息 */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-ink font-title mb-4">
            {book.title}
          </h1>
          <p className="text-gray-600 text-lg">{book.description}</p>
        </div>
        
        {/* 继续阅读 */}
        {progress && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">上次阅读进度</span>
              <button
                onClick={() => onChapterSelect(progress.currentChapter)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                继续阅读
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 章节列表 */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-ink font-title mb-6">
          📖 目录
        </h2>
        <div className="space-y-3">
          {book.chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
              onClick={() => onChapterSelect(chapter.id)}
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl font-bold text-gold w-8">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-medium text-ink group-hover:text-wood transition-colors">
                    {chapter.title}
                  </h3>
                </div>
              </div>
              <div className="text-gray-400 group-hover:text-gray-600">→</div>
            </div>
          ))}
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="mt-8 text-center">
        <button
          onClick={onBackToShelf}
          className="bg-wood text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors"
        >
          返回书架
        </button>
      </div>
    </div>
  )
}

export default BookTableOfContents
