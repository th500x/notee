import { Link } from 'react-router-dom'
import { listGames } from '../services/contentService'

export default function HomePage() {
  const games = listGames()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="max-w-2xl">
        <p className="text-sm tracking-wide text-[var(--accent)]">10 · Game Guides</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          游戏攻略
        </h1>
        <p className="mt-4 text-[var(--muted)] leading-relaxed">
          把分散、易过时的攻略整理成可检索的结构化条目。纯阅读、无广告，适合 PC / 竖屏。
        </p>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--muted)]">
            游戏目录
          </h2>
          <span className="text-xs text-[var(--muted)]">{games.length} 部</span>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                to={`/games/${game.id}`}
                className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--accent-dim)] hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">{game.id}</p>
                    <h3 className="mt-1 text-lg font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {game.title}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">{game.titleEn}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {game.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{game.blurb}</p>
                <p className="mt-4 text-xs text-[var(--accent)]">
                  {game.platform} · {game.chapters.length} 篇基础 →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 max-w-2xl rounded-xl border border-dashed border-[var(--border)] px-5 py-6">
        <h2 className="text-sm font-medium text-[var(--text)]">阅读说明</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)] leading-relaxed">
          <li>正文维护在仓库 <code className="text-[var(--accent-dim)]">content/</code>，配图放各章 images/。</li>
          <li>条目尽量标注来源类型与核实日期；过时与串味内容会标注或排除。</li>
          <li>当前无后端接口：静态 Markdown 由前端直接加载（与佚事雜錄「本地内容」模式同类）。</li>
        </ul>
      </section>
    </div>
  )
}
