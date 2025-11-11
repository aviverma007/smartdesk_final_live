// SMARTWORLD DEVELOPERS - Production Server
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 80;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "customer-assets.emergentagent.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://smartworldemployee.com"]
    }
  }
}));

// Compression middleware
app.use(compression());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// API Proxy to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  timeout: 30000,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Backend service unavailable' });
  }
}));

// Serve company policies and static files
app.use('/company policies', express.static(path.join(__dirname, 'company policies')));
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));

// Serve React build files
app.use(express.static(path.join(__dirname, 'frontend/build'), {
  maxAge: '1d',
  etag: true
}));

// Handle React routing - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMARTWORLD DEVELOPERS Employee Portal running on port ${PORT}`);
  console.log(`Server: ${new Date().toISOString()}`);
  console.log(`Access URL: http://192.168.166.171:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});