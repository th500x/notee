import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import usePageMeta from '@/hooks/usePageMeta';
import { normalizeAccountId, validateAccountIdFormat } from '@/utils/authUtils';

export default function LoginPage() {
  usePageMeta({ title: '登录 · 人生片段', robots: 'noindex, nofollow' });
  const navigate = useNavigate();
  const { login } = useLifeAuth();
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const id = normalizeAccountId(accountId);
    if (!id || !password) {
      setError('请输入 ID 和密码');
      return;
    }
    if (!validateAccountIdFormat(id)) {
      setError('ID 格式错误：首位 0–9，后三位 A–Z 或 0–9');
      return;
    }
    setLoading(true);
    const result = await login(id, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || '登录失败');
      return;
    }
    navigate(`/u/${id}`, { replace: true });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">登录</h1>
        <p className="text-sm text-slate-600 mb-6">使用与「真三风云」相同的 4 位 ID 与密码。</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="login-id">
              账号 ID
            </label>
            <input
              id="login-id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest"
              maxLength={4}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value.toUpperCase())}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="login-password">
              密码
            </label>
            <input
              id="login-password"
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600 text-center">
          还没有账号？{' '}
          <Link to="/register" className="text-indigo-600 hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
