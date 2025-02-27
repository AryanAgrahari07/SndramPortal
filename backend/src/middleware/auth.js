const jwt = require('jsonwebtoken');
const { client_update } = require('../configuration/database/databaseUpdate.js');

// Base authentication middleware
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            console.log("decoded data is", decoded);
            // Check if user has valid session
            const sessionQuery = `
                SELECT us.*, u.active 
                FROM app.user_sessions us
                JOIN app.users u ON us.user_id = u.user_id
                WHERE us.user_id = $1 AND us.is_active = true
                AND us.expires_at > NOW()
            `;
            const result = await client_update.query(sessionQuery, [decoded.user_id]);

            if (result.rows.length === 0 || !result.rows[0].active) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid session'
                });
            }

            req.user = decoded;
            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Role-based authentication middleware (no changes needed)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access'
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    authorize
};