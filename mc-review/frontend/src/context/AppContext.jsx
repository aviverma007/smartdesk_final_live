import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';

const AppCtx = createContext(null);

const ROLE_USER_ID = {
  user: 'dhruv',
  revMEP: 'rverma',
  revCIV: 'sanand',
  admin: 'akhilesh',
};

const ROLE_LABEL = {
  user: 'User (Dhruv)',
  revMEP: 'Reviewer — MEP (R. Verma)',
  revCIV: 'Reviewer — Civil (S. Anand)',
  admin: 'Admin (Akhilesh)',
};

export function AppProvider({ children }) {
  const [role, setRoleState] = useState(localStorage.getItem('mc_role') || 'user');
  const [reference, setReference] = useState(null);

  const setRole = useCallback((newRole) => {
    localStorage.setItem('mc_role', newRole);
    localStorage.setItem('mc_user_id', ROLE_USER_ID[newRole]);
    setRoleState(newRole);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('mc_user_id')) {
      localStorage.setItem('mc_user_id', ROLE_USER_ID[role]);
    }
    api.reference().then(setReference).catch(() => {});
  }, []);

  const value = {
    role, setRole, roleLabel: ROLE_LABEL[role], ROLE_LABEL,
    reference,
    isReviewerish: role !== 'user',
    reviewerIndex: role === 'revMEP' ? 'MEP' : role === 'revCIV' ? 'CIVIL' : null,
    isAdmin: role === 'admin',
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
