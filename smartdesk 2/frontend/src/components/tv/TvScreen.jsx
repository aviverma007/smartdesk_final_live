import React, { useEffect, useRef, useState } from 'react';
import TvPlayer, { useTvLive } from './TvPlayer';
import { fetchTvConfig, fetchTvVersion, defaultConfig } from './tvData';

/*
 * Full-screen page for office TVs: http://<portal>/?tv   (optional &site=Smart 66)
 * No login. Picks up HR's published changes within a minute, keeps playing from its
 * cached copy if the server is down, keeps the screen awake, hides the pointer and
 * reloads itself every night (03:00) so it never drifts.
 */
export default function TvScreen() {
  const site = new URLSearchParams(window.location.search).get('site') || '';
  const [config, setConfig] = useState(null);
  const versionRef = useRef(-1);
  const [hint, setHint] = useState(true);
  const [cursor, setCursor] = useState(true);

  // config + polling for new versions
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetchTvConfig();
      if (!alive) return;
      versionRef.current = r.version;
      setConfig(r.config || defaultConfig());
    };
    load();
    const t = setInterval(async () => {
      try { const v = await fetchTvVersion(); if (v !== versionRef.current) load(); } catch (_) { /* offline: keep playing */ }
    }, 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // nightly reload at 03:00
  useEffect(() => {
    const now = new Date(), at = new Date(now);
    at.setHours(3, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    const t = setTimeout(() => window.location.reload(), at - now);
    return () => clearTimeout(t);
  }, []);

  // keep the screen awake (where supported)
  useEffect(() => {
    let lock = null;
    const req = async () => { try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch (_) {} };
    req();
    const onVis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); try { lock && lock.release(); } catch (_) {} };
  }, []);

  // hide the pointer when idle; hint disappears after a few seconds
  useEffect(() => {
    document.title = `SmartDesk TV${site ? ` · ${site}` : ''}`;
    let t = setTimeout(() => setCursor(false), 3000);
    const move = () => { setCursor(true); clearTimeout(t); t = setTimeout(() => setCursor(false), 3000); };
    window.addEventListener('mousemove', move);
    const h = setTimeout(() => setHint(false), 9000);
    return () => { window.removeEventListener('mousemove', move); clearTimeout(t); clearTimeout(h); };
  }, [site]);

  const live = useTvLive(config || defaultConfig(), site);

  const goFull = () => {
    setHint(false);
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  return (
    <div onClick={goFull} style={{ position: 'fixed', inset: 0, background: '#000', cursor: cursor ? 'default' : 'none', zIndex: 9999 }}>
      {config && <TvPlayer config={config} live={live} site={site} />}
      {hint && (
        <div style={{ position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: 14, border: '1px solid rgba(255,255,255,.2)' }}>
          Click anywhere (or press F11) for full screen
        </div>
      )}
    </div>
  );
}
