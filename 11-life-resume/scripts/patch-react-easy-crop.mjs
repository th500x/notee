/**
 * Apply mobile-flicker fixes to react-easy-crop@6.2.2 after npm install.
 * Prefer this over patch-package on servers (handles dirty node_modules / CRLF).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgRoot = path.join(root, 'node_modules', 'react-easy-crop');
const MARKER = '__sanCropFreezeResize';

const RO_STOCK = `this.initResizeObserver = () => {
			if (typeof window.ResizeObserver === "undefined" || !this.containerRef) return;
			let isFirstResize = true;
			this.resizeObserver = new window.ResizeObserver((entries) => {
				if (isFirstResize) {
					isFirstResize = false;
					return;
				}
				this.computeSizes({ isResizeTriggered: true });
			});
			this.resizeObserver.observe(this.containerRef);
		};`;

const RO_PARTIAL = `this.initResizeObserver = () => {
			if (typeof window.ResizeObserver === "undefined" || !this.containerRef) return;
			let isFirstResize = true;
			this.__lastRoSize = null;
			this.resizeObserver = new window.ResizeObserver((entries) => {
				if (isFirstResize) {
					isFirstResize = false;
					return;
				}
				const entry = entries && entries[0];
				const box = entry && (entry.contentRect || (entry.contentBoxSize && entry.contentBoxSize[0]));
				const nextW = box ? (box.width != null ? box.width : box.inlineSize) : this.containerRef.clientWidth;
				const nextH = box ? (box.height != null ? box.height : box.blockSize) : this.containerRef.clientHeight;
				const prev = this.__lastRoSize;
				if (prev && Math.abs(prev.w - nextW) < 0.5 && Math.abs(prev.h - nextH) < 0.5) return;
				this.__lastRoSize = { w: nextW, h: nextH };
				this.computeSizes({ isResizeTriggered: true });
			});
			this.resizeObserver.observe(this.containerRef);
		};`;

const RO_PATCHED = `this.initResizeObserver = () => {
			if (typeof window.ResizeObserver === "undefined" || !this.containerRef) return;
			let isFirstResize = true;
			this.__lastRoSize = null;
			this.resizeObserver = new window.ResizeObserver((entries) => {
				if (isFirstResize) {
					isFirstResize = false;
					return;
				}
				if (this.__resizeFrozen) return;
				const entry = entries && entries[0];
				const box = entry && (entry.contentRect || (entry.contentBoxSize && entry.contentBoxSize[0]));
				const nextW = box ? (box.width != null ? box.width : box.inlineSize) : this.containerRef.clientWidth;
				const nextH = box ? (box.height != null ? box.height : box.blockSize) : this.containerRef.clientHeight;
				const prev = this.__lastRoSize;
				if (prev && Math.abs(prev.w - nextW) < 0.5 && Math.abs(prev.h - nextH) < 0.5) return;
				this.__lastRoSize = { w: nextW, h: nextH };
				this.computeSizes({ isResizeTriggered: true });
			});
			this.resizeObserver.observe(this.containerRef);
		};
		this.${MARKER} = () => {
			this.__resizeFrozen = true;
			if (this.resizeObserver) {
				this.resizeObserver.disconnect();
				this.resizeObserver = null;
			}
		};`;

const SETSTATE_STOCK = `if (((_this$state$cropSize = this.state.cropSize) === null || _this$state$cropSize === void 0 ? void 0 : _this$state$cropSize.height) !== cropSize.height || ((_this$state$cropSize2 = this.state.cropSize) === null || _this$state$cropSize2 === void 0 ? void 0 : _this$state$cropSize2.width) !== cropSize.width) this.props.onCropSizeChange && this.props.onCropSizeChange(cropSize);
				this.setState({ cropSize }, () => this.recomputeCropPosition({ isResizeTriggered }));
				if (this.props.setCropSize) this.props.setCropSize(cropSize);
				return cropSize;`;

const SETSTATE_PATCHED = `var _prevCrop = this.state.cropSize;
				var _cropUnchanged = _prevCrop && Math.abs(_prevCrop.width - cropSize.width) < 0.5 && Math.abs(_prevCrop.height - cropSize.height) < 0.5;
				if (_cropUnchanged) {
					if (this.props.setCropSize) this.props.setCropSize(cropSize);
					return cropSize;
				}
				if (((_this$state$cropSize = this.state.cropSize) === null || _this$state$cropSize === void 0 ? void 0 : _this$state$cropSize.height) !== cropSize.height || ((_this$state$cropSize2 = this.state.cropSize) === null || _this$state$cropSize2 === void 0 ? void 0 : _this$state$cropSize2.width) !== cropSize.width) this.props.onCropSizeChange && this.props.onCropSizeChange(cropSize);
				this.setState({ cropSize }, () => this.recomputeCropPosition({ isResizeTriggered }));
				if (this.props.setCropSize) this.props.setCropSize(cropSize);
				return cropSize;`;

const MEDIA_STOCK = `this.onMediaLoad = () => {
			const cropSize = this.computeSizes();
			if (cropSize) {
				this.previousCropSize = cropSize;
				this.emitCropData();
				this.setInitialCrop(cropSize);
				this.isInitialized = true;
			}
			if (this.props.onMediaLoaded) this.props.onMediaLoaded(this.mediaSize);
		};`;

const MEDIA_PATCHED = `this.onMediaLoad = () => {
			const cropSize = this.computeSizes();
			if (cropSize) {
				this.previousCropSize = cropSize;
				this.emitCropData();
				this.setInitialCrop(cropSize);
				this.isInitialized = true;
				const freeze = () => {
					if (typeof this.${MARKER} === "function") this.${MARKER}();
				};
				if (this.currentWindow && this.currentWindow.requestAnimationFrame) {
					this.currentWindow.requestAnimationFrame(() => {
						this.currentWindow.requestAnimationFrame(freeze);
					});
				} else freeze();
			}
			if (this.props.onMediaLoaded) this.props.onMediaLoaded(this.mediaSize);
		};`;

function restoreCleanPackage() {
  console.log('[patch-react-easy-crop] restoring clean react-easy-crop@6.2.2 …');
  execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', 'react-easy-crop@6.2.2', '--ignore-scripts', '--no-save'],
    { cwd: root, stdio: 'inherit' }
  );
}

function patchFile(rel) {
  const filePath = path.join(pkgRoot, rel);
  let src = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  if (src.includes(MARKER) && src.includes('_cropUnchanged')) {
    console.log(`[patch-react-easy-crop] SKIP already patched: ${rel}`);
    return;
  }

  if (src.includes(RO_PARTIAL)) {
    src = src.replace(RO_PARTIAL, RO_PATCHED);
  } else if (src.includes(RO_STOCK)) {
    src = src.replace(RO_STOCK, RO_PATCHED);
  } else {
    throw new Error(`ResizeObserver block not found in ${rel}`);
  }

  if (!src.includes('_cropUnchanged')) {
    if (!src.includes(SETSTATE_STOCK)) {
      throw new Error(`setState cropSize block not found in ${rel}`);
    }
    src = src.replace(SETSTATE_STOCK, SETSTATE_PATCHED);
  }

  if (!src.includes(MARKER) || !src.includes('requestAnimationFrame(freeze)')) {
    if (!src.includes(MEDIA_STOCK)) {
      throw new Error(`onMediaLoad block not found in ${rel}`);
    }
    src = src.replace(MEDIA_STOCK, MEDIA_PATCHED);
  }

  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`[patch-react-easy-crop] OK patched: ${rel}`);
}

function main() {
  if (!fs.existsSync(pkgRoot)) {
    console.warn('[patch-react-easy-crop] react-easy-crop not installed; skip');
    return;
  }

  const version = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version;
  if (version !== '6.2.2') {
    throw new Error(`[patch-react-easy-crop] expected react-easy-crop@6.2.2, found ${version}`);
  }

  try {
    patchFile('index.module.mjs');
    patchFile('index.js');
  } catch (err) {
    console.warn(`[patch-react-easy-crop] ${err.message}`);
    restoreCleanPackage();
    patchFile('index.module.mjs');
    patchFile('index.js');
  }
}

main();
