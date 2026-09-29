/**
 * 轻量 YAML frontmatter 解析（仅支持本站正文用到的标量 / 字符串数组）
 * @param {string} raw
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') {
    return { data: {}, body: '' }
  }

  const trimmed = raw.replace(/^\uFEFF/, '')
  if (!trimmed.startsWith('---')) {
    return { data: {}, body: trimmed }
  }

  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) {
    return { data: {}, body: trimmed }
  }

  const yamlBlock = trimmed.slice(3, end).replace(/^\r?\n/, '')
  const body = trimmed.slice(end + 4).replace(/^\r?\n/, '')
  const data = {}

  const lines = yamlBlock.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!m) {
      i += 1
      continue
    }
    const key = m[1]
    let value = m[2]
    if (value === '' || value === '|' || value === '>') {
      const items = []
      i += 1
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, ''))
        i += 1
      }
      data[key] = items
      continue
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
    i += 1
  }

  return { data, body }
}
