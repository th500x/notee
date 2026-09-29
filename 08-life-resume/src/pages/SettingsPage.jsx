import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import { useLifeProfile } from '@/contexts/LifeProfileContext';
import { useToast } from '@/contexts/ToastContext';
import usePageMeta from '@/hooks/usePageMeta';
import {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  validateNewAccountPassword,
} from '@shared/utils/accountPasswordRules';
import { USERNAME_CHANGE_COOLDOWN_DAYS } from '@shared/utils/lifeResumeUsername.js';
import { REGION_REFRESH_DAYS } from '@shared/utils/lifeResumeProfileRegion.js';
import { normalizeAccountId, validateAccountIdFormat } from '@/utils/authUtils';
import { formatBirthDateLabel, validateBirthDate } from '@shared/utils/lifeResumeBirthday.js';
import BirthDateSelects from '@/components/auth/BirthDateSelects';
import { changeBirthday, changePassword } from '@/services/authApi';
import {
  cancelDeactivationProfileMe,
  deactivateProfileMe,
  deleteEntrySeries,
  fetchAuthMe,
  updateEntrySeries,
} from '@/services/lifeResumeApi';
import {
  CHRONOLOGICAL_ENTRY_SERIES_NAME,
  validateEntrySeriesName,
  ENTRY_SERIES_NAME_MAX_CJK,
} from '@shared/utils/lifeResumeEntrySeries.js';
import { formatLifeResumeError } from '@/utils/lifeResumeErrors';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开', hint: '新建条目默认对所有人可见' },
  { value: 'private', label: '隐私', hint: '新建条目默认仅自己可见' },
  { value: 'specific', label: '特定', hint: '新建条目默认仅对指定 ID 可见' },
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN');
}

