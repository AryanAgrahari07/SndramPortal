const authService = require("../../services/authService");
const jwt = require("jsonwebtoken");

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshtoken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const session = await authService.validateRefreshToken(refreshToken);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new access token with current timestamp
    const accessToken = jwt.sign(
      {
        user_id: session.user_id,
        email: session.email,
        role: session.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" } // Set appropriate expiration time
    );

    const newRefreshToken = authService.generateRefreshToken();

    await authService.updateSession(session.session_id, newRefreshToken);



    let cookieOptions;

    if (process.env.NODE_ENV === 'production') {
      cookieOptions = {
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
        domain: "misadmindev.sundarammutual.com",
        path: "/"
      };
    } else {
      cookieOptions = {
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        domain: "localhost",
        path: "/"
      };
    }

    // For refresh token
    res.cookie("refreshtoken", refreshToken, {
      ...cookieOptions,
      maxAge: 20 * 60 * 1000 // 20 minutes
    });
    
    // ------- for sending refresh token to frontend in cookies

    // res.cookie("refreshtoken", newRefreshToken, {
    //   httpOnly: false, // Allow JavaScript access in development
    //   secure: false, // Allow non-HTTPS in development
    //   sameSite: "Lax", // Allow cross-site cookies
    //   domain: "localhost", // Explicitly set domain
    //   path: "/",
    //   maxAge: 20 * 60 * 1000, // 20 minutes
    // });


    // res.cookie("refreshtoken", newRefreshToken, {
    //   httpOnly: false, // Allow JavaScript access in development
    //   secure: true, // Allow non-HTTPS in development
    //   sameSite: "Lax", // Allow cross-site cookies
    //   domain: "misadmindev.sundarammutual.com", // Explicitly set domain
    //   maxAge: 20 * 60 * 1000, // 20 minutes
    // });

    // --------

    return res.status(200).json({
      success: true,
      token: accessToken,
      data: {
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error); 
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};
