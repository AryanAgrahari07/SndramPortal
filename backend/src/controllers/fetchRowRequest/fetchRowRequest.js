const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.fetchRowRequest = async (req, res) => {
    try {
        // Query to fetch all pending rows across all tables with maker email
        const query = `
            SELECT art.*, u.email AS maker_email
            FROM app.add_row_table art
            LEFT JOIN app.users u ON art.maker::text = u.user_id::text
            WHERE art.status = 'pending'
            ORDER BY art.created_at DESC;
        `;

        const result = await client_update.query(query);

        // Return the fetched rows
        return res.status(200).json({
            success: true,
            message: 'Pending requests fetched successfully.',
            data: result.rows,
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