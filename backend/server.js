require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize, connectWithRetry } = require('./config/database');
const logger = require('./middleware/logging');
const errorHandler = require('./middleware/error');
const { initializeAdmin } = require('./controllers/authController');

const app = express();

// Configure CORS to allow requests from frontend
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://frontend:3000', 'http://127.0.0.1:3000']
  : ['http://localhost:3000']; // In production, only allow browser origin

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(logger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint for connection testing
app.get('/api/debug', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Connection successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'No origin header',
    host: req.headers.host,
    'x-forwarded-for': req.headers['x-forwarded-for'] || 'Not provided',
    requestIP: req.ip,
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Database sync and server start
async function startServer() {
  try {
    // Wait for database connection
    await connectWithRetry();
    
    // Sync database after connection is established
    await sequelize.sync();
    console.log('Database synchronized successfully');
    
    // Initialize admin account
    await initializeAdmin();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();