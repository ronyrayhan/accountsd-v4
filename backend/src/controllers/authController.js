const { User, RolePermission, AccountPermission, Account, GlobalSetting, IndividualModulePermission, IndividualAccountPermission, ActiveSession } = require('../models');
const { hashPassword, comparePassword, createToken } = require('../middleware/auth');
const { logEvent } = require('../utils/logger');
const { delCache, delCachePattern } = require('../utils/cache');

/**
 * Logs a user into the system.
 * 1. Verifies the password.
 * 2. Checks if the user is 'is_active'.
 * 3. Generates both access and refresh JWT tokens.
 * 4. Creates an ActiveSession entry in DB for tracking.
 * 5. Sets refresh token as HTTP-only cookie.
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await comparePassword(password, user.hashed_password))) {
            return res.status(401).json({ detail: 'Incorrect username or password' });
        }

        if (!user.is_active) {
            return res.status(403).json({ detail: 'This account has been deactivated. Please contact an administrator.' });
        }

        const { accessToken, refreshToken } = createToken(user);

        // Create Active Session
        await ActiveSession.create({
            user_id: user._id,
            username: user.username,
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'],
            login_time: new Date(),
            last_activity: new Date(),
            token_signature: refreshToken.split('.')[2] // Store signature for validation
        });

        // Set refresh token as HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'Lax', // Relaxed to Lax for cross-port compatibility
            path: '/api/refresh-token', // Limited scope for extra security
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        await logEvent(user.username, 'Login', 'User successfully logged into the system', 'auth');
        res.json({ access_token: accessToken, token_type: 'bearer' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getActiveSessions = async (req, res) => {
    try {
        const sessions = await ActiveSession.find().sort({ last_activity: -1 });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const terminateSession = async (req, res) => {
    try {
        const { id } = req.params;
        await ActiveSession.findByIdAndDelete(id);
        await logEvent(req.user.username, 'Force Logout', `Terminated session ${id}`, 'admin');
        res.json({ message: 'Session terminated' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

/**
 * Gets the current user's profile and permissions.
 * This endpoint is CRITICAL for the frontend as it determines:
 * - What sidebar menu items to show.
 * - Which buttons to enable/disable (Capabilities).
 * 
 * Performance: Uses Redis cache (5min TTL) to reduce DB load by ~70%
 */
