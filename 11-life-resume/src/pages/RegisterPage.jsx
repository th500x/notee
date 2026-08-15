import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateNewAccountPassword } from '@shared/utils/accountPasswordRules';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import usePageMeta from '@/hooks/usePageMeta';
import { getRegisterCandidates } from '@/services/authApi';
import {
  generateIdOptions,
  getMachineFingerprint,
  isRegisterIdUnavailableError,
  rememberRegisteredId,
} from '@/utils/authUtils';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CANDIDATE_COUNT = 5;

export default function RegisterPage() {
  usePageMeta({ title: '注册 · 人生片段', robots: 'noindex, nofollow' });
  const navigate = useNavigate();
  const { register } = useLifeAuth();
  const [candidateIds, setCandidateIds] = useState([]);
  const [idPoolSource, setIdPoolSource] = useState('server');
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idsLoading, setIdsLoading] = useState(true);

  const loadCandidates = useCallback(async (excludeIds = []) => {
    setIdsLoading(true);
    setError('');
    const remote = await getRegisterCandidates(CANDIDATE_COUNT, excludeIds);
    if (remote.success && remote.data?.ids?.length) {
      setCandidateIds(remote.data.ids);
      setIdPoolSource('server');
      setIdsLoading(false);
      return;
    }
    const fallback = generateIdOptions(excludeIds);
    setCandidateIds(fallback.ids);
    setIdPoolSource('local');
    setIdsLoading(false);
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleRefreshIds = async () => {
    await loadCandidates(candidateIds);
    setSelectedId('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedId) {
      setError('请选择一个 ID');
      return;
    }
    const pwdCheck = validateNewAccountPassword(password, confirmPassword);
    if (!pwdCheck.ok) {
      setError(pwdCheck.error);
      return;
    }
    if (!birthMonth) {
      setError('请选择生日月份');
      return;
    }
    if (!agreed) {
      setError('请先阅读并同意用户协议');
      return;
    }

    setLoading(true);
    const result = await register({
      id: selectedId,
      password,
      birthMonth: parseInt(birthMonth, 10),
      machineId: getMachineFingerprint(),
    });
    setLoading(false);

    if (!result.success) {
      const message = result.error || '注册失败';
      setError(message);
      if (isRegisterIdUnavailableError(message)) {
        await loadCandidates([...candidateIds, selectedId]);
        setSelectedId('');
      }
      return;
    }

    rememberRegisteredId(selectedId);
    navigate(`/u/${selectedId}`, { replace: true });
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">注册</h1>
        <p className="text-sm text-slate-600 mb-6">
          注册后可在人生片段与真三风云共用同一 ID；进入游戏前再选区服即可。
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">选择你的 ID</p>
            {idsLoading ? (
              <p className="text-sm text-slate-500">正在获取候选 ID…</p>
            ) : candidateIds.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-600 mb-3">暂无可选 ID，请稍后重试或检查人生片段后端</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  刷新页面
                </button>
              </div>
            ) : (
              <>
                {idPoolSource === 'server' && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 mb-3">
                    候选已与服务器同步（当前批次从 0 起顺序分配，已排除已注册 ID）
                  </p>
                )}
                {idPoolSource === 'local' && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-3">
                    当前为离线候选；若注册失败，请刷新或确认 05 后端已启动后重试
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {candidateIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedId(id);
                        setError('');
                      }}
                      className={[
                        'px-3 py-2 rounded-lg border font-mono tracking-widest text-left',
                        selectedId === id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                          : 'border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50',
                      ].join(' ')}
                    >
                      <span className="text-indigo-600 font-bold">{id[0]}</span>
                      <span>{id.slice(1)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={idsLoading}
                  onClick={handleRefreshIds}
                  className="w-full py-2 px-4 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-sm disabled:opacity-50"
                >
                  换一批 ID
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="reg-password">
                密码
              </label>
              <input
                id="reg-password"
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="reg-password2">
                确认密码
              </label>
              <input
                id="reg-password2"
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="reg-month">
              生日月份
            </label>
            <select
              id="reg-month"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
            >
              <option value="">请选择</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="mt-1"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>我已阅读并同意 notee 用户协议与内容规范（禁止血腥暴力等违规内容）。</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || idsLoading || candidateIds.length === 0}
            className="w-full rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? '注册中…' : '注册并登录'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600 text-center">
          已有账号？{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
