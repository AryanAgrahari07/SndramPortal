const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.logout = async (req, res) => {
    try {
        const { session_id, user_id } = req.user;

        await client_update.query('BEGIN');

        const updateQuery = `
            UPDATE app.user_sessions 
            SET is_active = false 
            WHERE session_id = $1 AND user_id = $2;
        `;
        await client_update.query(updateQuery, [session_id, user_id]);

        await client_update.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during logout'
        });
    }
};