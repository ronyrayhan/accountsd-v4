const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, ActiveSession } = require('../models');

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error("FATAL ERROR: JWT_SECRET is not defined.");
    process.exit(1);
}

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const createToken = (user) => {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, {
        expiresIn: '30d'
    });
};

/**
 * Middleware: VALIDATE USER (Authentication)
 * 1. Checks if the request has a 'Authorization' header with 'Bearer <token>'.
 * 2. Decodes the token using the secret key.
 * 3. Verifies if the user exists and is active.
 * 4. Checks if the user has a valid ActiveSession in the DB.
 * 5. Attaches the user object to 'req.user' for subsequent routes.
 */
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ detail: 'Could not validate credentials' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, SECRET_KEY);
        const user = await User.findById(payload.id);
        if (!user || !user.is_active) {
            return res.status(401).json({ detail: 'User not found or inactive' });
        }

        // Check for active session (Force Logout check)
        // We match strictly by User ID. 
        // Ideally we matched token signature, but without re-issuing tokens, checking DB existence is the fallback.
        const sessionExists = await ActiveSession.findOne({ user_id: user._id });
        if (!sessionExists) {
            return res.status(401).json({ detail: 'Session expired or terminated by admin' });
        }

        // Update last activity
        sessionExists.last_activity = Date.now();
        // Update IP if changed? Maybe not, keep original login IP.
        await sessionExists.save();

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ detail: 'Invalid token' });
    }
};

/**
 * Middleware: CHECK PERMISSION (Authorization)
 * 
 * Usage: router.get('/path', authorize('ModuleName'), controller)
 * 
 * Logic:
 * 1. Checks if the user is 'Admin' (Bypasses all checks).
 * 2. Checks if the user's role has permission for the requested 'ModuleName'.
 * 3. Or explicitly allows specific roles (e.g., authorize(['Accountant'])).
 */
const authorize = (moduleOrRoles = []) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ detail: 'Authentication required' });
        }

        const userRole = req.user.role || '';

        // Master Bypass: Admin always has all permissions (Case-insensitive)
        if (userRole.toLowerCase() === 'admin') {
            return next();
        }

        const items = Array.isArray(moduleOrRoles) ? moduleOrRoles : [moduleOrRoles];

        // 1. Check if role is explicitly allowed in the list (e.g., allow ['Accountant'] directly)
        if (items.includes(userRole)) {
            return next();
        }

        // 2. Check if any item in the list matches an 'Individual Permission' or 'Role Permission' in the Database
        const { RolePermission, IndividualModulePermission } = require('../models');
        for (const moduleName of items) {
            // Check Individual Override First (Granular)
            const indPermission = await IndividualModulePermission.findOne({
                user_id: req.user._id,
                module: moduleName
            });

            if (indPermission) {
                if (indPermission.can_access) return next();
                // If individual permission explicitly says FALSE, we don't fall back to role for THIS module
                // but we continue checking other modules in the 'items' list.
                continue;
            }

            // Fallback to Role Permission (Default)
            const permission = await RolePermission.findOne({
                role: userRole,
                module: moduleName
            });

            if (permission && (permission.can_access === true || permission.can_access === 1)) {
                return next();
            }
        }

        return res.status(403).json({ detail: `Access denied for: ${items.join(', ')}` });
    };
};

module.exports = {
    hashPassword,
    comparePassword,
    createToken,
    authenticate,
    authorize
};
