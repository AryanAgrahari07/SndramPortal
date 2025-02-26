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
            req.user = decoded;

            // Check if user is still active
            const userQuery = 'SELECT active FROM app.users WHERE user_id = $1';
            const result = await client_update.query(userQuery, [decoded.user_id]);

            if (result.rows.length === 0 || !result.rows[0].active) {
                return res.status(403).json({
                    success: false,
                    message: 'User is inactive or not found'
                });
            }

            next();
        } catch (err) {
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

// Role-based authentication middleware
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