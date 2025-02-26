const jwt = require('jsonwebtoken');
const { client_update } = require('../configuration/database/databaseUpdate.js');

// Base authentication middleware
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        console.log("token", token);

        const sessionId = req.headers['x-session-id'];
        console.log("sessionId in auth middleware", sessionId);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;

            console.log("decoded in auth middleware", decoded);

            // const decodedRefresh = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
            // console.log("decodedRefresh", decodedRefresh);

            // Check if user is still active
            const userQuery = 'SELECT active FROM app.users WHERE user_id = $1';
            const result = await client_update.query(userQuery, [decoded.user_id]);

            if (result.rows.length === 0 || !result.rows[0].active) {
                return res.status(403).json({
                    success: false,
                    message: 'User is inactive or not found'
                });
            }

            
            // console.log("decoded", decoded);

             // Check if user has an active session
             if (decoded.session_id) {
               const sessionQuery = `
                    SELECT session_id, is_active, expires_at
                    FROM app.user_sessions 
                    WHERE session_id = $1 
                    AND user_id = $2
                    AND is_active = true
                    AND expires_at > NOW();
                `;
                const sessionResult = await client_update.query(sessionQuery, [sessionId, decoded.user_id]);
                

                console.log("sessionResult.rowCount in auth middleware", sessionResult.rowCount);

                 // Ensure the session_id matches
                //  const session = sessionResult.rows[0];
                //  if (session.session_id !== decoded.session_id) {
                //      return res.status(401).json({
                //          success: false,
                //          message: 'Session ID mismatch'
                //      });
                //  }
                // console.log("sessionResult", sessionResult);
                // console.log("sessionResult.rowCount in auth middleware", sessionResult.rowCount);
                
                if (sessionResult.rowCount === 0) {
                    // Instead of immediately returning 401, check if it's a refresh token request
                    const isRefreshRequest = req.path.includes('/refresh-token');
                    if (!isRefreshRequest) {
                        console.log("not a refresh reqeust");
                        return res.status(401).json({ 
                            success: false, 
                            message: 'Session expired',
                            code: 'SESSION_EXPIRED'  // Add a specific code for frontend handling
                        });
                    }
                }
            }

            // req.user = decoded;
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
