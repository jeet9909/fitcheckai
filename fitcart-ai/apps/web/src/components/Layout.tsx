import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import LandingHeader from './LandingHeader';
import MobileNav from './MobileNav';
import Toast from './Toast';
import { useAppState } from '../state/AppState';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { ready } = useAppState();

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {isLanding ? <LandingHeader /> : <AppHeader />}
      {ready ? (
        <Outlet />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 28px', color: 'var(--ink-faint)', fontSize: 13 }}>
          Loading FitCart…
        </div>
      )}
      <MobileNav />
      <Toast />
    </div>
  );
}
