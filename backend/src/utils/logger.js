const { SystemLog } = require('../models');

/**
 * Logs a system event asynchronously.
 * @param {string} user - The username of the person performing the action.
 * @param {string} action - The high-level action (e.g., "Login", "Create User").
 * @param {string} detail - Detailed description of the event.
 * @param {'entry'|'edit'|'delete'|'auth'|'admin'|'setting'} type - The category of the log.
 */
const logEvent = async (user, action, detail, type = 'entry') => {
    try {
        await SystemLog.create({
            user: user || 'System',
            action,
            detail,
            type,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Logging failed:', error);
    }
};

module.exports = { logEvent };
