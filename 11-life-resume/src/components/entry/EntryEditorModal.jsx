import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  countGraphemes,
  LIFE_ENTRY_BODY_MAX,
  LIFE_ENTRY_TITLE_MAX,
} from '@shared/utils/lifeResumeGraphemeCount.js';
import {
  LIFE_STAGE_CODES,
  LIFE_STAGE_LABELS,
} from '@shared/utils/lifeResumeEntryTime.js';
import { LIFE_ENTRY_TAGS } from '@shared/utils/lifeResumeEntryTags.js';
import { validateMediaBundle } from '@shared/utils/lifeResumeMediaRules.js';
import { createEntry, updateEntry } from '@/services/lifeResumeApi';
import { normalizeAccountId, validateAccountIdFormat } from '@/utils/authUtils';
import EntryPermissionFields from '@/components/entry/EntryPermissionFields';
import EntryMediaUpload from '@/components/entry/EntryMediaUpload';
import EntryDriveFields from '@/components/entry/EntryDriveFields';
import EntryLocationFields from '@/components/entry/EntryLocationFields';
import { parseGoogleDriveShareUrl } from '@shared/utils/parseGoogleDriveShareUrl.js';
import { parseGoogleMapsShareUrl } from '@shared/utils/parseGoogleMapsShareUrl.js';
import { validateCoordinates } from '@shared/utils/lifeResumeLocation.js';
import { formatLifeResumeError, isAuthError } from '@/utils/lifeResumeErrors';

const EMPTY_FORM = {
  timeMode: 'year',
  year: '',
  lifeStage: 'youth',
  month: '',
  day: '',
  title: '',
  body: '',
  tags: [],
  visibility: 'public',
  granteeId: '',
  isPinned: false,
  complianceAck: false,
  googleDriveShareUrl: '',
  googleDriveDisplayLabel: '',
  locationEnabled: false,
  locationPlaceName: '',
  locationMapsUrl: '',
  latitude: '',
  longitude: '',
  locationCaptureMethod: 'none',
  locationPublicLabelPreview: '',
};

function buildFormFromEntry(entry) {
  if (!entry) return { ...EMPTY_FORM };
  return {
    timeMode: entry.year != null ? 'year' : 'stage',
    year: entry.year != null ? String(entry.year) : '',
    lifeStage: entry.lifeStage || 'youth',
    month: entry.month != null ? String(entry.month) : '',
    day: entry.day != null ? String(entry.day) : '',
    title: entry.title || '',
    body: entry.body || '',
    tags: entry.tags || [],
    visibility: entry.visibility || 'public',
    granteeId: entry.granteeAccountId || '',
    isPinned: !!entry.isPinned,
    complianceAck: !!entry.complianceAckAt,
    googleDriveShareUrl: entry.googleDriveShareUrl || '',
    googleDriveDisplayLabel: entry.googleDriveDisplayLabel || '',
    locationEnabled:
      !!(entry.latitude != null && entry.longitude != null) ||
      !!entry.locationPlaceName ||
      !!entry.locationMapsUrl ||
      !!entry.locationPublicLabel,
    locationPlaceName: entry.locationPlaceName || '',
    locationMapsUrl: entry.locationMapsUrl || '',
    latitude: entry.latitude != null ? String(entry.latitude) : '',
    longitude: entry.longitude != null ? String(entry.longitude) : '',
    locationCaptureMethod: entry.locationCaptureMethod || 'none',
    locationPublicLabelPreview: entry.locationPublicLabel || '',
  };
}

function buildPayload(form, status, mediaBundleType, mediaItems) {
  const payload = {
    title: form.title,
    body: form.body,
    tags: form.tags,
    visibility: form.visibility,
    isPinned: form.isPinned,
    status,
    complianceAck: form.complianceAck,
    googleDriveShareUrl: form.googleDriveShareUrl.trim(),
    googleDriveDisplayLabel: form.googleDriveDisplayLabel.trim(),
    mediaBundleType,
    mediaItems: mediaItems.map((item) => ({
      ossKey: item.ossKey,
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      sortOrder: item.sortOrder,
      originalFilename: item.originalFilename,
    })),
  };

  if (form.timeMode === 'year') {
    payload.year = form.year ? Number(form.year) : null;
    payload.lifeStage = null;
    payload.month = form.month ? Number(form.month) : null;
    payload.day = form.day ? Number(form.day) : null;
  } else {
    payload.year = null;
    payload.lifeStage = form.lifeStage;
    payload.month = null;
    payload.day = null;
  }

  if (form.visibility === 'specific') {
    payload.granteeAccountId = normalizeAccountId(form.granteeId);
  } else {
    payload.granteeAccountId = null;
  }

  payload.locationEnabled = form.locationEnabled;
  if (form.locationEnabled) {
    let placeName = form.locationPlaceName.trim();
    let mapsUrl = form.locationMapsUrl.trim();

    if (mapsUrl) {
      const parsed = parseGoogleMapsShareUrl(mapsUrl);
      if (parsed.ok && !parsed.empty) {
        mapsUrl = parsed.shareUrl;
        if (parsed.placeName && !placeName) placeName = parsed.placeName;
      }
    }

    payload.locationPlaceName = placeName;
    payload.locationMapsUrl = mapsUrl;
    payload.latitude = form.latitude;
    payload.longitude = form.longitude;
    payload.locationCaptureMethod = form.locationCaptureMethod || 'map_pick';
  }

  return payload;
}

