const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.getRenamed = async (req, res) => {
    try {
        const { table_name } = req.params;

        if (!table_name) {
            return res.status(400).json({
                success: false,
                message: 'Table name is required'
            });
        }

        // Query to get both original and renamed table names
        const query = `
            SELECT original_column_name, renamed_column_name
            FROM app.column_renames
            WHERE table_name = $1
        `;

        const result = await client_update.query(query, [table_name]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Table name mapping not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching table name mapping:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch table name mapping',
            error: error.message
        });
    }
};