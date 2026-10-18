// FayshaaWeb Backend Server
// Main entry point for the application

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import configurations
const { initializeFirebase } = require('./config/firebase');
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const pageRoutes = require('./routes/pages');
const apartmentRoutes = require('./routes/apartments');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const feedbackRoutes = require('./routes/feedback');
const wellnessRoutes = require('./routes/wellness');
const wellnessJourneysRoutes = require('./routes/wellnessJourneys');
const wellnessAvailabilityRoutes = require('./routes/wellnessAvailability');
const wellnessUnifiedRoutes = require('./routes/wellnessUnified'); // NEW: Unified wellness booking system
const depositBoxRoutes = require('./routes/depositBox');

// HR (admin → HR pages) and public careers listing
const jobsRoutes = require('./routes/jobs');
const contactRoutes = require('./routes/contact');
const employeesRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const { auditTrail, requireAreaByMethod } = require('./middleware/hq');

// Manager dashboard (FAY OS) API
const managerRoutes = require('./routes/manager');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - trust only 1 hop (Nginx)
app.set('trust proxy', 1);

// Initialize Firebase Admin SDK
try {
  initializeFirebase();
  console.log('✓ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error.message);
  console.log('⚠️  Notification features will not be available');
}

// Middleware
app.use(helmet()); // Security headers
app.use(morgan('combined')); // HTTP request logging
// Stripe signs the raw request body, so the webhook must see it before express.json() parses it.
app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies with 50MB limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies with 50MB limit

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://fayshaa.com',
  'http://fayshaa.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  // The manager dashboard is authenticated and loads many resources per screen.
  skip: (req) => req.originalUrl.startsWith('/api/manager/')
});
app.use('/api/', limiter);

// Audit trail: every change made by a signed-in user is recorded (HQ → Audit log)
app.use('/api', auditTrail);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/wellness-journeys', wellnessJourneysRoutes); // OLD: Will be deprecated
app.use('/api/wellness-availability', wellnessAvailabilityRoutes);
app.use('/api/wellness-unified', wellnessUnifiedRoutes); // NEW: Unified wellness booking system
app.use('/api/deposit-box', depositBoxRoutes);
app.use('/api/contact', contactRoutes); // public contact form (website)
app.use('/api/jobs', jobsRoutes); // listing and applications are public (Careers page); management is staff-only
app.use('/api/employees', requireAreaByMethod('hr'), employeesRoutes); // super administrators, managers and HR roles
app.use('/api/attendance', requireAreaByMethod('hr'), attendanceRoutes); // super administrators, managers and HR roles
app.use('/api/leave', requireAreaByMethod('hr'), leaveRoutes); // super administrators, managers and HR roles

// Manager dashboard (FAY OS) API — staff only, see routes/manager/index.js
app.use('/api/manager', managerRoutes);

// Faysha HQ (super administrator dashboard) API — access by HQ area, see middleware/hq.js
app.use('/api/admin', adminRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'FayshaaWeb API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        changePassword: 'POST /api/auth/change-password',
        verifyEmail: 'POST /api/auth/verify-email',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:id',
        create: 'POST /api/users',
        updateStatus: 'PATCH /api/users/:id/status',
        delete: 'DELETE /api/users/:id',
        roles: 'GET /api/users/roles/all',
        loginHistory: 'GET /api/users/:id/login-history'
      },
      notifications: {
        register: 'POST /api/notifications/register',
        unregister: 'POST /api/notifications/unregister',
        send: 'POST /api/notifications/send',
        sendBulk: 'POST /api/notifications/send-bulk',
        broadcast: 'POST /api/notifications/broadcast',
        subscribe: 'POST /api/notifications/subscribe',
        unsubscribe: 'POST /api/notifications/unsubscribe',
        getTokens: 'GET /api/notifications/tokens/:userId'
      },
      pages: {
        list: 'GET /api/pages',
        get: 'GET /api/pages/:id',
        create: 'POST /api/pages',
        update: 'PUT /api/pages/:id',
        delete: 'DELETE /api/pages/:id'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('');
  console.log('=====================================');
  console.log(`🚀 FayshaaWeb Server Running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log('=====================================');
  console.log('');
});

// Setup Socket.IO for real-time chat
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO authentication: clients pass their JWT as `auth: { token }`.
// Staff (manager / superadmin) sockets join the 'staff' and 'admin' rooms automatically.
const jwt = require('jsonwebtoken');
const STAFF_ROLES = ['manager', 'superadmin'];
io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next();
  try {
    const { userId, imp } = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    // View-as (read-only) sessions get no live staff channel, so they can't send messages.
    if (imp) return next();
    const { rows } = await db.query(
      `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status = 'active'`,
      [userId]
    );
    if (rows[0]) socket.data.user = rows[0];
    return next();
  } catch (error) {
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user) {
    socket.join(`user_${user.id}`);
    if (STAFF_ROLES.includes(user.role)) {
      socket.join('staff');
      socket.join('admin');
    }
  }

  // Join user-specific room (guest app chat). A signed-in socket can only join its own room.
  // Older app builds connect without a token; set SOCKET_REQUIRE_AUTH=true once they are retired.
  socket.on('join', (userId) => {
    if (user && String(userId) !== String(user.id) && !STAFF_ROLES.includes(user.role)) return;
    if (!user && process.env.SOCKET_REQUIRE_AUTH === 'true') return;
    socket.join(`user_${userId}`);
  });

  // Admin room (all guest chat traffic) — staff only.
  socket.on('joinAdmin', () => {
    if (user && STAFF_ROLES.includes(user.role)) socket.join('admin');
  });

  socket.on('disconnect', () => {
    console.log(`✗ Socket disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    db.pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    db.pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
