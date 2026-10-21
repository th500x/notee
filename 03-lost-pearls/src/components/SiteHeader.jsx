import { NavLink } from 'react-router-dom'
import { SITE } from '../constants'

const navClass = ({ isActive }) =>
  `px-4 py-2 rounded-lg transition-colors ${
    isActive
      ? 'bg-[var(--surface-2)] text-[var(--text)]'
      : 'text-[var(--muted)] hover:text-[var(--text)]'
  }`

export default function SiteHeader() {
  return (
    <header className="bg-[var(--surface)] shadow-sm border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <a
              href={SITE.homeUrl}
              className="text-3xl font-bold text-[var(--text)] hover:text-[var(--accent)] transition-colors cursor-pointer relative group inline-block"
            >
              {SITE.name}
              <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                返回主页
              </span>
            </a>
            <p className="text-[var(--muted)] mt-2">{SITE.tagline}</p>
          </div>
          <nav className="flex shrink-0 items-center gap-3">
            <NavLink to="/" end className={navClass}>
              目录
            </NavLink>
            <NavLink to="/games/01-acs" className={navClass}>
              01 修仙
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  )
}