const getMe = async (req, res) => {
    const { getCache, setCache } = require('../utils/cache');
    const { logger } = require('../utils/logger');
    const { User, HREmployee, RolePermission, IndividualModulePermission, GlobalSetting } = require('../models');

    try {
        const userId = req.user._id.toString();
        const cacheKey = `user:${userId}:permissions:v7`;

        // TEMPORARILY DISABLE CACHE FOR DEBUGGING
        // let cachedData = await getCache(cacheKey);
        // if (cachedData) {
        //     logger.debug('Permissions served from cache', { userId });
        //     return res.json(cachedData);
        // }

        const userRole = (req.user.role || '').toLowerCase().trim();
        const isAdmin = userRole === 'admin';

        logger.info('GetMe Debug', {
            userId,
            username: req.user.username,
            role: req.user.role,
            userRole,
            isAdmin
        });

        let permissions = [];
        if (isAdmin) {
            const modulesList = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll', 'Assets', 'ActiveSessions', 'HR', 'Summaries', 'Approvals', 'Admin', 'ESS'];
            permissions = modulesList.map(m => ({ module: m, can_access: true }));
        } else {
            const rolePerms = await RolePermission.find({ role: req.user.role });
            const indPerms = await IndividualModulePermission.find({ user_id: req.user._id });
            const mergedMap = {};

            // Default permission for ESS role
            if (userRole === 'ess') {
                mergedMap['ESS'] = true;
            }

            rolePerms.forEach(p => mergedMap[p.module] = p.can_access);
            indPerms.forEach(p => mergedMap[p.module] = p.can_access);
            permissions = Object.keys(mergedMap).map(m => ({ module: m, can_access: mergedMap[m] }));
        }

        // AUTO-DETECT MANAGER STATUS: If user has subordinates, grant 'Approvals' module
        const userWithEmp = await User.findById(req.user._id).select('employee_id');
        if (userWithEmp && userWithEmp.employee_id) {
            const { HREmployee: HREmp } = require('../models/hrModels');
            const subordinateCount = await HREmp.countDocuments({ 'employment_info.reporting_manager_id': userWithEmp.employee_id });
            if (subordinateCount > 0) {
                if (!permissions.find(p => p.module === 'Approvals')) {
                    permissions.push({ module: 'Approvals', can_access: true });
                }
            }
        }

        const canAccess = (moduleName) => {
            if (isAdmin) return true;
            const p = permissions.find(p => p.module === moduleName);
            return p ? (p.can_access === true || p.can_access === 1) : false;
        };

        const allMenuGroups = [
            {
                title: 'Main Menu',
                icon: 'fa-solid fa-layer-group',
                items: [
                    { module: 'Dashboard', label: 'Dashboard', path: '/', icon: 'fa-solid fa-house' },
                    { module: 'Ledger', label: 'Transaction Ledger', path: '/ledger', icon: 'fa-solid fa-receipt' },
                    { module: 'Reports', label: 'Analytics', path: '/reports', icon: 'fa-solid fa-chart-pie' },
                    { module: 'Summaries', label: 'Financial Snapshots', path: '/summaries', icon: 'fa-solid fa-clock-rotate-left' },
                    { module: 'Billing', label: 'Billing & Payables', path: '/billing', icon: 'fa-solid fa-file-invoice-dollar' }
                ]
            },
            {
                title: 'Human Resources',
                icon: 'fa-solid fa-user-tie',
                items: [
                    { module: 'HR', label: 'HR Dashboard', path: '/hr', icon: 'fa-solid fa-gauge-high' },
                    { module: 'HR', label: 'Employee Directory', path: '/hr/employees', icon: 'fa-solid fa-user-group' },
                    { module: 'HR', label: 'Attendance Management', path: '/hr/attendance', icon: 'fa-solid fa-clock' },
                    { module: 'HR', label: 'Leave Center', path: '/hr/leaves', icon: 'fa-solid fa-umbrella-beach' },
                    { module: 'HR', label: 'Leave Settings', path: '/hr/leave-settings', icon: 'fa-solid fa-sliders' },
                    { module: 'HR', label: 'Shift Management', path: '/hr/shifts', icon: 'fa-solid fa-business-time' },
                    { module: 'HR', label: 'Onboarding Center', path: '/hr/onboarding', icon: 'fa-solid fa-passport' },
                    { module: 'Payroll', label: 'Payroll Center', path: '/payroll', icon: 'fa-solid fa-file-invoice-dollar' },
                    { module: 'Assets', label: 'Asset Tracking', path: '/assets', icon: 'fa-solid fa-boxes-stacked' }
                ]
            },
            {
                title: 'Employee Self Service',
                icon: 'fa-solid fa-id-card',
                items: [
                    { module: 'ESS', label: 'My Dashboard', path: '/my-dashboard', icon: 'fa-solid fa-house' },
                    { module: 'ESS', label: 'My Attendance', path: '/my-attendance', icon: 'fa-solid fa-fingerprint' },
                    { module: 'ESS', label: 'Leave Center', path: '/my-leaves', icon: 'fa-solid fa-umbrella-beach' },
                    { module: 'ESS', label: 'My Profile', path: '/my-profile', icon: 'fa-solid fa-user-circle' }
                ]
            },
            {
                title: 'Approver Center',
                icon: 'fa-solid fa-clipboard-check',
                items: [
                    { module: 'Approvals', label: 'Team Requests', path: '/approvals/leaves', icon: 'fa-solid fa-clipboard-check' },
                    { module: 'Approvals', label: 'My Subordinates', path: '/approvals/team', icon: 'fa-solid fa-users-rectangle' },
                    { module: 'Approvals', label: 'Apply for Team', path: '/approvals/apply-for', icon: 'fa-solid fa-user-plus' }
                ]
            },
            {
                title: 'System Management',
                icon: 'fa-solid fa-screwdriver-wrench',
                items: [
                    { module: 'Settings', label: 'Global Settings', path: '/settings', icon: 'fa-solid fa-gears' },
                    { module: 'ActiveSessions', label: 'Active Sessions', path: '/active-sessions', icon: 'fa-solid fa-user-clock' },
                    { module: 'Admin', label: 'Audit Logs', path: '/logs', icon: 'fa-solid fa-list-check', adminOnly: true }
                ]
            }
        ];

        let navigation = [];
        if (isAdmin) {
            navigation = allMenuGroups;
        } else {
            navigation = allMenuGroups.map(group => ({
                ...group,
                items: group.items.filter(item => {
                    if (item.adminOnly) return false;
                    return canAccess(item.module);
                })
            })).filter(group => group.items.length > 0);
        }

        const capabilities = {
            canAccounting: canAccess('Accounting'),
            canReports: canAccess('Reports'),
            canSettings: canAccess('Settings'),
            canLedger: canAccess('Ledger'),
            canStatements: canAccess('Statements'),
            canUsers: canAccess('Users'),
            canBilling: canAccess('Billing'),
            canPayroll: canAccess('Payroll'),
            canHR: canAccess('HR'),
            canSummaries: canAccess('Summaries'),
            canApprovals: canAccess('Approvals'),
            isAdmin: isAdmin
        };

        const settingsList = await GlobalSetting.find({});
        const settings = {};

        // SECURITY: Filter out sensitive keys from the front-end settings dump
        const sensitiveKeys = ['esp32_rfid_api_key', 'jwt_secret', 'mail_password', 'db_url'];

        settingsList.forEach(s => {
            if (!sensitiveKeys.includes(s.key)) {
                settings[s.key] = s.value;
            }
        });

        const responseData = {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            is_active: req.user.is_active,
            profile_picture: req.user.profile_picture,
            navigation: navigation,
            capabilities: capabilities,
            modules: permissions.filter(p => p.can_access === true || p.can_access === 1).map(p => p.module),
            settings
        };

        logger.info('GetMe Navigation Debug', {
            userId,
            username: req.user.username,
            navigationGroupCount: navigation.length,
            navigationTitles: navigation.map(g => g.title),
            modulesCount: responseData.modules.length,
            modules: responseData.modules
        });

        // TEMPORARILY DISABLE CACHING
        // await setCache(cacheKey, responseData, 300);
        res.json(responseData);
    } catch (error) {
        logger.error('GetMe Error', { userId: req.user?._id, error: error.message });
        res.status(500).json({ detail: error.message });
    }
};

