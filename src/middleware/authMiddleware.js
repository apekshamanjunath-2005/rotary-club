const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/db');

/**
 * Authentication Middleware:
 * Verifies JWT token and attaches user record to req.user
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. No token provided.'
            });
        }

        // Verify cryptographic signature and expiration
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'rotary_honavar_secret_key_2026_service_above_self'
        );

        // Fetch user from SQLite database to ensure account is active
        const user = await queryOne(
            'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user || user.is_active !== 1) {
            return res.status(401).json({
                success: false,
                error: 'User not found or account is deactivated.'
            });
        }

        // Attach user info to request object
        req.user = user;
        req.token = token;

        // Proceed to the next middleware or route handler
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Session expired. Please log in again.'
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Invalid authentication token.'
        });
    }
};

/**
 * Admin Authorization Guard:
 * Restricts access strictly to users with role = 'ADMIN'
 */
const adminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Administrator privileges required.'
        });
    }
    next();
};

/**
 * Active Member Guard:
 * Restricts access to approved MEMBERS and ADMINS
 */
const memberMiddleware = (req, res, next) => {
    if (!req.user || (req.user.role !== 'MEMBER' && req.user.role !== 'ADMIN')) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Active club membership required.'
        });
    }
    next();
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    memberMiddleware
};

