/**
 * 内容分页工具
 * 将章节内容按字符数分页
 */

import { PAGINATION_CONFIG } from '../constants'

/**
 * 将内容分割成页面
 * @param {string} content - 章节内容（Markdown格式）
 * @param {number} charsPerPage - 每页字符数限制
 * @returns {string[]} 分页后的内容数组
 * 
 * @example
 * const pages = splitContentIntoPages(chapter.content, 1800)
 * console.log(pages.length) // 页数
 */
export function splitContentIntoPages(content, charsPerPage = PAGINATION_CONFIG.CHARS_PER_PAGE) {
  if (!content) return []
  
  // 第一步：将内容分割成块（段落、标题、图片等）
  const blocks = splitIntoBlocks(content)
  
  // 第二步：将块组合成页
  const pages = combineBlocksIntoPages(blocks, charsPerPage)
  
  return pages.length > 0 ? pages : [content]
}

/**
 * 将内容分割成块
 * @param {string} content - 原始内容
 * @returns {string[]} 块数组
 */
function splitIntoBlocks(content) {
  const blocks = []
  let currentBlock = ''
  const lines = content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 标题或分隔符作为独立块
    if (line.startsWith('#') || line.trim() === '* * *') {
      if (currentBlock.trim()) {
        blocks.push(currentBlock)
        currentBlock = ''
      }
      blocks.push(line)
    } 
    // 空行且当前块有内容，结束当前块
    else if (line.trim() === '' && currentBlock.trim()) {
      blocks.push(currentBlock)
      currentBlock = ''
    }
    // 普通文本行，添加到当前块
    else if (line.trim()) {
      currentBlock += (currentBlock ? '\n' : '') + line
    }
  }
  
  // 添加最后一个块
  if (currentBlock.trim()) {
    blocks.push(currentBlock)
  }
  
  return blocks
}

/**
 * 将块组合成页
 * @param {string[]} blocks - 块数组
 * @param {number} charsPerPage - 每页字符数
 * @returns {string[]} 页面数组
 */
function combineBlocksIntoPages(blocks, charsPerPage) {
  const pages = []
  let currentPageContent = []
  let currentPageChars = 0
  
  for (const block of blocks) {
    const blockChars = block.length
    
    // 遇到二级标题(##)且当前页已有内容(超过MIN_CHARS_FOR_BREAK字符)，强制分页
    if (block.startsWith('##') && currentPageChars > PAGINATION_CONFIG.MIN_CHARS_FOR_BREAK) {
      if (currentPageContent.length > 0) {
        pages.push(currentPageContent.join('\n\n'))
        currentPageContent = []
        currentPageChars = 0
      }
    }
    
    // 遇到一级标题(#)或图片，且当前页已有一定内容，强制分页
    if ((block.startsWith('#') || block.includes('*（')) && 
        currentPageChars > charsPerPage * PAGINATION_CONFIG.HEADING_BREAK_THRESHOLD) {
      if (currentPageContent.length > 0) {
        pages.push(currentPageContent.join('\n\n'))
        currentPageContent = []
        currentPageChars = 0
      }
    }
    
    // 如果当前块加入后会超过页面限制，且当前页已有内容，则分页
    if (currentPageChars + blockChars > charsPerPage && currentPageContent.length > 0) {
      pages.push(currentPageContent.join('\n\n'))
      currentPageContent = [block]
      currentPageChars = blockChars
    } else {
      currentPageContent.push(block)
      currentPageChars += blockChars
    }
  }
  
  // 添加最后一页
  if (currentPageContent.length > 0) {
    pages.push(currentPageContent.join('\n\n'))
  }
  
  return pages
}

/**
 * 估算内容的页数（不实际分页）
 * @param {string} content - 内容
 * @param {number} charsPerPage - 每页字符数
 * @returns {number} 估算的页数
 */
export function estimatePageCount(content, charsPerPage = PAGINATION_CONFIG.CHARS_PER_PAGE) {
  if (!content) return 0
  return Math.ceil(content.length / charsPerPage)
}
