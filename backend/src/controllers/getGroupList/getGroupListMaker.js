const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.getGroupListMaker = async (req, res) => {
    try {
        await client_update.query('BEGIN');

        const queryText = 'SELECT * FROM app.group_table WHERE is_enabled = true';
        const result = await client_update.query(queryText);

        await client_update.query('COMMIT');

        return res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Error:', error);

        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the request.',
            error: error.message,
        });
    }
};