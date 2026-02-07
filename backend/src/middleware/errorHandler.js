const { logger } = require('../utils/logger');

/**
 * Global Error Handling Middleware
 * Catch-all for any errors thrown in routes/controllers.
 * Ensures consistent JSON response structure.
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';

    // Log the error for tracking
    logger.error(`[Global Error Handler] ${message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
        status: statusCode,
        user: req.user ? req.user.username : 'Anonymous'
    });

    res.status(statusCode).json({
        detail: message,
        status: statusCode,
        path: req.path,
        // Include stack trace only in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;
