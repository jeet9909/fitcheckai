import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import LandingHeader from './LandingHeader';
import MobileNav from './MobileNav';
import Toast from './Toast';

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {isLanding ? <LandingHeader /> : <AppHeader />}
      <Outlet />
      <MobileNav />
      <Toast />
    </div>
  );
}
