const { isRestrictedTable } = require('../config/restrictedTables');

/**
 * Middleware to control access to tables based on user role
 * Only admin users can access restricted tables
 */
const tableAccessControl = (req, res, next) => {
    // Get table name from either params or body
    const tableName = req.params.name || req.params.tableName || req.body.table_name;
    
    if (!tableName) {
        return next();
    }

    // Check if it's a restricted table
    if (isRestrictedTable(tableName)) {
        // Only allow access to admin users
        // if (req.user && req.user.role === 'admin') {
        //     return next();
        // }
        return res.status(403).json({
            success: false,
            message: 'Access to this table is restricted'
        });
    }

    next();
};

module.exports = tableAccessControl; 