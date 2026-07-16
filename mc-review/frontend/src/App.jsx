import { useState } from 'react';
import AppBar from './components/AppBar';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import Page4 from './pages/Page4';
import { useApp } from './context/AppContext';

export default function App() {
  const [page, setPage] = useState(1);
  const { role } = useApp();

  // Users: P1/P4 interactive, P2 view-only, P3 no access (Workflow v2.5 §1.3).
  const effectivePage = role === 'user' && page === 3 ? 1 : page;

  return (
    <div>
      <AppBar page={effectivePage} setPage={setPage} />
      {effectivePage === 1 && <Page1 />}
      {effectivePage === 2 && <Page2 />}
      {effectivePage === 3 && role !== 'user' && <Page3 />}
      {effectivePage === 4 && <Page4 />}
    </div>
  );
}
