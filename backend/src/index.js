const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const connectDB = require('./database');
const { authenticate } = require('./middleware/auth');
const { User, GlobalSetting, Account, RolePermission, AccountPermission } = require('./models');
const { hashPassword } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
const { initRedis } = require('./utils/cache');
const { logger } = require('./utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Vercel/Cloud reverse proxies
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000"],
            connectSrc: ["'self'", "http://localhost:5000", "ws://localhost:5173"]
        }
    }
}));
app.use(mongoSanitize());
app.use(cors({
    origin: true, // Reflects the request origin
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(cookieParser()); // Parse cookies for refresh token
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Static Files removed from public access for security.
// They are now served via the authenticated /api/files/:filename route.

// Health Check (Public)
const healthCheck = async (req, res) => {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        status: 'ok',
        database: dbStatus,
        environment: process.env.VERCEL ? 'vercel' : 'local',
        timestamp: new Date().toISOString()
    });
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// Routes
app.use('/api/portal', require('./routes/portal'));
app.use('/api', apiRoutes);
app.use('/', apiRoutes); // Fail-safe for Vercel

// Global Error Handler
app.use((err, req, res, next) => {
    // Return 400 for specific file type validation errors
    if (err.message === 'Please Select correct file type') {
        return res.status(400).json({ detail: err.message });
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ detail: messages.join(', ') });
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({ detail: `Duplicate field value entered: ${field}` });
    }

    // Mongoose Cast Error (Invalid ID)
    if (err.name === 'CastError') {
        return res.status(400).json({ detail: `Invalid ${err.path}: ${err.value}` });
    }

    console.error(err.stack);
    const status = err.status || 500;
    const message = (status === 500 && process.env.NODE_ENV === 'production')
        ? 'Internal Server Error'
        : (err.message || 'Internal Server Error');

    res.status(status).json({
        detail: message
    });
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Database Connection and Seeding
const setupDB = async () => {
    try {
        await connectDB();
        console.log('MongoDB connection established.');

        // Seed admin user
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await hashPassword('admin123');
            await User.create({
                username: 'admin',
                hashed_password: hashedPassword,
                role: 'Admin'
            });
            console.log('Admin user seeded.');
        }

        // Seed initial exchange rate
        const rateExists = await GlobalSetting.findOne({ key: 'usd_bdt_rate' });
        if (!rateExists) {
            await GlobalSetting.create({ key: 'usd_bdt_rate', value: '110' });
            console.log('Initial exchange rate seeded.');
        }

        // Seed Default Role Permissions
        const roles = ['Accountant', 'Viewer'];
        const modules = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll', 'HR', 'Assets', 'Summaries'];

        for (const role of roles) {
            for (const module of modules) {
                const exists = await RolePermission.findOne({ role, module });
                if (!exists) {
                    await RolePermission.create({
                        role,
                        module,
                        can_access: (role === 'Accountant')
                    });
                }
            }
        }

        // Seed Account Permissions for existing accounts
        const activeAccounts = await Account.find();
        for (const acc of activeAccounts) {
            for (const role of ['Accountant', 'Viewer']) {
                const exists = await AccountPermission.findOne({ role, account_id: acc._id });
                if (!exists) {
                    await AccountPermission.create({
                        role,
                        account_id: acc._id,
                        can_access: true
                    });
                }
            }
        }

        logger.info('Default permissions and checks completed');
    } catch (error) {
        logger.error('Database setup failed', { error: error.message, stack: error.stack });
    }
};

// Only listen if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    setupDB().then(async () => {
        // Initialize Redis (gracefully degrades if unavailable)
        initRedis();

        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    });
} else {
    // For Vercel, we need to ensure DB is connected
    // Vercel serverless functions are stateless, 
    // but Mongoose caches the connection if connected once.
    setupDB().then(() => initRedis());
}

module.exports = app;

