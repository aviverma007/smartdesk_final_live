/**
 * Dev-server proxy (used by `npm start`): the browser only talks to the portal
 * (port 92); these routes are forwarded server-side to the backends.
 *
 *   /att-api/*  ->  backend-attendance  /api/*   (default http://localhost:5092)
 *   /ura-api/*  ->  backend-userrights  /api/*   (default http://localhost:5093)
 *
 * If a backend runs on another machine, set in frontend/.env:
 *   ATT_API_TARGET=http://192.168.66.107:5092
 *   URA_API_TARGET=http://192.168.66.33:5093
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const route = (prefix, target) => {
    app.use(prefix, createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${prefix}`]: '/api' },
      proxyTimeout: 180000, // File Converter Office jobs can take a while
      timeout: 180000,
      logLevel: 'warn',
      onError(err, req, res) {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, offline: true, error: `Backend not reachable (${target}): ${err.code || err.message}` }));
      },
    }));
  };
  route('/att-api', process.env.ATT_API_TARGET || 'http://localhost:5092');
  route('/ura-api', process.env.URA_API_TARGET || 'http://localhost:5093');
};
