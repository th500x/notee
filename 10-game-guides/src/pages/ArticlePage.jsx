import { Link, useParams } from 'react-router-dom'
import MarkdownView from '../components/MarkdownView'
import { getGame, listGameArticles, loadArticle } from '../services/contentService'

export default function ArticlePage() {
  const { gameId, section, slug } = useParams()
  const game = getGame(gameId)
  const article = gameId && section && slug ? loadArticle(gameId, section, slug) : null
  const siblings = gameId ? listGameArticles(gameId) : []
  const idx = siblings.findIndex((c) => c.section === section && c.slug === slug)
  const prev = idx > 0 ? siblings[idx - 1] : null
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null

  if (!game || !article) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-[var(--muted)]">未找到该章节。</p>
        <Link to="/" className="mt-4 inline-block text-[var(--accent)] hover:underline">
          返回目录
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-10">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="text-xs text-[var(--muted)]">{game.title}</p>
        <h2 className="mt-1 text-sm font-medium text-[var(--text)]">本章目录</h2>
        <nav className="mt-3 space-y-1">
          {siblings.map((ch) => {
            const active = ch.section === section && ch.slug === slug
            return (
              <Link
                key={`${ch.section}/${ch.slug}`}
                to={`/games/${gameId}/${ch.section}/${ch.slug}`}
                className={`block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--surface-2)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                {ch.title}
              </Link>
            )
          })}
        </nav>
        <Link
          to={`/games/${gameId}`}
          className="mt-6 inline-block text-xs text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← 游戏首页
        </Link>
      </aside>

      <article className="min-w-0">
        <nav className="text-xs text-[var(--muted)]">
          <Link to="/" className="hover:text-[var(--accent)]">
            目录
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <Link to={`/games/${gameId}`} className="hover:text-[var(--accent)]">
            {game.title}
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-[var(--text)]">{article.title}</span>
        </nav>

        <header className="mt-5 border-b border-[var(--border)] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{article.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            {article.platform ? <span>{article.platform}</span> : null}
            {article.updated ? <span>核实 / 更新 {article.updated}</span> : null}
            {article.status ? <span>{article.status}</span> : null}
          </div>
          {article.sources?.length > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              来源线索：{article.sources.join(' · ')}
            </p>
          ) : null}
        </header>

        <div className="mt-8">
          <MarkdownView body={article.body} baseDir={article.baseDir} />
        </div>

        <footer className="mt-12 flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-between">
          {prev?.available ? (
            <Link
              to={`/games/${gameId}/${prev.section}/${prev.slug}`}
              className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next?.available ? (
            <Link
              to={`/games/${gameId}/${next.section}/${next.slug}`}
              className="text-sm text-[var(--muted)] hover:text-[var(--accent)] sm:text-right"
            >
              {next.title} →
            </Link>
          ) : null}
        </footer>
      </article>
    </div>
  )
}
