import { Link, NavLink } from 'react-router-dom'
import { SITE } from '../constants'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <a
            href={SITE.homeUrl}
            className="group inline-flex items-baseline gap-2"
            title="返回 Notee 主页"
          >
            <span className="text-lg font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--accent)] sm:text-xl">
              {SITE.name}
            </span>
            <span className="hidden text-xs text-[var(--muted)] sm:inline">{SITE.nameEn}</span>
          </a>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{SITE.tagline}</p>
        </div>

        <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-md px-2.5 py-1.5 transition-colors ${
                isActive
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`
            }
          >
            目录
          </NavLink>
          <Link
            to="/games/01-acs"
            className="rounded-md px-2.5 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            01 修仙
          </Link>
          <a
            href={SITE.homeUrl}
            className="hidden rounded-md px-2.5 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline"
          >
            主站
          </a>
        </nav>
      </div>
    </header>
  )
}
