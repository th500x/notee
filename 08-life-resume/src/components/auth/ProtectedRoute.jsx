import { Navigate, useLocation } from 'react-router-dom';
import { useLifeAuth } from '@/contexts/LifeAuthContext';

export default function ProtectedRoute({ children }) {
  const { isLoggedIn, bootstrapping } = useLifeAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">
        正在验证登录…
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
