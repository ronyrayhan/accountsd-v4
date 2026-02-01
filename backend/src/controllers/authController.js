const { User, RolePermission, AccountPermission, Account, GlobalSetting, IndividualModulePermission, IndividualAccountPermission, ActiveSession } = require('../models');
const { hashPassword, comparePassword, createToken } = require('../middleware/auth');
const { logEvent } = require('../utils/logger');

/**
 * Logs a user into the system.
 * 1. Verifies the password.
 * 2. Checks if the user is 'is_active'.
 * 3. Generates a JWT token for the session.
 * 4. Creates an ActiveSession entry in DB for tracking.
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

        const token = createToken(user);

        // Create Active Session
        await ActiveSession.create({
            user_id: user._id,
            username: user.username,
            ip_address: req.ip || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'],
            login_time: new Date(),
            last_activity: new Date()
        });

        await logEvent(user.username, 'Login', 'User successfully logged into the system', 'auth');
        res.json({ access_token: token, token_type: 'bearer' });
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
 */
const getMe = async (req, res) => {
    try {
        let permissions = [];
        if (req.user.role === 'Admin') {
            const modulesList = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll', 'Assets', 'ActiveSessions'];
            permissions = modulesList.map(m => ({ module: m, can_access: true }));
        } else {
            const rolePerms = await RolePermission.find({ role: req.user.role });
            const indPerms = await IndividualModulePermission.find({ user_id: req.user._id });
            const mergedMap = {};
            rolePerms.forEach(p => mergedMap[p.module] = p.can_access);
            indPerms.forEach(p => mergedMap[p.module] = p.can_access);
            permissions = Object.keys(mergedMap).map(m => ({ module: m, can_access: mergedMap[m] }));
        }

        const canAccess = (moduleName) => {
            if (req.user.role === 'Admin') return true;
            const p = permissions.find(p => p.module === moduleName);
            return p ? (p.can_access === true || p.can_access === 1) : false;
        };

        // Server-defined UI structure (The Menu)
        const menuGroups = [
            {
                title: 'Main Menu',
                items: [
                    { module: 'Dashboard', label: 'Dashboard', path: '/', icon: 'fa-solid fa-house' },
                    { module: 'Ledger', label: 'Transaction Ledger', path: '/ledger', icon: 'fa-solid fa-receipt' },
                    { module: 'Reports', label: 'Analytics', path: '/reports', icon: 'fa-solid fa-chart-pie' },
                    { module: 'Billing', label: 'Billing & Payables', path: '/billing', icon: 'fa-solid fa-file-invoice-dollar' }
                ]
            },
            {
                title: 'Operations',
                items: [
                    { module: 'Payroll', label: 'HR & Payroll', path: '/payroll', icon: 'fa-solid fa-people-group' },
                    { module: 'Assets', label: 'Asset Tracking', path: '/assets', icon: 'fa-solid fa-boxes-stacked' }
                ]
            },
            {
                title: 'System',
                items: [
                    { module: 'Settings', label: 'Settings', path: '/settings', icon: 'fa-solid fa-gears' },
                    { module: 'AuditTrail', label: 'Audit Trail', path: '/logs', icon: 'fa-solid fa-shield-halved', adminOnly: true },
                    { module: 'ActiveSessions', label: 'Active Sessions', path: '/active-sessions', icon: 'fa-solid fa-network-wired', adminOnly: true }
                ]
            }
        ];

        // Filter navigation based on permissions
        const navigation = menuGroups.map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (item.adminOnly) return req.user.role === 'Admin';
                return canAccess(item.module);
            })
        })).filter(group => group.items.length > 0);

        // Map capabilities for feature-level control
        const capabilities = {
            canAccounting: canAccess('Accounting'),
            canReports: canAccess('Reports'),
            canSettings: canAccess('Settings'),
            canLedger: canAccess('Ledger'),
            canStatements: canAccess('Statements'),
            canUsers: canAccess('Users'),
            canBilling: canAccess('Billing'),
            canPayroll: canAccess('Payroll'),
            isAdmin: req.user.role === 'Admin'
        };

        const settingsList = await GlobalSetting.find({});
        const settings = {};
        settingsList.forEach(s => settings[s.key] = s.value);

        res.json({
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            is_active: req.user.is_active,
            navigation: navigation,
            capabilities: capabilities,
            modules: permissions.filter(p => p.can_access === true || p.can_access === 1).map(p => p.module),
            settings
        });
    } catch (error) {
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
        const { username, password, role } = req.body;
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ detail: 'Username already exists' });
        }

        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            username,
            hashed_password: hashedPassword,
            role,
            is_active: true
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

        res.json({ message: 'Update successful' });
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
    terminateSession
};
