/**
 * Where the browser reaches the backends.
 *
 * By default everything goes through the portal's own address (same host and
 * port as the page, e.g. http://www.smartdesk.com:92/att-api/...). The portal
 * server forwards those calls to the real backends (see src/setupProxy.js), so
 * the site works under any hostname and only port 92 has to be reachable.
 *
 * Override with full URLs in frontend/.env if a backend must be called directly:
 *   REACT_APP_ATT_API=http://192.168.66.28:5092/api
 *   REACT_APP_URA_API=http://192.168.66.28:5093/api
 */
const base = process.env.PUBLIC_URL || '';

export const ATT_API = process.env.REACT_APP_ATT_API || `${base}/att-api`; // → backend-attendance  /api
export const URA_API = process.env.REACT_APP_URA_API || `${base}/ura-api`; // → backend-userrights  /api
