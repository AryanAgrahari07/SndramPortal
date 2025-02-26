const jwt = require('jsonwebtoken');
const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { generateTokens } = require('../../middleware/tokenMiddleware.js');

exports.refreshToken = async (req, res) => {
    const { refreshToken, sessionId } = req.body;

    // console.log("Refresh attempt with:", { refreshToken: !!refreshToken, sessionId });
    // console.log("refreshToken", refreshToken);
    // console.log("sessionId", sessionId);
    // console.log("req.body", req.body);

    if (!refreshToken || !sessionId) {
        console.log("Refresh token and sessionId are required");
        return res.status(400).json({
            success: false,
            message: 'Refresh token and sessionId are required'
        });
    }

    if (!process.env.JWT_REFRESH_SECRET) {
        console.error('REFRESH_TOKEN_SECRET not configured');
        return res.status(500).json({
            success: false,
            message: 'Server configuration error'
        });
    }


    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        // console.log('Decoded refresh token:', decoded);

        // Check if the refresh token exists in the database and is active
        const sessionQuery = `
            SELECT session_id, user_id, is_active, expires_at, refresh_token
            FROM app.user_sessions
            WHERE session_id = $1 
            AND user_id = $2
            AND is_active = true
            AND expires_at > NOW();
        `;
        const sessionResult = await client_update.query(sessionQuery, [sessionId, decoded.user_id]);

        // console.log("sessionResult", sessionResult);
        console.log("sessionResult.rowCount in refreshToken", sessionResult.rowCount);

        if (sessionResult.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        const session = sessionResult.rows[0];

        console.log("session", session);

        // const user = {
        //     user_id: decoded.user_id,
        //     email: sessionResult.rows[0].email,
        //     role: sessionResult.rows[0].role
        // };

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens({
            user_id: decoded.user_id,
            email: decoded.email,
            role: decoded.role
        });

        // Update session with new refresh token
        await client_update.query(
            `UPDATE app.user_sessions 
             SET refresh_token = $1, 
                 updated_at = NOW(),
                 expires_at = NOW() + INTERVAL '7 days'
             WHERE session_id = $2`,
            [newRefreshToken, sessionId]
        );


        // console.log("newRefreshToken", newRefreshToken);
        // console.log("session_id", sessionId);
        // console.log("accessToken", accessToken);

        res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                sessionId
            }
        });
    } catch (error) {
        console.error('Error in refreshToken:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token format'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Refresh token has expired'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};