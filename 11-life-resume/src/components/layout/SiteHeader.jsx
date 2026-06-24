import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useLifeAuth } from '@/contexts/LifeAuthContext';

const navLinkClass = ({ isActive }) =>
  [
    'px-3 py-1.5 rounded-md text-sm transition-colors',
    isActive ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100',
  ].join(' ');

export default function SiteHeader() {
  const navigate = useNavigate();
  const { isLoggedIn, accountId, bootstrapping, logout } = useLifeAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-800 shrink-0">
            Notee
          </a>
          <span className="text-slate-300">/</span>
          <Link to="/" className="font-semibold text-slate-900 truncate">
            人生片段
          </Link>
        </div>
        <nav className="flex items-center gap-1 shrink-0">
          <NavLink to="/" className={navLinkClass} end>
            首页
          </NavLink>
          {bootstrapping ? (
            <span className="text-sm text-slate-400 px-2">…</span>
          ) : isLoggedIn && accountId ? (
            <>
              <NavLink to={`/u/${accountId}`} className={navLinkClass}>
                我的
              </NavLink>
              <NavLink to="/settings" className={navLinkClass}>
                设置
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100"
              >
                退出
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navLinkClass}>
              登录
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
