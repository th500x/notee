/**
 * 称号 / 成就 unlock_conditions 统一求值（无 I/O）
 *
 * @param {object} condition - 配置表 JSON（成就扁平键或称号 typed/扁平）
 * @param {object} snapshot - playerProgressSnapshotService 产出
 * @returns {{ ok: boolean, reason?: string }}
 */

import {
  ACHIEVEMENT_METRIC_KEYS,
  TITLE_FLAT_KEYS,
  TITLE_UNLOCK_TYPES,
} from './unlockConditionKeys.js';

const SUPPORTED_ACHIEVEMENT_KEYS = new Set(Object.values(ACHIEVEMENT_METRIC_KEYS));

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function parseUnlockConditionsJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function metricValue(snapshot, key) {
  const m = snapshot?.metrics;
  if (!m || typeof m !== 'object') return NaN;
  const v = Number(m[key]);
  return Number.isFinite(v) ? v : NaN;
}

function isExploreEventCompleted(snapshot, eventId) {
  const id = String(eventId || '').trim();
  if (!id) return false;
  const set = snapshot?.completedExploreEventIds;
  if (set instanceof Set) return set.has(id);
  if (Array.isArray(set)) return set.includes(id);
  if (set && typeof set === 'object') return !!set[id];
  return false;
}

function tenureDaysAtLevel(snapshot, positionLevel) {
  const lv = Math.trunc(Number(positionLevel));
  if (!Number.isFinite(lv)) return 0;
  const map = snapshot?.tenureDaysByPositionLevel;
  if (!map || typeof map !== 'object') return 0;
  const v = Number(map[String(lv)] ?? map[lv]);
  return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

function evaluateTitleTyped(condition, snapshot) {
  const type = String(condition.type || '').trim();
  if (type === TITLE_UNLOCK_TYPES.TUTORIAL_EVENT) {
    const eventId = condition.event_id ?? condition.eventId;
    if (!String(eventId || '').trim()) {
      return { ok: false, reason: 'MISSING_EVENT_ID' };
    }
    return isExploreEventCompleted(snapshot, eventId)
      ? { ok: true }
      : { ok: false, reason: 'EVENT_NOT_COMPLETED' };
  }
  if (type === TITLE_UNLOCK_TYPES.POSITION_TENURE) {
    const level = Number(condition.position_level ?? condition.positionLevel);
    const minDays = Number(condition.min_days ?? condition.minDays);
    if (!Number.isFinite(level) || !Number.isFinite(minDays) || minDays < 0) {
      return { ok: false, reason: 'INVALID_POSITION_TENURE' };
    }
    const days = tenureDaysAtLevel(snapshot, level);
    return days >= minDays
      ? { ok: true }
      : { ok: false, reason: 'TENURE_INSUFFICIENT' };
  }
  return { ok: false, reason: `UNSUPPORTED_TITLE_TYPE:${type}` };
}

function evaluateFlatAchievementKeys(condition, snapshot) {
  const keys = Object.keys(condition).filter((k) => k !== 'type');
  if (!keys.length) {
    return { ok: false, reason: 'EMPTY_CONDITION' };
  }
  for (const key of keys) {
    if (!SUPPORTED_ACHIEVEMENT_KEYS.has(key)) {
      return { ok: false, reason: `UNSUPPORTED_ACHIEVEMENT_KEY:${key}` };
    }
    const threshold = Number(condition[key]);
    if (!Number.isFinite(threshold)) {
      return { ok: false, reason: `INVALID_THRESHOLD:${key}` };
    }
    const current = metricValue(snapshot, key);
    if (!Number.isFinite(current) || current < threshold) {
      return { ok: false, reason: `BELOW_THRESHOLD:${key}` };
    }
  }
  return { ok: true };
}

/**
 * @param {object|null|undefined} condition
 * @param {object} snapshot
 * @param {{ kind?: 'title'|'achievement' }} [opts]
 */
export function evaluateUnlockCondition(condition, snapshot, opts = {}) {
  const parsed = parseUnlockConditionsJson(condition);
  if (!parsed) {
    return { ok: false, reason: 'INVALID_CONDITION' };
  }

  if (parsed[TITLE_FLAT_KEYS.HAS_PREMIUM] === true) {
    return snapshot?.hasPremium ? { ok: true } : { ok: false, reason: 'PREMIUM_NOT_ACTIVE' };
  }

  if (parsed.type) {
    return evaluateTitleTyped(parsed, snapshot);
  }

  const kind = opts.kind === 'title' ? 'title' : 'achievement';
  if (kind === 'title') {
    return { ok: false, reason: 'TITLE_CONDITION_REQUIRES_TYPE' };
  }

  return evaluateFlatAchievementKeys(parsed, snapshot);
}
