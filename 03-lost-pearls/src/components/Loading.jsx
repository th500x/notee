export default function Loading({ message = '加载中…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  )
}
