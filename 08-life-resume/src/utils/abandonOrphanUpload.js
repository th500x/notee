import { abandonUploadObject as abandonUploadObjectApi } from '@/services/lifeResumeApi';

/**
 * 丢弃未入库的上传；已绑定 entry 的媒体返回 MEDIA_IN_USE，静默忽略。
 */
export async function abandonOrphanUpload(ossKey) {
  const key = String(ossKey || '').trim();
  if (!key) return;
  try {
    await abandonUploadObjectApi(key);
  } catch (err) {
    if (err.code === 'MEDIA_IN_USE') return;
    console.warn('[life-resume] abandon upload failed:', key, err.message);
  }
}

export function isPersistedOssKey(ossKey, initialPersistedOssKeys) {
  const key = String(ossKey || '').trim();
  if (!key) return false;
  if (!initialPersistedOssKeys) return false;
  if (initialPersistedOssKeys instanceof Set) {
    return initialPersistedOssKeys.has(key);
  }
  return Array.isArray(initialPersistedOssKeys) && initialPersistedOssKeys.includes(key);
}

/** 批量作废：跳过已入库（initialPersisted）项 */
export async function abandonOrphanUploads(items, initialPersistedOssKeys) {
  const list = Array.isArray(items) ? items : [];
  await Promise.all(
    list.map(async (item) => {
      if (isPersistedOssKey(item.ossKey, initialPersistedOssKeys)) return;
      await abandonOrphanUpload(item.ossKey);
    })
  );
}
