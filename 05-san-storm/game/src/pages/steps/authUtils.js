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

// 获取IP地址和地理位置
export const getClientIPAndLocation = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      ip: data.ip || 'unknown',
      province: data.region || '未知',
      city: data.city || '未知',
      country: data.country_name || '未知'
    };
  } catch (error) {
    console.error('获取IP地理位置失败:', error);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return {
        ip: data.ip || 'unknown',
        province: '未知',
        city: '未知',
        country: '未知'
      };
    } catch (err) {
      return {
        ip: 'unknown',
        province: '未知',
        city: '未知',
        country: '未知'
      };
    }
  }
};
