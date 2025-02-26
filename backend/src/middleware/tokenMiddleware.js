const jwt = require("jsonwebtoken");
const {
  client_update,
} = require("../configuration/database/databaseUpdate.js");
const UAParser = require("ua-parser-js");
const { v4: uuidv4 } = require('uuid');

const generateTokens = (user) => {
  const session_id = uuidv4();
  const accessToken = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role,session_id },
    process.env.JWT_SECRET,
    { expiresIn: "30s" }
  );

  const refreshToken = jwt.sign(
    { user_id: user.user_id,session_id: session_id},
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken, session_id };
};

const validateSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token not provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user has an active session
    const sessionQuery = `
            SELECT * FROM app.user_sessions 
            WHERE user_id = $1 
            AND is_active = true;
        `;
    const sessionResult = await client_update.query(sessionQuery, [
      decoded.user_id,
    ]);

    if (sessionResult.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "No active session found",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

const createSession = async (user, req) => {
  const ua = new UAParser(req.headers["user-agent"]);
  const deviceInfo = {
    browser: ua.getBrowser(),
    os: ua.getOS(),
    device: ua.getDevice(),
  };

  // Deactivate all existing sessions for the user
  await client_update.query(
    "UPDATE app.user_sessions SET is_active = false WHERE user_id = $1",
    [user.user_id]
  );

  const session_id =  uuidv4();
  const { refreshToken } = generateTokens({...user, session_id});

  // Create new session
  const query = `
        INSERT INTO app.user_sessions (
            session_id,
            user_id,
            refresh_token,
            device_info,
            ip_address,
            expires_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')
        RETURNING *;
    `;

  const values = [
    session_id,
    user.user_id,
    refreshToken,
    JSON.stringify(deviceInfo),
    req.ip,
  ];

  await client_update.query(query, values);
  return refreshToken;
};

module.exports = {
  generateTokens,
  validateSession,
  createSession,
};
