/**
 * Single source of truth for the portal's tabs and who sees them by default.
 * Admins can override the tabs for any employee code in Access Control
 * (stored server-side in dbo.TabAccess via backend-userrights).
 */
export const TABS = [
  { id: 'home',             label: 'Home',               desc: 'Banner, quick links, new joinees, to-do' },
  { id: 'directory',        label: 'Employee Directory', desc: 'Search employees and contact details' },
  { id: 'attendance',       label: 'Live Attendance',    desc: 'Punch in/out and sites (employees see only their own)' },
  { id: 'policies',         label: 'Policies',           desc: 'HR, Admin and IT policy PDFs' },
  { id: 'holiday-calendar', label: 'Holiday Calendar',   desc: 'Company holidays' },
  { id: 'dashboard',        label: 'Dashboard',          desc: 'SmartDB and Power BI reports' },
  { id: 'tools',            label: 'Tools',              desc: 'Converter, PDF / image / Excel tools, QR, calculators' },
];

/** Admin-only tabs: always visible to admins, never grantable to others. */
export const ADMIN_TABS = [
  { id: 'access-control', label: 'Access Control', desc: 'Choose which tabs each employee can see' },
];

export const TAB_IDS = TABS.map(t => t.id);

const ROLE_DEFAULTS = {
  dashboard: ['dashboard'],
  employee:  ['home', 'directory', 'attendance', 'policies', 'holiday-calendar', 'tools'],
  hr:        ['home', 'directory', 'attendance', 'policies', 'holiday-calendar', 'tools'],
  it:        ['home', 'directory', 'tools'],
  manager:   ['home', 'directory', 'tools'],
};

/** Tabs a role sees when no custom access has been set. */
export const defaultTabsFor = (role) => (role === 'admin' ? [...TAB_IDS] : (ROLE_DEFAULTS[role] || ROLE_DEFAULTS.employee));

/** Fixed (shared) logins that can also be given custom access. */
export const FIXED_ACCOUNTS = [
  { id: 'hr', name: 'HR Team (shared login)', role: 'hr' },
  { id: 'it', name: 'IT Team (shared login)', role: 'it' },
  { id: 'manager', name: 'Manager (shared login)', role: 'manager' },
  { id: 'dashboard', name: 'Dashboard viewer (shared login)', role: 'dashboard' },
];

export const roleForId = (id) => (FIXED_ACCOUNTS.find(a => a.id === String(id).toLowerCase())?.role || 'employee');

/** Keep only known tab ids, in display order. */
export const cleanTabs = (list) => TAB_IDS.filter(id => (list || []).includes(id));
