const { client_update } = require('../configuration/database/databaseUpdate');

class DatabaseSecurity {
    static SQL_PATTERNS = {
        // Only check for clearly malicious patterns
        UNION_ATTACKS: /UNION\s+ALL\s+SELECT|UNION\s+SELECT/i,
        DANGEROUS_COMMANDS: /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\s+/i,
        SYSTEM_TABLES: /information_schema\.|pg_/i,
    };

    static validateQueryText(queryText) {
        if (!queryText || typeof queryText !== 'string') {
            throw new Error('Invalid query text');
        }

        // Only check queries that are not prepared statements
        if (!queryText.includes('$')) {
            // Check for dangerous patterns
            for (const [patternName, pattern] of Object.entries(this.SQL_PATTERNS)) {
                if (pattern.test(queryText)) {
                    throw new Error(`Potential SQL injection detected: ${patternName}`);
                }
            }
        }
    }

    static sanitizeValue(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            // Only escape single quotes and remove obvious SQL commands
            value = value.replace(/'/g, "''")
                        .replace(/;(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\s+/gi, '');
        }

        return value;
    }

    static validateAndSanitizeParams(params) {
        if (Array.isArray(params)) {
            return params.map(param => this.sanitizeValue(param));
        }
        return this.sanitizeValue(params);
    }
}

// Create secure database proxy
const secureDatabase = new Proxy(client_update, {
    get(target, prop) {
        if (prop === 'query') {
            return async function (queryText, params = []) {
                try {
                    // Skip validation for certain safe queries
                    const isSafeQuery = (query) => {
                        const safePatterns = [
                            /SELECT.*FROM\s+app\.("OTP_tracker"|users|change_tracker|column_permission|group_table|dynamic_dropdowns)/i,
                            /UPDATE\s+app\.("OTP_tracker"|users|change_tracker)/i,
                            /INSERT\s+INTO\s+app\.("OTP_tracker"|users|change_tracker)/i
                        ];
                        return safePatterns.some(pattern => pattern.test(query));
                    };

                    // Only validate if it's not a safe query
                    if (!isSafeQuery(queryText)) {
                        DatabaseSecurity.validateQueryText(queryText);
                    }

                    // Always sanitize parameters
                    const sanitizedParams = DatabaseSecurity.validateAndSanitizeParams(params);

                    // Log query in development
                    if (process.env.NODE_ENV === 'development') {
                        console.log('Executing query:', {
                            text: queryText,
                            params: sanitizedParams
                        });
                    }

                    // Execute query
                    return await target.query(queryText, sanitizedParams);

                } catch (error) {
                    console.error('Database Security Error:', {
                        error: error.message,
                        query: queryText,
                        params: params
                    });
                    throw error; // Preserve original error
                }
            };
        }
        return target[prop];
    }
});

// Request sanitization middleware - less strict version
const requestSanitizer = (req, res, next) => {
    try {
        const sanitizeObject = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeObject(item));
            }
            
            if (obj !== null && typeof obj === 'object') {
                const sanitizedObj = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitizedObj[key] = sanitizeObject(value);
                }
                return sanitizedObj;
            }
            
            // Only sanitize strings
            if (typeof obj === 'string') {
                return DatabaseSecurity.sanitizeValue(obj);
            }
            
            return obj;
        };

        // Sanitize request data
        req.body = sanitizeObject(req.body);
        req.query = sanitizeObject(req.query);
        req.params = sanitizeObject(req.params);

        next();
    } catch (error) {
        console.error('Request Sanitization Error:', error);
        next(error);
    }
};

// Combined middleware
const databaseSecurityMiddleware = [
    requestSanitizer,
    (req, res, next) => {
        // Replace original client with secure proxy
        const originalModule = require('../configuration/database/databaseUpdate');
        originalModule.client_update = secureDatabase;
        next();
    }
];

module.exports = databaseSecurityMiddleware;