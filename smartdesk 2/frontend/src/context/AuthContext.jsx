import React, { createContext, useContext, useState, useEffect } from 'react';
import { employeeAPI } from '../services/api';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// ── Password logic: Smart@ + reverse of empId ─────────────────────────────
export const makePassword = (empId) => `Smart@${String(empId).split('').reverse().join('')}`;

// ── Admin credentials ─────────────────────────────────────────────────────
const ADMIN_ID = 'admin';
const ADMIN_PW = 'SmartWorld@2026';

// ── Workflow role logins (User Rights & Assets module) ────────────────────
// Change these passwords as needed.
const ROLE_LOGINS = {
  hr:          { pw: 'SmartWorld@2026', name: 'HR Team',     role: 'hr' },
  it:          { pw: 'SmartWorld@2026', name: 'IT Team',     role: 'it' },
  manager:     { pw: 'SmartWorld@2026', name: 'Manager',     role: 'manager' },
  hod:         { pw: 'SmartWorld@2026', name: 'HOD',         role: 'hod' },
  interviewer: { pw: 'SmartWorld@2026', name: 'Interviewer', role: 'interviewer' },
};

// User Rights & Assets backend (same host, port 5093)
export const URA_API = `http://${window.location.hostname}:5093/api`;

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

    // Workflow roles: hr / it / manager
    const rl = ROLE_LOGINS[id.toLowerCase()];
    if (rl && pw === rl.pw) {
      login({ name: rl.name, role: rl.role, empId: id.toLowerCase(), loginTime: new Date().toISOString() });
      return { success: true };
    }

    // Employees are NOT handled here — they must be validated against the
    // directory (see tryEmployeeLogin). This prevents made-up IDs logging in.
    return { success:false, error:'Invalid Employee ID or Password', notFixedAccount:true };
  };

  // Is this Employee ID a real person in the directory?
  // Sources: the Excel employee directory + onboarded/managed employees
  // (the /onboarding/directory feed already excludes soft-deleted people).
  const isDirectoryEmployee = async (id) => {
    const want = String(id).trim();
    let deleted = [], inManaged = false;
    try {
      const res = await fetch(`${URA_API}/onboarding/directory`);
      const data = await res.json();
      if (data.success) {
        deleted = (data.deleted || []).map(x => String(x).trim());
        if ((data.records || []).some(e => String(e.EmpId).trim() === want)) inManaged = true;
      }
    } catch (_) {}
    if (deleted.includes(want)) return false; // explicitly removed from the directory
    if (inManaged) return true;
    try {
      const list = await employeeAPI.getAll();
      if (Array.isArray(list) && list.some(e => String(e.id).trim() === want)) return true;
    } catch (_) {}
    return false;
  };

  // Employee login: only for IDs that exist in the directory, with the
  // formula password (Smart@ + reversed ID).
  const tryEmployeeLogin = async (empId, password) => {
    const id = String(empId).trim();
    const pw = String(password).trim();
    const exists = await isDirectoryEmployee(id);
    if (!exists) return { success: false, error: 'No employee with this ID exists in the directory.' };
    if (pw === makePassword(id)) {
      login({ name: `Employee ${id}`, role: 'employee', empId: id, loginTime: new Date().toISOString() });
      return { success: true };
    }
    return { success: false, error: 'Incorrect password for this Employee ID.' };
  };

  // Async fallback: log in with a password the employee set via the email link
  const tryAppLogin = async (id, password) => {
    try {
      const res = await fetch(`${URA_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(id).trim(), password: String(password) }),
      });
      const data = await res.json();
      if (data.success) {
        login({ name: `Employee ${data.user.empId || data.user.email}`, role: 'employee',
                empId: data.user.empId || data.user.email, loginTime: new Date().toISOString() });
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid credentials' };
    } catch (e) {
      return { success: false, error: 'Login service unavailable' };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('sd-user');
  };

  const initializeAuth = () => {
    setShowLoading(true);
    setTimeout(async () => {
      const saved = localStorage.getItem('sd-user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          // Re-verify a restored employee session: if the ID is no longer a real
          // directory employee (e.g. it was created under old/insecure logic, or
          // the person was removed), drop the session instead of trusting it.
          if (u.role === 'employee') {
            const ok = await isDirectoryEmployee(u.empId);
            if (!ok) { localStorage.removeItem('sd-user'); setShowLoading(false); return; }
          }
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
  const isHr        = user?.role === 'hr';
  const isIt        = user?.role === 'it';
  const isManager   = user?.role === 'manager';
  const isHod         = user?.role === 'hod';
  const isInterviewer = user?.role === 'interviewer';

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, showLoading, login, tryLogin, tryEmployeeLogin, tryAppLogin, logout, initializeAuth, isAdmin, isEmployee, isDashboard, isHr, isIt, isManager, isHod, isInterviewer }}>
      {children}
    </AuthContext.Provider>
  );
};
