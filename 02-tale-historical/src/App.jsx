import { Routes, Route } from 'react-router-dom'
import './App.css'
import Bookshelf from './components/Bookshelf'
import BookReader from './components/BookReader'
import { BookProvider } from './contexts/BookContext'

function App() {
  return (
    <BookProvider>
      <div className="min-h-screen bg-gradient-to-br from-parchment to-yellow-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <a 
                  href="/"
                  className="text-3xl font-bold text-ink font-title hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
                  title="返回主页"
                >
                  佚事雜錄
                  {/* 悬停提示 */}
                  <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    返回主页
                  </span>
                </a>
                <p className="text-gray-600 mt-2">游戏人生的点滴记录</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Bookshelf />} />
            <Route path="/book/:bookId" element={<BookReader />} />
            <Route path="/book/:bookId/chapter/:chapterId" element={<BookReader />} />
          </Routes>
        </main>
      </div>
    </BookProvider>
  )
}

export default App