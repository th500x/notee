/**
 * 认证相关工具函数
 */

// 新的分批次ID生成系统
export const generateBatchIds = (batchNumber) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const ids = [];
  const prefix = batchNumber.toString();
  
  for (let i = 0; i < chars.length; i++) {
    for (let j = 0; j < chars.length; j++) {
      for (let k = 0; k < chars.length; k++) {
        const id = prefix + chars[i] + chars[j] + chars[k];
        ids.push(id);
      }
    }
  }
  
  // 打乱顺序
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  
  return ids;
};

// 验证ID格式
export const validateIdFormat = (id) => {
  if (!id || id.length !== 4) return false;
  
  const firstChar = id[0];
  const restChars = id.slice(1);
  
  if (!/^[0-9]$/.test(firstChar)) return false;
  if (!/^[A-Z0-9]{3}$/.test(restChars)) return false;
  
  return true;
};

// 获取当前批次和可用ID
export const getCurrentBatchInfo = () => {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  const idBatches = JSON.parse(localStorage.getItem('idBatches') || '{}');
  
  for (let batch = 0; batch <= 9; batch++) {
    if (!idBatches[batch]) {
      const batchIds = generateBatchIds(batch);
      idBatches[batch] = batchIds;
      localStorage.setItem('idBatches', JSON.stringify(idBatches));
    }
    
    const availableInBatch = idBatches[batch].filter(id => !registeredIds.includes(id));
    if (availableInBatch.length > 0) {
      return {
        currentBatch: batch,
        availableIds: availableInBatch,
        totalInBatch: idBatches[batch].length,
        usedInBatch: idBatches[batch].length - availableInBatch.length
      };
    }
  }
  
  return {
    currentBatch: -1,
    availableIds: [],
    totalInBatch: 0,
    usedInBatch: 0
  };
};

// 生成可用ID列表
export const generateIdOptions = () => {
  const batchInfo = getCurrentBatchInfo();
  
  if (batchInfo.availableIds.length === 0) {
    return { ids: [], batchInfo };
  }
  
  const shuffled = [...batchInfo.availableIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return { 
    ids: shuffled.slice(0, 5),
    batchInfo
  };
};

// 获取机器指纹（改进版 - 更稳定）
export const getMachineFingerprint = () => {
  const fingerprint = [
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

/** 外网 IP 服务可能极慢或被限流；无超时会导致注册按钮长时间卡住，用户误以为失败并重试 */
const IP_FETCH_TIMEOUT_MS = 4500;

async function fetchJsonWithTimeout(url, timeoutMs = IP_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    return null;
  }
}

// 获取IP地址和地理位置（带超时与降级，避免阻塞注册主流程）
export const getClientIPAndLocation = async () => {
  const fallback = {
    ip: 'unknown',
    province: '未知',
    city: '未知',
    country: '未知',
  };

  const primary = await fetchJsonWithTimeout('https://ipapi.co/json/');
  if (primary && primary.ip) {
    return {
      ip: primary.ip,
      province: primary.region || '未知',
      city: primary.city || '未知',
      country: primary.country_name || '未知',
    };
  }

  const secondary = await fetchJsonWithTimeout('https://api.ipify.org?format=json');
  if (secondary && secondary.ip) {
    return {
      ip: secondary.ip,
      province: '未知',
      city: '未知',
      country: '未知',
    };
  }

  return fallback;
};
