// Auth Middleware - JWT Verification
const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'spelltable_dev_only_insecure_secret';

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user ID to the request
        req.user = { id: decoded.userId };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        });
    }
};

module.exports = { authenticate, JWT_SECRET };
