import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// ── Password logic: Smart@ + reverse of empId ─────────────────────────────
export const makePassword = (empId) => `Smart@${String(empId).split('').reverse().join('')}`;

// ── Admin credentials ─────────────────────────────────────────────────────
const ADMIN_ID = 'admin';
const ADMIN_PW = 'SmartWorld@2026';

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => { initializeAuth(); }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('sd-user', JSON.stringify(userData));
  };

  // ── Try login with empId + password ──────────────────────────────────────
  const tryLogin = (empId, password) => {
    const id = String(empId).trim();
    const pw = String(password).trim();

    // Admin
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      login({ name:'Admin User', role:'admin', empId:'admin', loginTime:new Date().toISOString() });
      return { success:true };
    }

    // Dashboard-only user
    if (id.toLowerCase() === 'dashboard' && pw === 'SmartWorld@2026') {
      login({ name:'Dashboard Viewer', role:'dashboard', empId:'dashboard', loginTime:new Date().toISOString() });
      return { success:true };
    }

    // Employee: password = Smart@ + reverse(empId)
    const expected = makePassword(id);
    if (pw === expected) {
      login({ name:`Employee ${id}`, role:'employee', empId:id, loginTime:new Date().toISOString() });
      return { success:true };
    }

    return { success:false, error:'Invalid Employee ID or Password' };
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('sd-user');
  };

  const initializeAuth = () => {
    setShowLoading(true);
    setTimeout(() => {
      const saved = localStorage.getItem('sd-user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          setUser(u);
          setIsAuthenticated(true);
        } catch {}
      }
      setShowLoading(false);
    }, 2800);
  };

  const isAdmin     = user?.role === 'admin';
  const isEmployee  = user?.role === 'employee';
  const isDashboard = user?.role === 'dashboard';

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, showLoading, login, tryLogin, logout, initializeAuth, isAdmin, isEmployee, isDashboard }}>
      {children}
    </AuthContext.Provider>
  );
};
