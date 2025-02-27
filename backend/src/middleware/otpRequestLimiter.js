const rateLimit = require("express-rate-limit");

// Email-specific rate limiter (3 requests per email in 5 minutes)
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 5 minutes
  max: 3,
  message: {
    error:
      "Too many OTP requests for this email. Please try again after 15 minutes.",
  },
  keyGenerator: (req) => {
    return `email-${req.body.email}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// IP-based rate limiter (10 requests per IP in 5 minutes)
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    error:
      "Too many OTP requests from this IP. Please try again after 15 minutes.",
  },
  keyGenerator: (req) => {
    return `ip-${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Combine both limiters
const otpRequestLimiter = (req, res, next) => {
  emailLimiter(req, res, (err) => {
    if (err) return next(err);
    ipLimiter(req, res, next);
  });
};

module.exports = otpRequestLimiter;
