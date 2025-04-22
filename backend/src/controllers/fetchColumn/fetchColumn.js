const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchColumn = async (req, res) => {
    const { table_name } = req.body;

    // Validate input
    if (!table_name) {
        return res.status(400).json({
            success: false,
            message: '"table_name" is a required field.',
        });
    }

    try {
    // Query to get all column names for the given table in the app schema
        const query = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = $1;
        `;
        
    // Execute the query
        const result = await client_update.query(query, [table_name]);

    // If no columns found
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: `No columns found for table "${table_name}" in the app schema.`,
            });
        }

    // Return column names
        const columnNames = result.rows.map(row => row.column_name);
        return res.status(200).json({
            success: true,
            message: `Columns retrieved successfully for table "${table_name}".`,
            columns: columnNames,
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the request',
            error: error.message,
        });
    }
};