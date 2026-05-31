/**
 * html2canvas 导出包装。
 * 纪念图导出期间临时屏蔽 unload 监听注册，避免 Chrome Permissions-Policy 控制台警告。
 * html2canvas 克隆 iframe 时浏览器内核可能尝试 attach unload；与本功能无关且不影响导出结果。
 */

/**
 * @param {HTMLElement} element
 * @param {import('html2canvas').Options} [options]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureElementToCanvas(element, options = {}) {
  const originalAdd = EventTarget.prototype.addEventListener;
  const patchedAdd = function patchedAdd(type, listener, opts) {
    if (type === 'unload') return;
    return originalAdd.call(this, type, listener, opts);
  };

  EventTarget.prototype.addEventListener = patchedAdd;
  try {
    const { default: html2canvas } = await import('html2canvas');
    return await html2canvas(element, options);
  } finally {
    EventTarget.prototype.addEventListener = originalAdd;
  }
}
