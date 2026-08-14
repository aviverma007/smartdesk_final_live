import { useState } from 'react';
import AppBar from './components/AppBar';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';
import AdminUsers from './pages/AdminUsers';
import LoginPage from './pages/LoginPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import { useApp } from './context/AppContext';

export default function App() {
  const [page, setPage] = useState(1);
  const { user, authLoading, role, isAdmin } = useApp();

  if (authLoading) {
    return <div className="authloading">Loading…</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.mustChangePassword) {
    // Blocks the whole app until a real password is set — no dismiss.
    return (
      <>
        <AppBar page={page} setPage={setPage} />
        <ChangePasswordModal forced />
      </>
    );
  }

  // Users: P1/P4 interactive, P2 view-only, P3 no access (Workflow v2.5 §1.3).
  const effectivePage = role === 'user' && page === 3 ? 1 : page;
  const adminPage = isAdmin && page === 5;

  return (
    <div>
      <AppBar page={effectivePage} setPage={setPage} />
      {adminPage && <AdminUsers />}
      {!adminPage && effectivePage === 1 && <Page1 />}
      {!adminPage && effectivePage === 2 && <Page2 />}
      {!adminPage && effectivePage === 3 && role !== 'user' && <Page3 />}
      {!adminPage && effectivePage === 4 && <Page4 />}
    </div>
  );
}
