/**
 * 游戏 BGM 播放（HTMLAudioElement · 场景栈 · 交叉淡入淡出）
 */

import {
  BGM_CROSSFADE_MS,
  BGM_DEFAULT_VOLUME,
  BGM_TRACK_FILES,
  resolveBgmUrl,
} from '@/config/bgmConfig';
import { readBgmEnabled, writeBgmEnabled } from '@/utils/bgmUserPref';

/** @type {Array<keyof typeof BGM_TRACK_FILES>} */
const sceneStack = [];

let audioA = null;
let audioB = null;
let activeIsA = true;
let unlocked = false;
let fadeToken = 0;
let unlockHandler = null;
/** @type {keyof typeof BGM_TRACK_FILES | null} */
let playingSceneId = null;
let bgmEnabled = true;

function pauseAllChannels() {
  [audioA, audioB].forEach((el) => {
    if (!el) return;
    el.pause();
    el.volume = 0;
  });
}

export function isBgmEnabled() {
  return bgmEnabled;
}

/** 从 localStorage 同步用户偏好（GamePage 初始化时） */
export function syncBgmEnabledFromStorage() {
  bgmEnabled = readBgmEnabled();
  if (!bgmEnabled) {
    fadeToken += 1;
    playingSceneId = null;
    pauseAllChannels();
  }
}

/**
 * 个人中心音乐开/关
 * @param {boolean} enabled
 */
export function setBgmEnabled(enabled) {
  const next = !!enabled;
  if (bgmEnabled === next) return;
  bgmEnabled = next;
  writeBgmEnabled(next);
  if (!next) {
    fadeToken += 1;
    playingSceneId = null;
    pauseAllChannels();
    return;
  }
  playingSceneId = null;
  void applyTopScene();
}

function createAudio() {
  if (typeof Audio === 'undefined') return null;
  const el = new Audio();
  el.loop = true;
  el.preload = 'auto';
  return el;
}

function getActiveAudio() {
  return activeIsA ? audioA : audioB;
}

function getInactiveAudio() {
  return activeIsA ? audioB : audioA;
}

function sceneIdValid(sceneId) {
  return sceneId && Object.prototype.hasOwnProperty.call(BGM_TRACK_FILES, sceneId);
}

function topScene() {
  return sceneStack.length ? sceneStack[sceneStack.length - 1] : null;
}

function attachUnlockListener() {
  if (typeof document === 'undefined' || unlockHandler) return;
  unlockHandler = () => {
    unlockBgm();
  };
  document.addEventListener('pointerdown', unlockHandler, { once: true, passive: true });
  document.addEventListener('keydown', unlockHandler, { once: true, passive: true });
}

/**
 * 初始化双 Audio 通道（GamePage 挂载时调用一次）
 */
export function initBgmService() {
  if (audioA && audioB) return;
  audioA = createAudio();
  audioB = createAudio();
  attachUnlockListener();
}

/**
 * 用户交互后解除自动播放限制并播放栈顶曲目
 */
export function unlockBgm() {
  if (unlocked) return;
  unlocked = true;
  if (unlockHandler && typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', unlockHandler);
    document.removeEventListener('keydown', unlockHandler);
    unlockHandler = null;
  }
  void applyTopScene();
}

/**
 * @param {keyof typeof BGM_TRACK_FILES} sceneId
 */
export function pushBgmScene(sceneId) {
  if (!sceneIdValid(sceneId)) return;
  const top = topScene();
  if (top === sceneId) return;
  sceneStack.push(sceneId);
  void applyTopScene();
}

export function popBgmScene() {
  if (sceneStack.length <= 1) return;
  sceneStack.pop();
  playingSceneId = null;
  void applyTopScene();
}

/**
 * 重置并释放（GamePage 卸载）
 */
export function destroyBgmService() {
  fadeToken += 1;
  sceneStack.length = 0;
  playingSceneId = null;
  [audioA, audioB].forEach((el) => {
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  });
  unlocked = false;
}

async function applyTopScene() {
  if (!bgmEnabled) return;
  const sceneId = topScene();
  if (!sceneId || !audioA || !audioB) return;
  if (playingSceneId === sceneId) return;

  const url = resolveBgmUrl(sceneId);
  if (!url) return;

  const next = getInactiveAudio();
  const prev = getActiveAudio();
  if (!next || !prev) return;

  const token = ++fadeToken;
  activeIsA = !activeIsA;

  next.volume = 0;
  next.src = url;
  next.load();

  if (unlocked) {
    try {
      await next.play();
    } catch {
      return;
    }
  }

  const steps = Math.max(8, Math.floor(BGM_CROSSFADE_MS / 40));
  const stepMs = BGM_CROSSFADE_MS / steps;

  for (let i = 1; i <= steps; i += 1) {
    if (token !== fadeToken) return;
    await new Promise((r) => setTimeout(r, stepMs));
    const t = i / steps;
    next.volume = BGM_DEFAULT_VOLUME * t;
    prev.volume = BGM_DEFAULT_VOLUME * (1 - t);
  }

  if (token !== fadeToken) return;
  prev.pause();
  prev.volume = 0;
  next.volume = BGM_DEFAULT_VOLUME;
  playingSceneId = sceneId;
}

/**
 * GamePage 进入时压入默认主题曲
 */
export function ensureDefaultBgmScene() {
  if (!sceneStack.length) {
    sceneStack.push('theme_main');
  }
  void applyTopScene();
}
