const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.getMakerNotification = async (req, res) => {
    try {
        const maker_id = req.user.user_id;  // Get user_id from JWT token

        // Query for change_tracker table
        const changeTrackerQuery = `
            SELECT 
                table_name,
                status,
                checker as approver,
                updated_at,
                old_data,
                new_data,
                comments,
                request_id,
                makerseen,
                checkerseen
            FROM app.change_tracker 
            WHERE maker = $1 
            AND status IN ('approved', 'rejected')
            ORDER BY updated_at DESC
        `;

        // Query for add_row_table
        const addRowQuery = `
            SELECT 
                table_name,
                status,
                admin as approver,
                updated_at,
                row_data as data,
                comments,
                request_id
            FROM app.add_row_table 
            WHERE maker = $1 
            AND status IN ('approved', 'rejected')
            ORDER BY updated_at DESC
        `;

        // Execute both queries
        const [changeTrackerResults, addRowResults] = await Promise.all([
            client_update.query(changeTrackerQuery, [maker_id]),
            client_update.query(addRowQuery, [maker_id])
        ]);

        // Process change tracker notifications
        const changeTrackerNotifications = changeTrackerResults.rows.map(notification => ({
            type: 'change',
            table_name: notification.table_name,
            status: notification.status,
            approver: notification.approver,
            updated_at: notification.updated_at,
            old_data: notification.old_data,
            new_data: notification.new_data,
            comments: notification.comments,
            request_id: notification.request_id,
            makerseen: notification.makerseen,
            checkerseen: notification.checkerseen
        }));

        // Process add row notifications
        const addRowNotifications = addRowResults.rows.map(notification => ({
            type: 'add_row',
            table_name: notification.table_name,
            status: notification.status,
            approver: notification.approver,
            updated_at: notification.updated_at,
            data: notification.data,
            comments: notification.comments,
            request_id: notification.request_id,
            makerseen: notification.makerseen,
            checkerseen: notification.checkerseen
        }));

        console.log("changeTrackerNotifications:", changeTrackerNotifications);
        console.log("addRowNotifications:", addRowNotifications);
        // Combine and sort notifications by updated_at
        const allNotifications = [...changeTrackerNotifications, ...addRowNotifications]
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        return res.status(200).json({
            success: true,
            notifications: allNotifications
        });

    } catch (error) {
        console.error('Error fetching maker notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while fetching notifications',
            error: error.message
        });
    }
};
