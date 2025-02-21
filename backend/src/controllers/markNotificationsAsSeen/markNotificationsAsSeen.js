const { client_update } = require('../../configuration/database/databaseUpdate.js');
 
exports.markNotificationsAsSeen = async (req, res) => {
    const { role, requestIds } = req.body; // role should be either 'maker' or 'checker'
    const userId = req.user.user_id; // Get user ID from JWT token

    if (!role || !Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Role and requestids are required.'
        });
    }

    try {
        // Update the seen status based on the role
        const query = `
            UPDATE app.change_tracker
            SET ${role === 'maker' ? 'makerseen' : 'checkerseen'} = true
            WHERE request_id = ANY($1::uuid[]) AND status = 'pending';
        `;

        const result = await client_update.query(query, [requestIds]);
        // console.log(result);
        // console.log(result.rowCount);

        return res.status(200).json({
            success: true,
            message: 'Notifications marked as seen successfully.',
            result: result.rowCount
        });
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while marking notifications as seen.',
            error: error.message,
        });
    }
};