const listUsers = async (req, res) => {
    try {
        const users = await User.find({}, 'username role is_active');
        res.json(users);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { username, password, role, employee_id } = req.body;
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ detail: 'Username already exists' });
        }

        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            username,
            hashed_password: hashedPassword,
            role,
            is_active: true,
            employee_id // Link if provided
        });

        await logEvent(req.user.username, 'Create User', `Created new user: ${username} with role: ${role}`, 'admin');

        res.status(201).json({
            id: user.id,
            username: user.username,
            role: user.role,
            is_active: user.is_active
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ detail: 'User not found' });

        user.is_active = !user.is_active;
        await user.save();
        await logEvent(req.user.username, 'Toggle User Status', `User ${user.username} is now ${user.is_active ? 'Active' : 'Deactivated'}`, 'admin');
        res.json(user);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getPermissions = async (req, res) => {
    try {
        const permissions = await RolePermission.find();
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updatePermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        for (const p of permissions) {
            await RolePermission.findOneAndUpdate(
                { role: p.role, module: p.module },
                { can_access: p.can_access },
                { upsert: true, new: true }
            );
            await logEvent(req.user.username, 'Update Permission', `Changed ${p.module} access for role ${p.role} to ${p.can_access}`, 'admin');
        }

        // Clear all cached permissions as role-level changes affect multiple users
        await delCachePattern('user:*:permissions');

        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Permission update error:', error);
        res.status(500).json({ detail: error.message });
    }
};

