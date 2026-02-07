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
            connectSrc: ["'self'", "http://localhost:5000", "ws://localhost:5173"],
            frameSrc: ["'self'", "http://localhost:5000"], // Allow framing backend content
            frameAncestors: ["'self'", "http://localhost:5173"] // Allow frontend to frame backend
        }
    },
    frameguard: false // Disable X-Frame-Options to allow framing from different origin (localhost:5173)
}));

// Serve uploads folder for public viewing of policies/training materials
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom CSRF Protection (Double Submit Cookie Pattern)
const crypto = require('crypto');
const csrfProtection = (req, res, next) => {
    // Disable CSRF in test environment
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    // Only check state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        // Exempt auth routes that establish the session
        const excludedPaths = ['/api/login', '/api/refresh-token'];
        if (excludedPaths.includes(req.path)) {
            return next();
        }

        const csrfToken = req.headers['x-csrf-token'];
        const csrfCookie = req.cookies['_csrf'];

        if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
            logger.warn('CSRF validation failed', {
                ip: req.ip,
                method: req.method,
                url: req.originalUrl,
                hasToken: !!csrfToken,
                hasCookie: !!csrfCookie
            });
            return res.status(403).json({ detail: 'CSRF validation failed. Refresh the page.' });
        }
    }
    next();
};

app.get('/api/csrf-token', (req, res) => {
    // Generate a new token if not present
    let token = req.cookies['_csrf'];
    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
    }

    res.cookie('_csrf', token, {
        httpOnly: false, // Must be accessible by JS to send in header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Changed from Strict for cross-port compatibility on localhost
        path: '/'
    });
    res.json({ csrfToken: token });
});

app.use('/api', csrfProtection); // Apply to all API routes after the token route

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

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
const profilesDir = path.join(uploadDir, 'profiles');
[uploadDir, profilesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

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

// Only listen if not in Vercel environment and NOT in test environment
if (process.env.NODE_ENV !== 'test' && (process.env.NODE_ENV !== 'production' || !process.env.VERCEL)) {
    setupDB().then(async () => {
        // Initialize Redis (gracefully degrades if unavailable)
        initRedis();

        app.listen(PORT, () => {
            logger.info(`Server is running on http://localhost:${PORT}`);
        });
    });
} else if (process.env.NODE_ENV !== 'test') {
    // For Vercel, we need to ensure DB is connected
    setupDB().then(() => initRedis());
}

module.exports = app;

