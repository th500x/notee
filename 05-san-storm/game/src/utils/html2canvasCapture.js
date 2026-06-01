/**
 * html2canvas 导出包装。
 * html2canvas 通过 ownerDocument.createElement('iframe') 克隆 DOM；
 * 需 patch Document.prototype.createElement 才能注入 allow="unload"。
 */

let patchDepth = 0;
/** @type {(() => void) | null} */
let activeRestore = null;

function tagIframeAllowUnload(el) {
  const prev = el.getAttribute('allow') || '';
  const parts = new Set(prev.split(';').map((s) => s.trim()).filter(Boolean));
  parts.add('unload');
  el.setAttribute('allow', [...parts].join('; '));
}

function installHtml2CanvasPolicyWorkaround() {
  if (patchDepth > 0) {
    patchDepth += 1;
    return;
  }
  patchDepth = 1;

  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const originalDocCreate = Document.prototype.createElement;

  const patchedAdd = function patchedAdd(type, listener, options) {
    if (type === 'unload') return;
    return originalAdd.call(this, type, listener, options);
  };

  const patchedRemove = function patchedRemove(type, listener, options) {
    if (type === 'unload') return;
    return originalRemove.call(this, type, listener, options);
  };

  Document.prototype.createElement = function patchedDocCreate(tagName, options) {
    const el = originalDocCreate.call(this, tagName, options);
    if (String(tagName).toLowerCase() === 'iframe') tagIframeAllowUnload(el);
    return el;
  };

  EventTarget.prototype.addEventListener = patchedAdd;
  EventTarget.prototype.removeEventListener = patchedRemove;

  const winOnloadDesc = Object.getOwnPropertyDescriptor(Window.prototype, 'onload');
  const winOnunloadDesc = Object.getOwnPropertyDescriptor(Window.prototype, 'onunload');
  const origOnloadSet = winOnloadDesc?.set;
  const origOnloadGet = winOnloadDesc?.get;
  const origOnunloadSet = winOnunloadDesc?.set;
  const origOnunloadGet = winOnunloadDesc?.get;

  if (origOnloadSet) {
    Object.defineProperty(Window.prototype, 'onload', {
      configurable: true,
      enumerable: winOnloadDesc.enumerable,
      get: origOnloadGet,
      set(handler) {
        if (this === window) {
          origOnloadSet.call(this, handler);
          return;
        }
        if (handler == null) return;
        originalAdd.call(this, 'load', handler, { once: true });
      },
    });
  }

  if (origOnunloadSet) {
    Object.defineProperty(Window.prototype, 'onunload', {
      configurable: true,
      enumerable: winOnunloadDesc.enumerable,
      get: origOnunloadGet,
      set(handler) {
        if (this !== window) return;
        origOnunloadSet.call(this, handler);
      },
    });
  }

  activeRestore = () => {
    EventTarget.prototype.addEventListener = originalAdd;
    EventTarget.prototype.removeEventListener = originalRemove;
    Document.prototype.createElement = originalDocCreate;
    if (winOnloadDesc) Object.defineProperty(Window.prototype, 'onload', winOnloadDesc);
    if (winOnunloadDesc) Object.defineProperty(Window.prototype, 'onunload', winOnunloadDesc);
    activeRestore = null;
    patchDepth = 0;
  };
}

function restoreHtml2CanvasPolicyWorkaround() {
  if (patchDepth <= 0) return;
  patchDepth -= 1;
  if (patchDepth === 0 && activeRestore) activeRestore();
}

/**
 * @param {HTMLElement} element
 * @param {import('html2canvas').Options} [options]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureElementToCanvas(element, options = {}) {
  installHtml2CanvasPolicyWorkaround();
  try {
    const html2canvasModule = await import('html2canvas');
    return await html2canvasModule.default(element, options);
  } finally {
    restoreHtml2CanvasPolicyWorkaround();
  }
}
