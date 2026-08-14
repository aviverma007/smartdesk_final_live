import axios from 'axios';

// Resolve the API base at runtime so the same build works whether it's
// opened via localhost during dev or via swdsales.com in production —
// mirrors the multi-system network access fix used on the ITSM dashboard.
function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_BASE;
  if (envBase && !envBase.includes('localhost')) return envBase;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.hostname}:5094/api`;
  }
  return envBase || 'http://localhost:5094/api';
}

export const API_BASE = resolveApiBase();

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('mc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means the token is missing/expired — clear it and force back to
// the login screen rather than letting every call downstream fail
// silently one by one.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('mc_token');
      localStorage.removeItem('mc_user');
      if (typeof window !== 'undefined') window.location.reload();
    }
    return Promise.reject(err);
  },
);

export default client;
