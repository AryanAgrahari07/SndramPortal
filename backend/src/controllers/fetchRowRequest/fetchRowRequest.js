const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchRowRequest = async (req, res) => {
    try {
        // Extract pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const tableName = req.query.tableName; // Optional table name filter
        const makerEmail = req.query.makerEmail; // Optional maker filter
        const sortBy = req.query.sortBy || 'created_at'; // Default sort by created_at
        const sortOrder = req.query.sortOrder || 'desc'; // Default sort order is descending
        
        // Validate sort parameters to prevent SQL injection
        const allowedSortFields = ['created_at', 'table_name', 'maker'];
        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Base query to count total records
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM app.add_row_table art
            LEFT JOIN app.users u ON art.maker::text = u.user_id::text
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
            countQuery += ` AND art.table_name = $1`;
            dataQuery += ` AND art.table_name = $1`;
        }

        // Add maker filter if specified
        if (makerEmail) {
            const makerCondition = ` AND u.email = $${tableName ? 2 : 1}`;
            countQuery += makerCondition;
            dataQuery += makerCondition;
        }

        // Add sorting and pagination
        dataQuery += `
            ORDER BY ${validSortBy} ${validSortOrder}
            LIMIT ${limit} OFFSET ${offset};
        `;

        // Prepare parameters array
        const params = [];
        if (tableName) params.push(tableName);
        if (makerEmail) params.push(makerEmail);

        // Execute both queries
        const countResult = await client_update.query(countQuery, params);
        const dataResult = await client_update.query(dataQuery, params);

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