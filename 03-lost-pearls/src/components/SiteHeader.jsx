import { Link, NavLink } from 'react-router-dom'
import { SITE } from '../constants'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href={SITE.homeUrl}
          title="返回主页"
          className="text-lg font-semibold tracking-tight text-[var(--text)] hover:text-[var(--accent)] sm:text-xl"
        >
          {SITE.name}
        </a>

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
        </nav>
      </div>
    </header>
  )
}