export default function SettingsPage() {
  const { accountId } = useLifeAuth();
  const { profile, loading, error, updateProfile, refreshProfile } = useLifeProfile();
  const showToast = useToast();
  usePageMeta({ title: '设置 · 人生片段', robots: 'noindex, nofollow' });
  const [username, setUsername] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [granteeId, setGranteeId] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [birthdayInfo, setBirthdayInfo] = useState(null);
  const [birthdayLoading, setBirthdayLoading] = useState(true);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthdayMsg, setBirthdayMsg] = useState(null);
  const [birthdaySubmitting, setBirthdaySubmitting] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [defaultEntrySeriesId, setDefaultEntrySeriesId] = useState(null);
  const [renamingSeries, setRenamingSeries] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingSeries, setDeletingSeries] = useState(null);
  const [seriesActionError, setSeriesActionError] = useState('');
  const [seriesActionLoading, setSeriesActionLoading] = useState(false);

  const isDeactivated = profile?.profileStatus === 'deactivated';
  const entrySeriesOptions = profile?.entrySeries?.switcher || [];
  const customSeries = profile?.entrySeries?.custom || [];

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || '');
    setVisibility(profile.pageDefaultVisibility || 'public');
    setGranteeId(profile.defaultGranteeAccountId || '');
    setDefaultEntrySeriesId(profile.defaultEntrySeriesId ?? null);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBirthdayLoading(true);
      try {
        const res = await fetchAuthMe();
        const data = res?.data || {};
        if (cancelled) return;
        setBirthdayInfo(data);
        setBirthYear(data.birthYear != null ? String(data.birthYear) : '');
        setBirthMonth(data.birthMonth != null ? String(data.birthMonth) : '');
        setBirthDay(data.birthDay != null ? String(data.birthDay) : '');
      } catch {
        if (!cancelled) setBirthdayInfo(null);
      } finally {
        if (!cancelled) setBirthdayLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isDeactivated) return;
    setSaveError('');

    if (visibility === 'specific') {
      const grantee = normalizeAccountId(granteeId);
      if (!grantee || !validateAccountIdFormat(grantee)) {
        setSaveError('特定可见须填写有效的 4 位 ID');
        return;
      }
    }

    setSaving(true);
    try {
      await updateProfile({
        username: username.trim(),
        pageDefaultVisibility: visibility,
        defaultGranteeAccountId: visibility === 'specific' ? normalizeAccountId(granteeId) : null,
        defaultEntrySeriesId,
      });
      showToast('已保存', { type: 'success' });
    } catch (err) {
      const message = formatLifeResumeError(err);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivateError('');
    setDeactivating(true);
    try {
      await deactivateProfileMe();
      await refreshProfile();
      setDeactivateOpen(false);
      showToast('已申请注销，公开页暂不可访问', { type: 'info' });
    } catch (err) {
      setDeactivateError(formatLifeResumeError(err));
    } finally {
      setDeactivating(false);
    }
  };

  const handleChangeBirthday = async (event) => {
    event.preventDefault();
    setBirthdayMsg(null);
    const validation = validateBirthDate({ birthYear, birthMonth, birthDay });
    if (!validation.ok) {
      setBirthdayMsg({ type: 'error', text: validation.error });
      return;
    }
    setBirthdaySubmitting(true);
    try {
      const result = await changeBirthday({
        birthYear: validation.birthYear,
        birthMonth: validation.birthMonth,
        birthDay: validation.birthDay,
      });
      if (result.success) {
        const next = result.data || {};
        setBirthdayInfo(next);
        setBirthYear(next.birthYear != null ? String(next.birthYear) : '');
        setBirthMonth(next.birthMonth != null ? String(next.birthMonth) : '');
        setBirthDay(next.birthDay != null ? String(next.birthDay) : '');
        setBirthdayMsg({ type: 'success', text: result.message || '生日已更新' });
        showToast(result.message || '生日已更新', { type: 'success' });
      } else {
        setBirthdayMsg({ type: 'error', text: result.error || '修改生日失败' });
      }
    } catch {
      setBirthdayMsg({ type: 'error', text: '修改生日失败，请稍后重试' });
    } finally {
      setBirthdaySubmitting(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordMsg(null);
    const validation = validateNewAccountPassword(newPassword, confirmPassword);
    if (!validation.ok) {
      setPasswordMsg({ type: 'error', text: validation.error });
      return;
    }
    setPasswordSubmitting(true);
    try {
      const result = await changePassword({
        password: newPassword,
        confirmPassword,
      });
      if (result.success) {
        setNewPassword('');
        setConfirmPassword('');
        setPasswordMsg({ type: 'success', text: result.message || '密码已更新' });
        showToast(result.message || '密码已更新', { type: 'success' });
      } else {
        setPasswordMsg({ type: 'error', text: result.error || '修改密码失败' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: '修改密码失败，请稍后重试' });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleCancelDeactivation = async () => {
    setDeactivateError('');
    setCancelling(true);
    try {
      await cancelDeactivationProfileMe();
      await refreshProfile();
      showToast('已撤销注销', { type: 'success' });
    } catch (err) {
      setDeactivateError(formatLifeResumeError(err));
    } finally {
      setCancelling(false);
    }
  };

  const handleRenameSeries = async () => {
    if (!renamingSeries) return;
    const nameCheck = validateEntrySeriesName(renameValue);
    if (!nameCheck.ok) {
      setSeriesActionError(nameCheck.error);
      return;
    }
    setSeriesActionError('');
    setSeriesActionLoading(true);
    try {
      await updateEntrySeries(renamingSeries.id, nameCheck.name);
      setRenamingSeries(null);
      setRenameValue('');
      await refreshProfile();
      showToast('系列已改名', { type: 'success' });
    } catch (err) {
      setSeriesActionError(formatLifeResumeError(err));
    } finally {
      setSeriesActionLoading(false);
    }
  };

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return;
    setSeriesActionError('');
    setSeriesActionLoading(true);
    try {
      await deleteEntrySeries(deletingSeries.id);
      setDeletingSeries(null);
      await refreshProfile();
      showToast('系列已删除', { type: 'success' });
    } catch (err) {
      setSeriesActionError(formatLifeResumeError(err));
    } finally {
      setSeriesActionLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center text-slate-500">
        正在加载资料…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">设置</h1>
        <p className="text-sm text-slate-600 mt-1">
          公开页链接固定为{' '}
          <Link to={`/u/${accountId}`} className="font-mono text-indigo-600 hover:underline">
            /u/{accountId}
          </Link>
          ，改名不会变链接。
        </p>
      </div>

      {isDeactivated && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 space-y-3">
          <p>
            你的片段已申请注销，公开页暂不可访问。
            {profile?.purgeScheduledAt && (
              <>
                {' '}
                若无撤销，将于 <strong>{formatDate(profile.purgeScheduledAt)}</strong> 永久清除数据。
              </>
            )}
          </p>
          <button
            type="button"
            disabled={cancelling}
            className="rounded-lg bg-amber-800 text-white px-4 py-2 hover:bg-amber-900 disabled:opacity-60"
            onClick={handleCancelDeactivation}
          >
            {cancelling ? '处理中…' : '撤销注销'}
          </button>
        </div>
      )}

      {(error || saveError || deactivateError) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deactivateError || saveError || error}
          {error && (
            <button
              type="button"
              className="ml-3 text-red-800 underline"
              onClick={() => refreshProfile()}
            >
              重试
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">用户名</h2>
          <p className="text-sm text-slate-600">
            纯中文 1–4 字，或纯英文 1–16 字母（可在末尾加一个国旗 emoji，如 CHRIS🇹🇭）；禁止中英混排、数字与其它符号。
            昵称可与他人重复；对外展示时会自动附上 IP 识别的地区（见下方）。
          </p>
          {profile?.isDefaultUsername && !isDeactivated && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              当前为系统默认昵称，建议改成你想展示的名字。
            </p>
          )}
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={16}
            disabled={
              isDeactivated || (profile && profile.usernameChangeAllowed === false)
            }
          />
          {profile && profile.usernameChangeAllowed === false && !isDeactivated && (
            <p className="text-sm text-slate-500">
              用户名每 {USERNAME_CHANGE_COOLDOWN_DAYS} 天可改一次，下次可改日期：
              {formatDate(profile.usernameChangeAvailableAt) || '—'}
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-slate-900">展示地区</h2>
          <p className="text-sm text-slate-600">
            根据当前网络 IP 自动识别，格式为「国家·省/府」，拼在昵称后面（如 chris · 美国·纽约）。
            登录后约每 {REGION_REFRESH_DAYS} 天静默更新一次；解析失败时保留上次结果或仅显示昵称。
          </p>
          <p className="text-sm text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            {profile?.regionPublicLabel ? profile.regionPublicLabel : '暂未识别到地区（本地开发或解析失败时常见）'}
          </p>
          {profile?.regionUpdatedAt && (
            <p className="text-xs text-slate-500">
              上次更新：{formatDate(profile.regionUpdatedAt)}
            </p>
          )}
          {profile?.displayName && (
            <p className="text-xs text-slate-500">
              对外展示名预览：<span className="font-medium text-slate-700">{profile.displayName}</span>
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">主页默认系列</h2>
          <p className="text-sm text-slate-600">
            访客打开你的公开页时，默认展示哪个系列；访客仍可自行切换。
          </p>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
            value={defaultEntrySeriesId == null ? '' : String(defaultEntrySeriesId)}
            disabled={isDeactivated}
            onChange={(e) => {
              const v = e.target.value;
              setDefaultEntrySeriesId(v === '' ? null : Number(v));
            }}
          >
            {entrySeriesOptions.map((series) => (
              <option key={series.key} value={series.id == null ? '' : String(series.id)}>
                {series.name}
              </option>
            ))}
          </select>
        </section>

        {customSeries.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">自定义系列管理</h2>
            <p className="text-sm text-slate-600">
              内置「{CHRONOLOGICAL_ENTRY_SERIES_NAME}」不可改名或删除。删除自定义系列将
              <strong className="text-red-700"> 永久删除 </strong>
              该系列下的全部片段与媒体。
            </p>
            <ul className="space-y-3">
              {customSeries.map((series) => (
                <li
                  key={series.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">
                    {series.name}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {series.entryCount ?? 0} 条片段
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isDeactivated}
                      className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
                      onClick={() => {
                        setSeriesActionError('');
                        setRenamingSeries(series);
                        setRenameValue(series.name);
                      }}
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      disabled={isDeactivated}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      onClick={() => {
                        setSeriesActionError('');
                        setDeletingSeries(series);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">新建条目默认权限</h2>
          <p className="text-sm text-slate-600">只影响之后新建的片段，不会改已有条目。</p>
          <div className="space-y-3">
            {VISIBILITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  'flex items-start gap-3',
                  isDeactivated ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="visibility"
                  className="mt-1"
                  checked={visibility === opt.value}
                  disabled={isDeactivated}
                  onChange={() => setVisibility(opt.value)}
                />
                <span>
                  <span className="font-medium text-slate-800">{opt.label}</span>
                  <span className="block text-sm text-slate-500">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {visibility === 'specific' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="grantee-id">
                默认可见对象 ID
              </label>
              <input
                id="grantee-id"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest disabled:bg-slate-50"
                maxLength={4}
                value={granteeId}
                disabled={isDeactivated}
                onChange={(e) => setGranteeId(e.target.value.toUpperCase())}
              />
            </div>
          )}
        </section>

        {!isDeactivated && (
          <button
            type="submit"
            disabled={saving || !profile}
            className="w-full rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        )}
      </form>

      <section className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">账号</h2>
        <p className="text-sm text-slate-600">
          登录 ID：<span className="font-mono font-semibold text-slate-800">{accountId}</span>
        </p>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-slate-800">生日</p>
          {birthdayLoading ? (
            <p className="text-sm text-slate-500">正在加载…</p>
          ) : birthdayInfo?.canChangeBirthday ? (
            <form onSubmit={handleChangeBirthday} className="space-y-3">
              <p className="text-sm text-slate-600">
                当前：{formatBirthDateLabel(birthdayInfo)}。可改正一次，保存后不可再改。
              </p>
              <BirthDateSelects
                idPrefix="settings-birth"
                year={birthYear}
                month={birthMonth}
                day={birthDay}
                disabled={birthdaySubmitting}
                onChange={({ year, month, day }) => {
                  setBirthYear(year);
                  setBirthMonth(month);
                  setBirthDay(day);
                  if (birthdayMsg) setBirthdayMsg(null);
                }}
              />
              {birthdayMsg && (
                <p
                  className={`text-sm ${
                    birthdayMsg.type === 'success' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                  role="status"
                >
                  {birthdayMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={birthdaySubmitting}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 py-2 text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-60"
              >
                {birthdaySubmitting ? '保存中…' : '保存生日'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              {formatBirthDateLabel(birthdayInfo || {})}
              {birthdayInfo?.birthdayChangedAt ? '。已改正过，不可再改。' : ''}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          {!passwordFormOpen ? (
            <button
              type="button"
              onClick={() => {
                setPasswordFormOpen(true);
                setPasswordMsg(null);
              }}
              className="w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 py-2 text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              修改密码
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <p className="text-sm font-medium text-slate-800">修改密码</p>
              <p className="text-xs text-slate-500">
                新密码至少 {ACCOUNT_PASSWORD_MIN_LENGTH} 位，无需验证旧密码
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (passwordMsg) setPasswordMsg(null);
                }}
                autoComplete="new-password"
                placeholder="新密码"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (passwordMsg) setPasswordMsg(null);
                }}
                autoComplete="new-password"
                placeholder="确认新密码"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              {passwordMsg && (
                <p
                  className={`text-sm ${
                    passwordMsg.type === 'success' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                  role="status"
                >
                  {passwordMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={passwordSubmitting}
                  onClick={() => {
                    setPasswordFormOpen(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordMsg(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="flex-1 rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  {passwordSubmitting ? '提交中…' : '保存密码'}
                </button>
              </div>
            </form>
          )}
        </div>

        {!isDeactivated ? (
          <>
            <p className="text-sm text-slate-500 border-t border-slate-100 pt-4">
              申请注销后，公开页立即不可见；30 天内可在此撤销，期满将永久删除片段与媒体（登录账号保留）。
            </p>
            <button
              type="button"
              className="rounded-lg border border-red-200 text-red-700 px-4 py-2 text-sm hover:bg-red-50"
              onClick={() => {
                setDeactivateError('');
                setDeactivateOpen(true);
              }}
            >
              申请注销片段
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500 border-t border-slate-100 pt-4">
            注销冷静期中，无法修改用户名与默认权限。
          </p>
        )}
      </section>

      {deactivateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="关闭"
            onClick={() => !deactivating && setDeactivateOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">确认申请注销？</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              公开页将立即不可访问。30 天内你可以在此撤销；若未撤销，系统将永久删除全部片段与 OSS
              媒体。你的登录 ID 不会被删除。
            </p>
            {deactivateError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deactivateError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deactivating}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setDeactivateOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={deactivating}
                className="flex-1 rounded-lg bg-red-600 text-white py-2.5 hover:bg-red-700 disabled:opacity-60"
                onClick={handleDeactivate}
              >
                {deactivating ? '提交中…' : '确认注销'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="关闭"
            onClick={() => !seriesActionLoading && setRenamingSeries(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">改名系列</h3>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={renameValue}
              maxLength={ENTRY_SERIES_NAME_MAX_CJK}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            {seriesActionError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{seriesActionError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={seriesActionLoading}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setRenamingSeries(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={seriesActionLoading || !renameValue.trim()}
                className="flex-1 rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
                onClick={handleRenameSeries}
              >
                {seriesActionLoading ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="关闭"
            onClick={() => !seriesActionLoading && setDeletingSeries(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">删除系列「{deletingSeries.name}」？</h3>
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-3 leading-relaxed">
              将<strong>永久删除</strong>该系列下的全部 {deletingSeries.entryCount ?? 0}{' '}
              条片段及所有关联媒体，无法恢复。请确认后继续。
            </p>
            {seriesActionError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{seriesActionError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={seriesActionLoading}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setDeletingSeries(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={seriesActionLoading}
                className="flex-1 rounded-lg bg-red-600 text-white py-2.5 hover:bg-red-700 disabled:opacity-60"
                onClick={handleDeleteSeries}
              >
                {seriesActionLoading ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
