const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const orderRoutes = require('./routes/orders');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
    origins: [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/orders', orderRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Planti Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Planti Backend API',
        version: '1.0.0',
        endpoints: {
            orders: '/api/orders',
            health: '/health'
        }
    });
});



// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Planti Backend Server running on port ${PORT}`);
    console.log(`📊 Dashboard API: http://localhost:${PORT}/api/orders`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    console.log(`🏠 API Root: http://localhost:${PORT}/`);
});