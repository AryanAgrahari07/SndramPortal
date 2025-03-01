const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const {
  client_update,
} = require("../configuration/database/databaseUpdate.js");

class AuthService {

  // Generate access token (short-lived)
  generateAccessToken(user) {
    return jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" } // Short expiry for security
    );
  }

  // Generate refresh token (long-lived)
  generateRefreshToken() {
    return jwt.sign({ token_id: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "20m",
    });
  }

  // Create new session in database
  async createSession(userId, refreshToken, deviceInfo, ipAddress) {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 20); // 20 minutes from now

    // Deactivate all existing sessions for this user
    await client_update.query(
      "UPDATE app.user_sessions SET is_active = false WHERE user_id = $1",
      [userId]
    );

    // Create new session
    const query = `
            INSERT INTO app.user_sessions (
                session_id, user_id, refresh_token, device_info, 
                ip_address, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;

    const result = await client_update.query(query, [
      sessionId,
      userId,
      refreshToken,
      deviceInfo,
      ipAddress,
      expiresAt,
    ]);

    return result.rows[0];
  }

  async updateSession(sessionId, newRefreshToken) {
    const query = `
            UPDATE app.user_sessions 
            SET refresh_token = $1,
                updated_at = CURRENT_TIMESTAMP,
                expires_at = NOW() + INTERVAL '20 minutes'
            WHERE session_id = $2
        `;

    await client_update.query(query, [newRefreshToken, sessionId]);
  }

  // Validate refresh token and return session info
  async validateRefreshToken(token) {
    try {
      // Verify token signature
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      // Check if token exists and is active in database
      const query = `
                SELECT us.*, u.email, u.role
                FROM app.user_sessions us
                JOIN app.users u ON us.user_id = u.user_id
                WHERE us.refresh_token = $1 
                AND us.is_active = true
                AND us.expires_at > NOW();
            `;

      const result = await client_update.query(query, [token]);

      if (result.rows.length === 0) {
        throw new Error("Invalid refresh token");
      }

      return result.rows[0];
    } catch (error) {
      console.error("Validate refresh token error:", error);
      throw new Error("Invalid refresh token");
    }
  }

  // Invalidate a session
  async invalidateSession(sessionId) {
    await client_update.query(
      "UPDATE app.user_sessions SET is_active = false WHERE session_id = $1",
      [sessionId]
    );
  }
}

const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify the refresh token is valid and get session
    const sessionQuery = `
        SELECT us.*, u.* 
        FROM app.user_sessions us
        JOIN app.users u ON us.user_id = u.user_id
        WHERE us.refresh_token = $1 
        AND us.is_active = true
        AND us.expires_at > NOW()
      `;

    const result = await client_update.query(sessionQuery, [refreshToken]);

    if (result.rows.length === 0) {
      throw new Error("Invalid refresh token");
    }

    const user = result.rows[0];

    //   console.log("user data is", user);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();

    // Update session with new refresh token
    await client_update.query(
      `
        UPDATE app.user_sessions 
        SET refresh_token = $1, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE refresh_token = $2
      `,
      [newRefreshToken, refreshToken]
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
  } catch (error) {
    console.error("Refresh token error:", error);
    throw error;
  }
};

module.exports = new AuthService();
