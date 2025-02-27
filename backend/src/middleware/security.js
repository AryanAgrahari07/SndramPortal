const helmet = require('helmet');
const xss = require('xss');
const sanitizeHtml = require('sanitize-html');

// Content Security Policy middleware
const securityMiddleware = (app) => {
    // Configure Helmet with CSP
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        xssFilter: true,
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin' }
    }));
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                // Sanitize string inputs
                req.body[key] = xss(req.body[key].trim());
            }
        });
    }
    next();
};

// Specific OTP sanitization
const sanitizeOTP = (otp) => {
    if (!otp) return '';
    // Remove any non-numeric characters
    return otp.toString().replace(/[^0-9]/g, '').slice(0, 6);
};

// Email sanitization
const sanitizeEmail = (email) => {
    if (!email) return '';
    // Basic email sanitization
    return xss(email.toLowerCase().trim());
};

module.exports = {
    securityMiddleware,
    sanitizeInput,
    sanitizeOTP,
    sanitizeEmail
};