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
  const role = localStorage.getItem('mc_role') || 'user';
  const userId = localStorage.getItem('mc_user_id') || 'dhruv';
  config.headers['x-user-role'] = role;
  config.headers['x-user-id'] = userId;
  return config;
});

export default client;
