const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { RESTRICTED_TABLES } = require('../../config/restrictedTables');

exports.table = async (req, res) => {
    try {
        let query;
        const params = [];

        // if (req.user && req.user.role === 'admin') {
        //     // Admin can see all tables
        //     query = `
        //         SELECT table_name
        //         FROM information_schema.tables
        //         WHERE table_schema = 'app' 
        //         AND table_type = 'BASE TABLE';
        //     `;
        // } else {
            // Non-admin users can only see non-restricted tables
            query = `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'app' 
                AND table_type = 'BASE TABLE'
                AND table_name NOT IN (${RESTRICTED_TABLES.map((_, i) => `$${i + 1}`).join(',')});
            `;
            params.push(...RESTRICTED_TABLES);
        // }

        const result = await client_update.query(query, params);
        res.status(200).json({
            success: true,
            tables: result.rows,
        });
    } catch (error) {
        console.error('Error fetching table names:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch table names',
            error: error.message,
        });
    }
}