const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchColumnwithdatatype = async (req, res) => {
    const { table_name } = req.body;

    // Validate input
    if (!table_name) {
        return res.status(400).json({
            success: false,
            message: '"table_name" is a required field.',
        });
    }

    try {
        // Query to get column names and data types for the given table in the app schema
        const query = `
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                udt_name
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = $1
            ORDER BY ordinal_position;
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

        // Process column information
        const columns = result.rows.map(row => {
            let type = row.data_type;
            
            // Handle special data types
            if (row.udt_name === 'uuid') {
                type = 'uuid';
            } else if (row.data_type === 'ARRAY') {
                type = `${row.udt_name.replace('_', '[]')}`;
            } else if (row.data_type === 'character varying' || row.data_type === 'character') {
                type = `${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`;
            } else if (row.data_type === 'numeric' || row.data_type === 'decimal') {
                type = `${row.data_type}${row.numeric_precision ? `(${row.numeric_precision}${row.numeric_scale ? `,${row.numeric_scale}` : ''})` : ''}`;
            }
            
            return {
                name: row.column_name,
                type: type
            };
        });

        return res.status(200).json({
            success: true,
            message: `Columns retrieved successfully for table "${table_name}".`,
            columns: columns,
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