export default function EntryEditorModal({ open, entry, profileDefaults, onClose, onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [mediaBundleType, setMediaBundleType] = useState('none');
  const [mediaItems, setMediaItems] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const bodyCount = useMemo(() => countGraphemes(form.body), [form.body]);
  const titleCount = useMemo(() => countGraphemes(form.title), [form.title]);
  const isEdit = !!entry?.id;

  useEffect(() => {
    if (!open) return;
    const base = buildFormFromEntry(entry);
    if (!entry && profileDefaults) {
      base.visibility = profileDefaults.pageDefaultVisibility || 'public';
      base.granteeId = profileDefaults.defaultGranteeAccountId || '';
    }
    setForm(base);
    setMediaBundleType(entry?.mediaBundleType || 'none');
    setMediaItems(
      (entry?.media || []).map((item) => ({
        ossKey: item.ossKey,
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        sortOrder: item.sortOrder,
        originalFilename: item.originalFilename,
        url: item.url,
        thumbUrl: item.thumbUrl,
      }))
    );
    setError('');
  }, [open, entry, profileDefaults]);

  if (!open) return null;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag) => {
    setForm((prev) => {
      const has = prev.tags.includes(tag);
      return {
        ...prev,
        tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  const validateClient = () => {
    if (form.timeMode === 'year' && !form.year) {
      return '请填写年份';
    }
    if (!form.body.trim()) {
      return '请输入正文';
    }
    if (bodyCount > LIFE_ENTRY_BODY_MAX) {
      return `正文不能超过 ${LIFE_ENTRY_BODY_MAX} 字`;
    }
    if (titleCount > LIFE_ENTRY_TITLE_MAX) {
      return `标题不能超过 ${LIFE_ENTRY_TITLE_MAX} 字`;
    }
    if (form.visibility === 'specific') {
      const grantee = normalizeAccountId(form.granteeId);
      if (!grantee || !validateAccountIdFormat(grantee)) {
        return '特定可见须填写有效的 4 位 ID';
      }
    }
    const driveUrl = form.googleDriveShareUrl.trim();
    if (driveUrl) {
      const parsed = parseGoogleDriveShareUrl(driveUrl);
      if (!parsed.ok) {
        return parsed.error;
      }
    } else if (form.googleDriveDisplayLabel.trim()) {
      return '填写云盘展示名须同时提供链接';
    }
    if (form.locationEnabled) {
      const hasCoords = validateCoordinates(form.latitude, form.longitude).ok;
      const hasPlace = form.locationPlaceName.trim().length > 0;
      const mapsRaw = form.locationMapsUrl.trim();
      const mapsParsed = mapsRaw ? parseGoogleMapsShareUrl(mapsRaw) : { ok: true, empty: true };
      if (mapsRaw && !mapsParsed.ok) {
        return mapsParsed.error;
      }
      if (!hasCoords && !hasPlace && !mapsRaw) {
        return '开启位置后须填写地点名称、粘贴 Google 地图链接，或填写经纬度';
      }
    }
    const mediaCheck = validateMediaBundle(
      mediaBundleType,
      mediaItems.map((item) => ({
        mediaType: item.mediaType,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      }))
    );
    if (!mediaCheck.ok) {
      return mediaCheck.error;
    }
    return '';
  };

  const handleSubmit = async (status) => {
    setError('');
    if (status === 'published' && !form.complianceAck) {
      setError('发布前请勾选内容规范确认');
      return;
    }
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form, status, mediaBundleType, mediaItems);
      const result = isEdit
        ? await updateEntry(entry.id, payload)
        : await createEntry(payload);
      onSaved?.(result.data, status);
      onClose?.();
    } catch (err) {
      setError(formatLifeResumeError(err));
      if (isAuthError(err)) {
        navigate('/login');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? '编辑片段' : '新建片段'}
          </h2>
          <button type="button" className="text-slate-500 hover:text-slate-800" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          <section className="space-y-3">
            <p className="text-sm font-medium text-slate-800">时间</p>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.timeMode === 'year'}
                  onChange={() => setField('timeMode', 'year')}
                />
                具体年份
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.timeMode === 'stage'}
                  onChange={() => setField('timeMode', 'stage')}
                />
                人生阶段
              </label>
            </div>
            {form.timeMode === 'year' ? (
              <div className="grid grid-cols-3 gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="年份"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => setField('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="月（可选）"
                  inputMode="numeric"
                  value={form.month}
                  onChange={(e) => setField('month', e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="日（可选）"
                  inputMode="numeric"
                  value={form.day}
                  onChange={(e) => setField('day', e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.lifeStage}
                onChange={(e) => setField('lifeStage', e.target.value)}
              >
                {LIFE_STAGE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {LIFE_STAGE_LABELS[code]}
                  </option>
                ))}
              </select>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-slate-800">标签（可选，可多选）</p>
            <div className="flex flex-wrap gap-2">
              {LIFE_ENTRY_TAGS.map((tag) => {
                const active = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={[
                      'px-3 py-1 rounded-full text-sm border',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300',
                    ].join(' ')}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="entry-title">
              标题（可选）
            </label>
            <input
              id="entry-title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.title}
              maxLength={80}
              onChange={(e) => setField('title', e.target.value)}
            />
            <p className="text-xs text-slate-500 text-right">
              {titleCount}/{LIFE_ENTRY_TITLE_MAX}
            </p>
          </section>

          <section className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="entry-body">
              正文
            </label>
            <textarea
              id="entry-body"
              className="w-full min-h-[140px] rounded-lg border border-slate-300 px-3 py-2"
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
            />
            <p
              className={[
                'text-xs text-right',
                bodyCount > LIFE_ENTRY_BODY_MAX ? 'text-red-600' : 'text-slate-500',
              ].join(' ')}
            >
              {bodyCount}/{LIFE_ENTRY_BODY_MAX}
            </p>
          </section>

          <EntryMediaUpload
            entryId={entry?.id}
            mediaBundleType={mediaBundleType}
            mediaItems={mediaItems}
            onBundleTypeChange={setMediaBundleType}
            onMediaItemsChange={setMediaItems}
            disabled={saving}
          />

          <EntryDriveFields
            shareUrl={form.googleDriveShareUrl}
            displayLabel={form.googleDriveDisplayLabel}
            onShareUrlChange={(v) => setField('googleDriveShareUrl', v)}
            onDisplayLabelChange={(v) => setField('googleDriveDisplayLabel', v)}
            disabled={saving}
          />

          <EntryLocationFields
            enabled={form.locationEnabled}
            placeName={form.locationPlaceName}
            mapsUrl={form.locationMapsUrl}
            latitude={form.latitude}
            longitude={form.longitude}
            captureMethod={form.locationCaptureMethod}
            publicLabelPreview={form.locationPublicLabelPreview}
            onEnabledChange={(v) => setField('locationEnabled', v)}
            onPlaceNameChange={(v) => setField('locationPlaceName', v)}
            onMapsUrlChange={(v) => setField('locationMapsUrl', v)}
            onLatitudeChange={(v) => setField('latitude', v)}
            onLongitudeChange={(v) => setField('longitude', v)}
            onCaptureMethodChange={(v) => setField('locationCaptureMethod', v)}
            onPublicLabelPreviewChange={(v) => setField('locationPublicLabelPreview', v)}
            disabled={saving}
          />

          <EntryPermissionFields
            visibility={form.visibility}
            granteeId={form.granteeId}
            onVisibilityChange={(v) => setField('visibility', v)}
            onGranteeChange={(v) => setField('granteeId', v)}
            disabled={saving}
          />

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.isPinned}
              disabled={saving}
              onChange={(e) => setField('isPinned', e.target.checked)}
            />
            <span>置顶：在时间轴顶部优先展示（仍遵守本条权限；访客仅能看到已发布且有权查看的置顶内容）</span>
          </label>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.complianceAck}
              onChange={(e) => setField('complianceAck', e.target.checked)}
            />
            <span>我确认本条不含血腥、暴力等违规内容，并同意用户协议中的内容规范。</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            className="flex-1 min-w-[120px] rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => handleSubmit('draft')}
          >
            {saving ? '保存中…' : '存草稿'}
          </button>
          <button
            type="button"
            disabled={saving}
            className="flex-1 min-w-[120px] rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
            onClick={() => handleSubmit('published')}
          >
            {saving ? '提交中…' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}
