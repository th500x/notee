import { Link } from 'react-router-dom'
import { listGames } from '../services/contentService'

export default function HomePage() {
  const games = listGames()

  return (
    <div>
      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-[var(--text)]">游戏目录</h2>
          <span className="text-sm text-[var(--muted)]">{games.length} 部</span>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                to={`/games/${game.id}`}
                className="group block h-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md transition-colors hover:border-[var(--accent-dim)] hover:bg-[var(--surface-2)]"
              >
                <p className="text-sm text-[var(--muted)]">{game.id}</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--text)] group-hover:text-[var(--accent)]">
                  {game.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{game.titleEn}</p>
                <p className="mt-4 text-[var(--muted)] leading-relaxed">{game.blurb}</p>
                <p className="mt-4 text-sm text-[var(--accent)]">
                  {game.platform} · {game.chapters.length} 章
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md">
        <h2 className="text-2xl font-bold text-[var(--text)]">阅读说明</h2>
        <ul className="mt-4 space-y-2 text-[var(--muted)] leading-relaxed">
          <li>正文维护在仓库 <code className="text-[var(--accent-dim)]">content/</code>，配图放各章 images/。</li>
          <li>条目尽量标注来源类型与核实日期；过时与串味内容会标注或排除。</li>
          <li>当前无后端接口：静态 Markdown 由前端直接加载。</li>
        </ul>
      </section>
    </div>
  )
}
