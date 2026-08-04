import { Link, useParams } from 'react-router-dom'
import { getGame, listGameArticles } from '../services/contentService'

const SECTION_LABEL = {
  basics: '基础',
  advanced: '进阶',
  endgame: '终局',
}

const SECTION_HINT = {
  advanced: '主要玩法资讯：养成上限、山门基建、外交异闻。建议先读完基础四章再进。',
  endgame: '强度与续玩：极品物、流派顶配验收、飞升滞留与遗蜕。建议先读完进阶再进。',
}

function ChapterList({ gameId, articles, startIndex = 0 }) {
  return (
    <ol className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {articles.map((ch, idx) => (
        <li key={`${ch.section}/${ch.slug}`}>
          {ch.available ? (
            <Link
              to={`/games/${gameId}/${ch.section}/${ch.slug}`}
              className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-2)] sm:px-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-sm text-[var(--muted)]">
                {startIndex + idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--text)]">{ch.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {ch.section}/{ch.slug}
                  {ch.updated ? ` · 更新 ${ch.updated}` : ''}
                  {ch.status ? ` · ${ch.status}` : ''}
                </p>
              </div>
              <span className="text-[var(--accent)]">→</span>
            </Link>
          ) : (
            <div className="flex items-center gap-4 px-4 py-4 opacity-50 sm:px-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-sm">
                {startIndex + idx + 1}
              </span>
              <p className="text-[var(--muted)]">{ch.title}（正文缺失）</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

export default function GamePage() {
  const { gameId } = useParams()
  const game = getGame(gameId)
  const articles = game ? listGameArticles(gameId) : []

  if (!game) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-[var(--muted)]">未找到该游戏。</p>
        <Link to="/" className="mt-4 inline-block text-[var(--accent)] hover:underline">
          返回目录
        </Link>
      </div>
    )
  }

  const sectionOrder = ['basics', 'advanced', 'endgame']
  const grouped = sectionOrder
    .map((key) => ({
      key,
      label: SECTION_LABEL[key],
      hint: SECTION_HINT[key],
      articles: articles.filter((a) => a.section === key),
    }))
    .filter((g) => g.articles.length > 0)

  const other = articles.filter((a) => !sectionOrder.includes(a.section))
  let runningIndex = 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="text-xs text-[var(--muted)]">
        <Link to="/" className="hover:text-[var(--accent)]">
          目录
        </Link>
        <span className="mx-2 opacity-50">/</span>
        <span className="text-[var(--text)]">{game.title}</span>
      </nav>

      <header className="mt-6 max-w-2xl">
        <p className="text-sm text-[var(--muted)]">{game.id}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{game.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{game.titleEn}</p>
        <p className="mt-4 text-[var(--muted)] leading-relaxed">{game.blurb}</p>
        <p className="mt-3 text-xs text-[var(--accent)]">{game.platform}</p>
      </header>

      {grouped.map((g) => {
        const startIndex = runningIndex
        runningIndex += g.articles.length
        return (
          <section key={g.key} className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
              {g.label}章节
            </h2>
            {g.hint ? (
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] leading-relaxed">{g.hint}</p>
            ) : null}
            <ChapterList gameId={gameId} articles={g.articles} startIndex={startIndex} />
          </section>
        )
      })}

      {other.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--muted)]">其他</h2>
          <ChapterList gameId={gameId} articles={other} startIndex={runningIndex} />
        </section>
      )}
    </div>
  )
}
