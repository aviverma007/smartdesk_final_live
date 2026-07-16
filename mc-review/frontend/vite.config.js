import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 94,
    host: true,
    allowedHosts: ['swdsales.com', 'localhost'],
  },
  preview: {
    port: 94,
    host: true,
    allowedHosts: ['swdsales.com', 'localhost'],
  },
});
