/**
 * Auth helpers (aligned with 05 game authUtils fingerprint / ID batch).
 */

export function validateAccountIdFormat(id) {
  if (!id || id.length !== 4) return false;
  const firstChar = id[0];
  const restChars = id.slice(1);
  if (!/^[0-9]$/.test(firstChar)) return false;
  if (!/^[A-Z0-9]{3}$/.test(restChars)) return false;
  return true;
}

export function normalizeAccountId(id) {
  return String(id || '')
    .trim()
    .toUpperCase();
}

/** 与 05 RegisterStep 一致的机器指纹 */
export function getMachineFingerprint() {
  const fingerprint = [
    navigator.language,
    screen.colorDepth,
    `${screen.width}x${screen.height}`,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < fingerprint.length; i += 1) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(36);
}

const ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 与 05 authUtils.generateBatchIds 一致 */
export function generateBatchIds(batchNumber) {
  const ids = [];
  const prefix = batchNumber.toString();

  for (let i = 0; i < ID_CHARSET.length; i += 1) {
    for (let j = 0; j < ID_CHARSET.length; j += 1) {
      for (let k = 0; k < ID_CHARSET.length; k += 1) {
        ids.push(prefix + ID_CHARSET[i] + ID_CHARSET[j] + ID_CHARSET[k]);
      }
    }
  }

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids;
}

/** 与 05 authUtils.getCurrentBatchInfo 一致 */
export function getCurrentBatchInfo() {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  const idBatches = JSON.parse(localStorage.getItem('idBatches') || '{}');

  for (let batch = 0; batch <= 9; batch += 1) {
    if (!idBatches[batch]) {
      const batchIds = generateBatchIds(batch);
      idBatches[batch] = batchIds;
      localStorage.setItem('idBatches', JSON.stringify(idBatches));
    }

    const availableInBatch = idBatches[batch].filter((id) => !registeredIds.includes(id));
    if (availableInBatch.length > 0) {
      return {
        currentBatch: batch,
        availableIds: availableInBatch,
        totalInBatch: idBatches[batch].length,
        usedInBatch: idBatches[batch].length - availableInBatch.length,
      };
    }
  }

  return {
    currentBatch: -1,
    availableIds: [],
    totalInBatch: 0,
    usedInBatch: 0,
  };
}

/** 与 05 authUtils.generateIdOptions 一致（05 后端不可用时的本地候选池） */
export function generateIdOptions(excludeIds = []) {
  const batchInfo = getCurrentBatchInfo();
  const exclude = new Set(
    (excludeIds || []).map((id) => normalizeAccountId(id)).filter(Boolean)
  );

  if (batchInfo.availableIds.length === 0) {
    return { ids: [], batchInfo };
  }

  const pool = batchInfo.availableIds.filter((id) => !exclude.has(normalizeAccountId(id)));
  if (pool.length === 0) {
    return { ids: [], batchInfo };
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    ids: shuffled.slice(0, 5),
    batchInfo,
  };
}

/** @deprecated 请用 generateIdOptions */
export function generateLocalRegisterCandidates(count = 5) {
  const result = generateIdOptions();
  return result.ids.slice(0, count);
}

export function rememberRegisteredId(id) {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  if (!registeredIds.includes(id)) {
    registeredIds.push(id);
    localStorage.setItem('registeredIds', JSON.stringify(registeredIds));
  }
}

/** 与 05 accountService 注册失败文案对齐：ID 已被占用 / 唯一键冲突 */
export function isRegisterIdUnavailableError(message) {
  const msg = String(message || '');
  return msg.includes('已被注册') || msg.includes('冲突');
}
