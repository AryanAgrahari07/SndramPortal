const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

exports.getCheckerNotification = async (req, res) => {
  try {
    // Get user_id from JWT token
    // Query for change_tracker table
    const changeTrackerQuery = `
            SELECT *
            FROM app.change_tracker
            WHERE status = 'pending'
            AND checkerseen = false
            ORDER BY created_at DESC
        `;

    // Execute the query
    const changeTrackerResults = await client_update.query(changeTrackerQuery);

    // Process change tracker notifications
    const changeTrackerNotifications = changeTrackerResults.rows.map(
      (notification) => ({
        table_name: notification.table_name,
        maker: notification.maker,
        created_at: notification.created_at,
        updated_at: notification.updated_at,
        request_id: notification.request_id,
        checkerseen: notification.checkerseen,
        status: notification.status,
      })
    );

    // Combine and sort notifications by updated_at
    // const allNotifications = changeTrackerNotifications.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return res.status(200).json({
      success: true,
      data: changeTrackerNotifications,
    });
  } catch (error) {
    console.error("Error fetching checker notifications:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching notifications",
      error: error.message,
    });
  }
};
