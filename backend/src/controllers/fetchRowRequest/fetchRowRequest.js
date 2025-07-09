const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchRowRequest = async (req, res) => {
    try {
        // Extract pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const tableName = req.query.tableName; // Optional table name filter

        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Base query to count total records
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM app.add_row_table art
            WHERE art.status = 'pending'
        `;

        // Base query to fetch paginated data
        let dataQuery = `
            SELECT art.*, u.email AS maker_email
            FROM app.add_row_table art
            LEFT JOIN app.users u ON art.maker::text = u.user_id::text
            WHERE art.status = 'pending'
        `;

        // Add table filter if specified
        if (tableName) {
            countQuery += ` AND art.table_name = '${tableName}'`;
            dataQuery += ` AND art.table_name = '${tableName}'`;
        }

        // Add sorting and pagination
        dataQuery += `
            ORDER BY art.created_at DESC
            LIMIT ${limit} OFFSET ${offset};
        `;

        // Execute both queries
        const countResult = await client_update.query(countQuery);
        const dataResult = await client_update.query(dataQuery);

        // Calculate total pages
        const totalItems = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalItems / limit);

        // Return the paginated data with metadata
        return res.status(200).json({
            success: true,
            message: 'Pending requests fetched successfully.',
            data: dataResult.rows,
            pagination: {
                total: totalItems,
                page: page,
                limit: limit,
                totalPages: totalPages
            }
        });
    } catch (error) {
        // Rollback transaction if required
        await client_update.query('ROLLBACK');
        console.error('Error:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the request.',
            error: error.message,
        });
    }
};