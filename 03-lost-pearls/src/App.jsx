import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Loading from './components/Loading'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

const HomePage = lazy(() => import('./pages/HomePage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))

export default function App() {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
        <SiteHeader />
        <main className="flex-1">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/games/:gameId" element={<GamePage />} />
              <Route path="/games/:gameId/:section/:slug" element={<ArticlePage />} />
            </Routes>
          </Suspense>
        </main>
        <SiteFooter />
      </div>
    </ErrorBoundary>
  )
}
