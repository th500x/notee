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
                <h1 className="text-3xl font-bold text-ink font-title">佚事雜錄</h1>
                <p className="text-gray-600 mt-2">游戏人生的点滴记录</p>
              </div>
              <div className="flex items-center space-x-4">
                <a 
                  href="/" 
                  className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                  title="返回主页"
                >
                  🍺 LOVE & PEACE!
                </a>
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