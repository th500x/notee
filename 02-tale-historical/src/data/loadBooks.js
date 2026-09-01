/**
 * 自动扫描 src/data/books/<id>/ 组装书架数据。
 * 目录由 02-2-tales 的 publish_to_02 脚本写入，无需手改注册表。
 */

const metaModules = import.meta.glob('./books/*/meta.json', { eager: true })
const chapterModules = import.meta.glob('./books/*/chapters/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * 从章节 Markdown 取标题：优先首个一级标题，否则回退文件名。
 * @param {string} content
 * @param {string} fallback
 */
function extractChapterTitle(content, fallback) {
  if (typeof content !== 'string') return fallback
  const match = content.match(/^#\s+(.+)$/m)
  if (match) {
    return match[1].trim()
  }
  return fallback
}

/**
 * @param {string} globPath e.g. './books/02-12-thailand-notes/meta.json'
 */
function bookIdFromMetaPath(globPath) {
  const parts = globPath.split('/')
  // ['./books', '<id>', 'meta.json']
  return parts[2]
}

/**
 * @param {string} globPath e.g. './books/02-12-thailand-notes/chapters/01.md'
 */
function parseChapterPath(globPath) {
  const parts = globPath.split('/')
  const bookId = parts[2]
  const fileName = parts[4] || ''
  const numMatch = fileName.match(/^(\d+)\.md$/)
  const num = numMatch ? Number(numMatch[1]) : NaN
  return { bookId, fileName, num }
}

/**
 * @returns {Array<Object>} 阅读器使用的书籍对象列表
 */
export function loadBooks() {
  const booksById = new Map()

  for (const [globPath, mod] of Object.entries(metaModules)) {
    const bookId = bookIdFromMetaPath(globPath)
    const meta = mod?.default ?? mod
    if (!meta || typeof meta !== 'object') {
      console.warn('[loadBooks] 无效 meta:', globPath)
      continue
    }
    const id = typeof meta.id === 'string' ? meta.id : bookId
    booksById.set(id, {
      id,
      title: meta.title || id,
      description: meta.description || '',
      cover: meta.cover ?? null,
      theme: meta.theme || 'blue',
      category: meta.category || '游记杂谈',
      requirePassword: Boolean(meta.requirePassword),
      password: meta.password ?? null,
      images: {},
      chapters: [],
      _chapterSort: [],
    })
  }

  for (const [globPath, raw] of Object.entries(chapterModules)) {
    const { bookId, fileName, num } = parseChapterPath(globPath)
    const book = booksById.get(bookId)
    if (!book) {
      console.warn('[loadBooks] 章节无对应 meta，已忽略:', globPath)
      continue
    }
    if (!Number.isFinite(num)) {
      console.warn('[loadBooks] 章节文件名非法，已忽略:', globPath)
      continue
    }
    const pad = String(num).padStart(2, '0')
    const content = typeof raw === 'string' ? raw : String(raw ?? '')
    const fallbackTitle = fileName.replace(/\.md$/, '') || `第${pad}章`
    book._chapterSort.push({
      num,
      chapter: {
        id: `chapter-${pad}`,
        title: extractChapterTitle(content, fallbackTitle),
        content,
      },
    })
  }

  const books = []
  for (const book of booksById.values()) {
    book._chapterSort.sort((a, b) => a.num - b.num)
    book.chapters = book._chapterSort.map((item) => item.chapter)
    delete book._chapterSort
    if (book.chapters.length === 0) {
      console.warn('[loadBooks] 书籍无章节，仍上架空书:', book.id)
    }
    books.push(book)
  }

  books.sort((a, b) => a.id.localeCompare(b.id))
  return books
}
