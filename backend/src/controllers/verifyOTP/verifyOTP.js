const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const bcrypt = require("bcrypt");
const UAParser = require("ua-parser-js");
const jwt = require("jsonwebtoken");
const authService = require("../../services/authService.js");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

exports.verifyOTP = async (req, res) => {
  const { email, OTP } = req.body;

  if (!email || !OTP || typeof email !== "string" || typeof OTP !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid email or OTP format",
    });
  }

  // Validating email format
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // Validating OTP format (6 digits only)
  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(OTP)) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP format",
    });
  }

  // Sanitizing inputs
  const sanitizedEmail = email.toLowerCase().trim();

  try {
    // Begin a transaction
    await client_update.query("BEGIN");

    // First check if user is active
    const userQuery = {
      text: `
              SELECT user_id, email, role, first_name, last_name, active
              FROM app."users"
              WHERE email = $1
              LIMIT 1
          `,
      values: [sanitizedEmail],
    };

    const userResult = await client_update.query(userQuery);

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
            AND created_at >= NOW() - INTERVAL '40 seconds'
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
                        SELECT * FROM app.users WHERE email = $1 AND active = true;
                    `;
        const userResults = await client_update.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: "User not found or inactive",
          });
        }

        const user = userResults.rows[0];

        // Parse device info from user agent
        const parser = new UAParser(req.headers["user-agent"]);
        const deviceInfo = {
          browser: parser.getBrowser(),
          os: parser.getOS(),
          device: parser.getDevice(),
        };

        await client_update.query(
          "UPDATE app.user_sessions SET is_active = false WHERE user_id = $1",
          [user.user_id]
        );

        // Generate tokens
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = authService.generateRefreshToken();

        const userId = user.user_id;
        const ipAddress = req.ip;
        const sessionId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 20);  // 20 minutes from now

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

        await client_update.query(query, [
          sessionId,
          userId,
          refreshToken,
          deviceInfo,
          ipAddress,
          expiresAt,
        ]);


        // Disable used OTP
        await client_update.query(
          'UPDATE app."OTP_tracker" SET "OTP_disable" = true WHERE email = $1',
          [email]
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

        res.cookie("sessionid", sessionId, {
          httpOnly: false, // Allow JavaScript access in development
          secure: false, // Allow non-HTTPS in development
          sameSite: "Lax", // Allow cross-site cookies
          domain: "localhost", // Explicitly set domain
          path: "/",
          maxAge: 12 * 60 * 60 * 1000, // 12 hours
        });

        res.cookie("refreshtoken", refreshToken, {
          httpOnly: false, // Allow JavaScript access in development
          secure: false, // Allow non-HTTPS in development
          sameSite: "Lax", // Allow cross-site cookies
          domain: "localhost", // Explicitly set domain
          path: "/",
          maxAge: 20 * 60 * 1000, // 20 minutes
        });



        return res.status(200).json({
          success: true,
          message: "OTP verified successfully.",
          token: accessToken,
          data: {
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
          },
          redirectPath,
          cookieSet: true,
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
                AND created_at < NOW() - INTERVAL '40 seconds'
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