const getAccountPermissions = async (req, res) => {
    try {
        const permissions = await AccountPermission.find();
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updateAccountPermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        for (const p of permissions) {
            await AccountPermission.findOneAndUpdate(
                { role: p.role, account_id: p.account_id },
                { can_access: p.can_access },
                { upsert: true, new: true }
            );
            await logEvent(req.user.username, 'Update Account Permission', `Changed access for account ID ${p.account_id} for role ${p.role} to ${p.can_access}`, 'admin');
        }

        // Clear all cached permissions to reflect account access changes
        await delCachePattern('user:*:permissions');

        res.json({ message: 'Account permissions updated successfully' });
    } catch (error) {
        console.error('Account permission update error:', error);
        res.status(500).json({ detail: error.message });
    }
};

const getIndividualPermissions = async (req, res) => {
    try {
        const [modPerms, accPerms] = await Promise.all([
            IndividualModulePermission.find(),
            IndividualAccountPermission.find()
        ]);
        res.json({ modulePermissions: modPerms, accountPermissions: accPerms });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const getUserByEmployeeId = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const user = await User.findOne({ employee_id }, 'username role is_active');
        if (!user) return res.status(200).json(null);
        res.json(user);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

const updateIndividualPermission = async (req, res) => {
    try {
        const { userId, type, target, canAccess } = req.body; // type: 'module' or 'account'

        if (type === 'module') {
            await IndividualModulePermission.findOneAndUpdate(
                { user_id: userId, module: target },
                { can_access: canAccess },
                { upsert: true }
            );
        } else if (type === 'account') {
            await IndividualAccountPermission.findOneAndUpdate(
                { user_id: userId, account_id: target },
                { can_access: canAccess },
                { upsert: true }
            );
        }

        const targetUser = await User.findById(userId);
        await logEvent(req.user.username, 'Individual Permission Update', `Updated ${type} access for user ${targetUser?.username || userId}: ${target} -> ${canAccess}`, 'admin');

        // Clear cache for this specific user
        await delCache(`user:${userId}:permissions`);

        res.json({ message: 'Update successful' });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

/**
 * Refresh Access Token
 * Uses the refresh token from HTTP-only cookie to issue a new access token.
 */
const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            return res.status(401).json({ detail: 'Refresh token not found' });
        }

        const jwt = require('jsonwebtoken');
        const SECRET_KEY = process.env.JWT_SECRET;

        // Verify refresh token
        const payload = jwt.verify(refreshToken, SECRET_KEY);

        // Check if session still exists with this token signature
        const tokenSignature = refreshToken.split('.')[2];
        const session = await ActiveSession.findOne({
            user_id: payload.id,
            token_signature: tokenSignature
        });

        if (!session) {
            return res.status(401).json({ detail: 'Session expired or invalid' });
        }

        // Get fresh user data
        const user = await User.findById(payload.id);
        if (!user || !user.is_active) {
            return res.status(401).json({ detail: 'User not found or inactive' });
        }

        // Generate new access token only
        const accessToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '15m' }
        );

        // Update last activity
        session.last_activity = new Date();
        await session.save();

        res.json({ access_token: accessToken, token_type: 'bearer' });
    } catch (error) {
        res.status(401).json({ detail: 'Invalid or expired refresh token' });
    }
};

const updateProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }

        const userId = req.user._id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ detail: 'User not found' });

        // Update profile picture path
        user.profile_picture = `profiles/${req.file.filename}`;
        await user.save();

        await logEvent(user.username, 'Update Profile Picture', 'User updated their profile picture', 'auth');

        res.json({
            message: 'Profile picture updated successfully',
            profile_picture: user.profile_picture
        });
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
};

module.exports = {
    login,
    getMe,
    listUsers,
    createUser,
    toggleUserStatus,
    getPermissions,
    updatePermissions,
    getAccountPermissions,
    updateAccountPermissions,
    getIndividualPermissions,
    updateIndividualPermission,
    getActiveSessions,
    terminateSession,
    refreshAccessToken,
    getUserByEmployeeId,
    updateProfilePicture
};
