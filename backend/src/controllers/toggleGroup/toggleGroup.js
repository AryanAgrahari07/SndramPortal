const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.toggleGroup = async (req, res) => {
    try {
        const { group_name, is_enabled } = req.body;

        if (!group_name || typeof is_enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Invalid request parameters'
            });
        }

        // Update the group's enabled status
        const updateQuery = `
            UPDATE app.group_table 
            SET is_enabled = $1
            WHERE group_name = $2
            RETURNING group_name, is_enabled
        `;

        const result = await client_update.query(updateQuery, [is_enabled, group_name]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Group ${is_enabled ? 'enabled' : 'disabled'} successfully`,
            group: result.rows[0]
        });

    } catch (error) {
        console.error('Error toggling group:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while updating the group',
            error: error.message
        });
    }
};