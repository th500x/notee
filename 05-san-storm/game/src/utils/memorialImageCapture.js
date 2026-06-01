/**
 * 纪念图 DOM → PNG blob。
 * 使用 html-to-image（SVG foreignObject），不创建克隆 iframe，
 * 避免 html2canvas 触发扩展（如 Grammarly）注册 unload 时的 Permissions-Policy 警告。
 */

/**
 * @param {HTMLElement} element
 * @param {{ backgroundColor?: string, scale?: number }} [options]
 * @returns {Promise<Blob | null>}
 */
export async function captureElementToBlob(element, options = {}) {
  const { toBlob } = await import('html-to-image');
  return toBlob(element, {
    backgroundColor: options.backgroundColor ?? '#1a1512',
    pixelRatio: options.scale ?? 1,
    cacheBust: true,
  });
}

/**
 * 阻止写作/语法类浏览器扩展在离屏导出节点上注入脚本（仍会观测 DOM 的扩展无法完全屏蔽）。
 * @param {HTMLElement} root
 */
export function markMemorialExportRootInert(root) {
  root.setAttribute('data-gramm', 'false');
  root.setAttribute('data-gramm_editor', 'false');
  root.setAttribute('data-enable-grammarly', 'false');
  root.setAttribute('spellcheck', 'false');
  root.setAttribute('autocomplete', 'off');
  root.setAttribute('autocorrect', 'off');
  root.setAttribute('autocapitalize', 'off');
  root.classList.add('grammarly-disable');
}
