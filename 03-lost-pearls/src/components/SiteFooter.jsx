import { SITE } from '../constants'

export default function SiteFooter() {
  return (
    <footer className="bg-[var(--surface)] border-t border-[var(--border)] mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-[var(--muted)]">
        <p className="text-lg font-bold text-[var(--text)] mb-4">{SITE.name}</p>
        <p>纯资讯汇总，无广告。正文来自本地 content/，注明来源与核实日期。</p>
      </div>
    </footer>
  )
}
