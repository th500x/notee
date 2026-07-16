/**
 * Patch react-easy-crop for mobile flicker:
 * 1) Skip ResizeObserver / setState when size unchanged
 * 2) After media init, disconnect ResizeObserver so browser chrome
 *    (address bar) resizes cannot keep recomputing the crop frame
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(root, '..', 'node_modules', 'react-easy-crop');

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

function patchFile(rel) {
  const filePath = path.join(pkgRoot, rel);
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(MARKER)) {
    console.log(`SKIP already fully patched: ${rel}`);
    return;
  }

  // Allow re-patching files that only have the older debounce patch
  if (src.includes('__lastRoSize') && src.includes('_cropUnchanged')) {
    const roOldPartial = `this.initResizeObserver = () => {
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
    if (!src.includes(roOldPartial)) {
      throw new Error(`Partial RO block not found in ${rel}`);
    }
    src = src.replace(roOldPartial, RO_PATCHED);
  } else {
    if (!src.includes(RO_STOCK)) throw new Error(`ResizeObserver block not found in ${rel}`);
    if (!src.includes(SETSTATE_STOCK)) throw new Error(`setState cropSize block not found in ${rel}`);
    src = src.replace(RO_STOCK, RO_PATCHED).replace(SETSTATE_STOCK, SETSTATE_PATCHED);
  }

  if (!src.includes(MEDIA_STOCK)) throw new Error(`onMediaLoad block not found in ${rel}`);
  src = src.replace(MEDIA_STOCK, MEDIA_PATCHED);

  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`OK patched: ${rel}`);
}

patchFile('index.module.mjs');
patchFile('index.js');
