const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

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

        // Generate JWT token
        const token = jwt.sign(
          {
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" }
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
          token: token,
          data: {
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
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
