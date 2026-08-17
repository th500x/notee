import { SITE } from '../constants'

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {SITE.name} · 纯资讯汇总，无广告
        </p>
        <p>
          正文来自本地 <code className="text-[var(--accent-dim)]">content/</code>
          ，注明来源与核实日期
        </p>
      </div>
    </footer>
  )
}
