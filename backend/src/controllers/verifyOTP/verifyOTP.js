const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  generateTokens,
  createSession,
} = require("../../middleware/tokenMiddleware.js");
require("dotenv").config();
const UAParser = require("ua-parser-js");
const { v4: uuidv4 } = require("uuid");

exports.verifyOTP = async (req, res) => {
  const { email, OTP } = req.body;

  if (!email || !OTP) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required.",
    });
  }

  try {
    // Begin a transaction
    await client_update.query("BEGIN");

    // First check if user is active
    const userQuery = `
            SELECT user_id, email, role, first_name, last_name, active
            FROM app."users"
            WHERE email = $1
            LIMIT 1;
        `;

    const userResult = await client_update.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      await client_update.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.active) {
      await client_update.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Query to get stored OTP data
    const getOtpQuery = `
            SELECT "OTP", created_at 
            FROM app."OTP_tracker"
            WHERE email = $1 
            AND "OTP_disable" = false
            AND created_at >= NOW() - INTERVAL '30 seconds'
            LIMIT 1;
        `;

    const result = await client_update.query(getOtpQuery, [email]);

    if (result.rows.length > 0) {
      const storedHashedOTP = result.rows[0].OTP;

      // Compare the provided OTP with stored hash
      const isValidOTP = await bcrypt.compare(OTP.toString(), storedHashedOTP);

      if (isValidOTP) {
        // Update OTP_disable to true
        const updateQuery = `
                    UPDATE app."OTP_tracker"
                    SET "OTP_disable" = true
                    WHERE email = $1;
                `;
        await client_update.query(updateQuery, [email]);
        await client_update.query("COMMIT");

        const userQuery = `
                SELECT * FROM app.users 
                WHERE email = $1 AND active = true;
            `;
        const userResult = await client_update.query(userQuery, [email]);

        if (userResult.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found or inactive",
          });
        }

        const user = userResult.rows[0];



        // const session_id = uuidv4();
      
        // // Generate access token
        // const accessToken = jwt.sign(
        //   {
        //     userId: user.user_id,
        //     email: user.email,
        //     role: user.role
        //   },
        //   process.env.JWT_SECRET,
        //   { expiresIn: '1h' }
        // );
  
        // // Generate refresh token
        // const refreshToken = jwt.sign(
        //   { sessionId: session_id },
        //   process.env.REFRESH_TOKEN_SECRET,
        //   { expiresIn: '7d' }
        // );

        // Deactivate all existing sessions for the user
        
        const { accessToken, session_id } = generateTokens(user);
        const refreshToken = await createSession(user, req);

        const ua = new UAParser(req.headers["user-agent"]);
        const deviceInfo = {
          browser: ua.getBrowser(),
          os: ua.getOS(),
          device: ua.getDevice(),
        };
        
        // Create session record
        await client_update.query(
          `
                INSERT INTO app.user_sessions (
                    session_id,
                    user_id,
                    refresh_token,
                    device_info,
                    ip_address,
                    is_active,
                    expires_at
                )
                VALUES ($1, $2, $3, $4, $5, true, NOW() + INTERVAL '7 days')
            `,
          [
            session_id,
            user.user_id,
            refreshToken,
            JSON.stringify(deviceInfo),
            req.ip,
          ]
        );

        // Determine redirect path based on role
        let redirectPath;
        switch (user.role.toLowerCase()) {
          case "admin":
            redirectPath = "/admin";
            break;
          case "maker":
            redirectPath = "/dashboard";
            break;
          case "checker":
            redirectPath = "/checker";
            break;
          default:
            redirectPath = "/login";
        }

        return res.status(200).json({
          success: true,
          message: "OTP verified successfully.",
          data: {
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
          },
          tokens: {
            accessToken,
            refreshToken,
            session_id,
          },
          redirectPath,
        });
      } else {
        await client_update.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Invalid OTP.",
        });
      }
    } else {
      // Check if OTP exists but expired
      const checkExpiredQuery = `
                SELECT created_at 
                FROM app."OTP_tracker"
                WHERE email = $1 
                AND "OTP_disable" = false
                AND created_at < NOW() - INTERVAL '30 seconds'
                LIMIT 1;
            `;

      const expiredResult = await client_update.query(checkExpiredQuery, [
        email,
      ]);
      await client_update.query("ROLLBACK");

      if (expiredResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP or OTP has already been used.",
      });
    }
  } catch (error) {
    // Rollback the transaction in case of error
    await client_update.query("ROLLBACK");
    console.error("Error during OTP verification:", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying OTP.",
      error: error.message,
    });
  }
};
