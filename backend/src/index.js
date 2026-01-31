const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./database');
const { authenticate } = require('./middleware/auth');
const { User, GlobalSetting, Account, RolePermission, AccountPermission } = require('./models');
const { hashPassword } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Vercel/Cloud reverse proxies
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
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

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Protected Static Files
app.use('/uploads', authenticate, express.static(path.join(__dirname, '../uploads')));

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
app.use('/api', apiRoutes);
app.use('/', apiRoutes); // Fail-safe for Vercel

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        detail: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
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
        const modules = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll'];

        for (const role of roles) {
            for (const module of modules) {
                const exists = await RolePermission.findOne({ role, module });
                if (!exists) {
                    await RolePermission.create({
                        role,
                        module,
                        can_access: role === 'Accountant'
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

        console.log('Default permissions and checks completed.');
    } catch (error) {
        console.error('Database setup failed:', error);
    }
};

// Only listen if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    setupDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    });
} else {
    // For Vercel, we need to ensure DB is connected
    // Vercel serverless functions are stateless, 
    // but Mongoose caches the connection if connected once.
    setupDB();
}

module.exports = app;

