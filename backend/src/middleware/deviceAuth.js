const { GlobalSetting } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Middleware to authenticate ESP32 devices
 * Validates API key from ESP32 RFID readers
 */
exports.authenticateDevice = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-device-api-key'];

        // Fetch key from settings
        const setting = await GlobalSetting.findOne({ key: 'esp32_rfid_api_key' });
        const expectedKey = setting?.value || process.env.ESP32_API_KEY || 'default_esp32_key_change_in_production';

        if (!apiKey) {
            logger.warn('ESP32 request without API key', { ip: req.ip });
            return res.status(401).json({
                success: false,
                message: 'API key required'
            });
        }

        if (apiKey !== expectedKey) {
            logger.warn('ESP32 request with invalid API key', { ip: req.ip, provided_key: apiKey });
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        logger.debug('ESP32 device authenticated', { ip: req.ip });
        next();
    } catch (error) {
        logger.error('Device auth error', { error: error.message });
        res.status(500).json({ success: false, message: 'Auth system error' });
    }
};
