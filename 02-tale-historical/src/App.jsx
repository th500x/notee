import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import Loading from './components/Loading'
import { BookProvider } from './contexts/BookContext'

// 代码分割 - 懒加载路由组件
const Bookshelf = lazy(() => import('./components/Bookshelf'))
const BookReader = lazy(() => import('./components/BookReader'))

function App() {
  return (
    <ErrorBoundary>
      <BookProvider>
        <div className="min-h-screen bg-gradient-to-br from-parchment to-yellow-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="flex justify-between items-center">
                <div>
                  <a 
                    href="/"
                    className="text-3xl font-bold text-ink hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
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
            <Suspense fallback={<Loading message="加载中..." />}>
              <Routes>
                <Route path="/" element={<Bookshelf />} />
                <Route path="/book/:bookId" element={<BookReader />} />
                <Route path="/book/:bookId/chapter/:chapterId" element={<BookReader />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BookProvider>
    </ErrorBoundary>
  )
}

export default App