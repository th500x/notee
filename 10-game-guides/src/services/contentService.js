import { GAMES } from '../constants'
import { parseFrontmatter } from '../utils/parseFrontmatter'

/** @type {Record<string, string>} */
const mdModules = import.meta.glob('../../content/games/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** @type {Record<string, string>} */
const imageModules = import.meta.glob('../../content/games/**/*.{png,jpg,jpeg,webp,gif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

function normalizeKey(path) {
  return path.replace(/\\/g, '/').replace(/^.*\/content\/games\//, '')
}

const mdByKey = {}
for (const [path, raw] of Object.entries(mdModules)) {
  mdByKey[normalizeKey(path)] = raw
}

const imageByKey = {}
for (const [path, url] of Object.entries(imageModules)) {
  imageByKey[normalizeKey(path)] = url
}

/**
 * @param {string} gameId
 */
export function getGame(gameId) {
  return GAMES.find((g) => g.id === gameId) ?? null
}

export function listGames() {
  return GAMES
}

/**
 * @param {string} gameId
 * @param {string} section
 * @param {string} slug
 */
export function articleKey(gameId, section, slug) {
  return `${gameId}/${section}/${slug}.md`
}

/**
 * @param {string} gameId
 * @param {string} section
 * @param {string} slug
 */
export function loadArticle(gameId, section, slug) {
  const key = articleKey(gameId, section, slug)
  const raw = mdByKey[key]
  if (!raw) {
    return null
  }

  const { data, body } = parseFrontmatter(raw)
  const game = getGame(gameId)
  const chapterMeta = game?.chapters?.find(
    (c) => c.section === section && c.slug === slug,
  )

  return {
    gameId,
    section,
    slug,
    key,
    title: String(data.title || chapterMeta?.title || slug),
    platform: data.platform ? String(data.platform) : game?.platform,
    updated: data.updated ? String(data.updated) : '',
    status: data.status ? String(data.status) : '',
    sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
    body,
    baseDir: `${gameId}/${section}`,
  }
}

/**
 * 将正文中的相对图片路径解析为 Vite 资源 URL
 * @param {string} baseDir 如 01-acs/basics
 * @param {string} src
 */
export function resolveContentImage(baseDir, src) {
  if (!src || /^(https?:|data:|blob:)/i.test(src)) {
    return src
  }
  if (src.startsWith('/')) {
    return src
  }

  const cleaned = src.replace(/^\.\//, '')
  const key = `${baseDir}/${cleaned}`.replace(/\/+/g, '/')
  return imageByKey[key] || src
}

/**
 * @param {string} gameId
 */
export function listGameArticles(gameId) {
  const game = getGame(gameId)
  if (!game) return []
  return game.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ch) => {
      const article = loadArticle(gameId, ch.section, ch.slug)
      return {
        ...ch,
        title: article?.title || ch.title,
        updated: article?.updated || '',
        status: article?.status || '',
        available: Boolean(article),
      }
    })
}
