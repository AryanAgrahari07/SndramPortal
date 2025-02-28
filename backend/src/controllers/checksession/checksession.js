const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const jwt = require("jsonwebtoken");

exports.checksession = async (req, res) => {
  try {
    // Get the session_id from cookies or headers
    const sessionId = req.cookies.sessionid || req.headers["session-id"];

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Session ID is missing",
        code: "SESSION_INVALID",
      });
    }

    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        code: "SESSION_INVALID",
      });
    }

    // Verify the token and decode the user_id
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    // Check if the user is active
    const userQuery = `
            SELECT active 
            FROM app.users 
            WHERE user_id = $1
        `;
    const userResult = await client_update.query(userQuery, [userId]);

    if (!userResult.rows[0] || !userResult.rows[0].active) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
        code: "SESSION_INVALID",
      });
    }

    // Check if the session_id is active for the user
    const sessionQuery = `
            SELECT is_active, expires_at 
            FROM app.user_sessions 
            WHERE user_id = $1 
            AND session_id = $2
        `;
    const sessionResult = await client_update.query(sessionQuery, [
      userId,
      sessionId,
    ]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session not found",
        code: "SESSION_INVALID",
      });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      // Deactivate the session if it's expired or inactive
      await client_update.query(
        `
                UPDATE app.user_sessions 
                SET is_active = false 
                WHERE user_id = $1 
                AND session_id = $2
            `,
        [userId, sessionId]
      );

      return res.status(401).json({
        success: false,
        message: "Session is inactive or expired",
        code: "SESSION_INVALID",
      });
    }

    // If everything is valid, return success
    return res.json({
      success: true,
      message: "Session is valid",
    });
  } catch (error) {
    console.error("Check session error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
