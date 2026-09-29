import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { appConfig } from '@/config/appConfig';
import { LifeAuthProvider } from '@/contexts/LifeAuthContext';
import { LifeProfileProvider } from '@/contexts/LifeProfileContext';
import { ToastProvider } from '@/contexts/ToastContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import TimelinePage from '@/pages/TimelinePage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <LifeAuthProvider>
      <LifeProfileProvider>
        <ToastProvider>
        <BrowserRouter basename={appConfig.routerBasename}>
        <div className="min-h-screen flex flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/u/:accountId" element={<TimelinePage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <SiteFooter />
        </div>
      </BrowserRouter>
        </ToastProvider>
      </LifeProfileProvider>
    </LifeAuthProvider>
  );
}
