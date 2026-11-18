require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Mart Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const staffRoutes = require('./routes/staffRoutes');
const productRoutes = require('./routes/productRoutes');
const posRoutes = require('./routes/posRoutes');
const saleRoutes = require('./routes/saleRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const registerRoutes = require('./routes/registerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.set('etag', false); // Disable 304 ETag generation so responses always return fresh 200 OK

// CORS Configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin);

    if (isAllowed) return callback(null, true);
    return callback(new Error(`CORS blocked: Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Request timing & Performance Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 300) {
      console.warn(`⏱️ [SLOW API: ${duration}ms] ${req.method} ${req.originalUrl} (${res.statusCode})`);
    }
  });
  next();
});

// Prevent browser and proxy caching on dynamic Mart POS routes
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Primary Mart API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/products', productRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);

// Compatibility alias for pharmacy and print
try {
  app.use('/api/print', require('./routes/printRoutes'));
} catch (e) {
  // Optional print service
}
app.use('/api/pharmacy', productRoutes); // Compatibility bridge

// Welcome Root Route
app.get('/', (req, res) => {
  res.status(200).send('🛒 Super Mart Point of Sale (POS) API Server is Running Online! Access the Web Application at http://localhost:3000');
});

// System Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Super Mart Point of Sale (POS) REST API',
    modules: ['Auth', 'Admin', 'POS Terminal', 'Products & Stock', 'Customers & Khata', 'Suppliers & Purchases', 'Register Shifts', 'Expenses & P&L', 'Store Settings'],
    timestamp: new Date().toISOString()
  });
});

// Centralized global error handling middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `Database unique constraint violation on fields: ${(err.meta?.target || []).join(', ')}`,
      code: err.code
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: err.meta?.cause || 'Requested database record does not exist.',
      code: err.code
    });
  }

  console.error('💥 [GLOBAL_ERROR_HANDLER]:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`=================================================`);
  console.log(`🛒 Super Mart Point of Sale (POS) API Server`);
  console.log(`📡 Listening on http://${HOST}:${PORT}`);
  console.log(`=================================================`);
});

module.exports = app;
