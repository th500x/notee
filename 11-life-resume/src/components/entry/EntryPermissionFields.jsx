import { normalizeAccountId, validateAccountIdFormat } from '@/utils/authUtils';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '隐私' },
  { value: 'specific', label: '特定用户' },
];

export default function EntryPermissionFields({
  visibility,
  granteeId,
  onVisibilityChange,
  onGranteeChange,
  disabled = false,
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">本条权限</p>
      <div className="flex flex-wrap gap-2">
        {VISIBILITY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={[
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer',
              visibility === opt.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                : 'border-slate-200 text-slate-700',
              disabled ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <input
              type="radio"
              name="entry-visibility"
              className="sr-only"
              checked={visibility === opt.value}
              disabled={disabled}
              onChange={() => onVisibilityChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {visibility === 'specific' && (
        <div>
          <label className="block text-sm text-slate-600 mb-1" htmlFor="entry-grantee">
            可见对象 ID（4 位）
          </label>
          <input
            id="entry-grantee"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest"
            maxLength={4}
            value={granteeId}
            disabled={disabled}
            onChange={(e) => onGranteeChange(e.target.value.toUpperCase())}
            onBlur={() => {
              if (granteeId && !validateAccountIdFormat(normalizeAccountId(granteeId))) {
                onGranteeChange(granteeId);
              }
            }}
          />
          {granteeId && !validateAccountIdFormat(normalizeAccountId(granteeId)) && (
            <p className="text-sm text-red-600 mt-1">ID 格式：首位 0–9，后三位 A–Z 或 0–9</p>
          )}
        </div>
      )}
    </div>
  );
}

export { VISIBILITY_OPTIONS };
