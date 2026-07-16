/**
 * Patch react-easy-crop so ResizeObserver / computeSizes do not setState
 * when container and crop frame sizes are effectively unchanged (mobile flicker).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(root, '..', 'node_modules', 'react-easy-crop');

const RO_OLD = `this.initResizeObserver = () => {
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

const RO_NEW = `this.initResizeObserver = () => {
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

const SETSTATE_OLD = `if (((_this$state$cropSize = this.state.cropSize) === null || _this$state$cropSize === void 0 ? void 0 : _this$state$cropSize.height) !== cropSize.height || ((_this$state$cropSize2 = this.state.cropSize) === null || _this$state$cropSize2 === void 0 ? void 0 : _this$state$cropSize2.width) !== cropSize.width) this.props.onCropSizeChange && this.props.onCropSizeChange(cropSize);
				this.setState({ cropSize }, () => this.recomputeCropPosition({ isResizeTriggered }));
				if (this.props.setCropSize) this.props.setCropSize(cropSize);
				return cropSize;`;

const SETSTATE_NEW = `var _prevCrop = this.state.cropSize;
				var _cropUnchanged = _prevCrop && Math.abs(_prevCrop.width - cropSize.width) < 0.5 && Math.abs(_prevCrop.height - cropSize.height) < 0.5;
				if (_cropUnchanged) {
					if (this.props.setCropSize) this.props.setCropSize(cropSize);
					return cropSize;
				}
				if (((_this$state$cropSize = this.state.cropSize) === null || _this$state$cropSize === void 0 ? void 0 : _this$state$cropSize.height) !== cropSize.height || ((_this$state$cropSize2 = this.state.cropSize) === null || _this$state$cropSize2 === void 0 ? void 0 : _this$state$cropSize2.width) !== cropSize.width) this.props.onCropSizeChange && this.props.onCropSizeChange(cropSize);
				this.setState({ cropSize }, () => this.recomputeCropPosition({ isResizeTriggered }));
				if (this.props.setCropSize) this.props.setCropSize(cropSize);
				return cropSize;`;

function patchFile(rel) {
  const filePath = path.join(pkgRoot, rel);
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('__lastRoSize') && src.includes('_cropUnchanged')) {
    console.log(`SKIP already patched: ${rel}`);
    return;
  }
  if (!src.includes(RO_OLD)) {
    throw new Error(`ResizeObserver block not found in ${rel}`);
  }
  if (!src.includes(SETSTATE_OLD)) {
    throw new Error(`setState cropSize block not found in ${rel}`);
  }
  src = src.replace(RO_OLD, RO_NEW).replace(SETSTATE_OLD, SETSTATE_NEW);
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`OK patched: ${rel}`);
}

patchFile('index.module.mjs');
patchFile('index.js');
