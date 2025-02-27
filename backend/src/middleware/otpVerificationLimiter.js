const rateLimit = require("express-rate-limit");

// Create email-specific rate limiter for OTP verification
const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per email
  message: {
    success: false,
    message:
      "Too many verification attempts. Please try again after 15 minutes.",
  },
  keyGenerator: (req) => `verify-otp-${req.body.email}`, // Track by email
  standardHeaders: true,
  legacyHeaders: false,
});

// Create IP-based rate limiter for OTP verification
const ipVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: {
    success: false,
    message:
      "Too many verification attempts from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Combine both limiters
const otpVerificationLimiter = (req, res, next) => {
  emailVerificationLimiter(req, res, (err) => {
    if (err) return next(err);
    ipVerificationLimiter(req, res, next);
  });
};

module.exports = {
  otpVerificationLimiter,
};
