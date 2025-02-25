const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

exports.markNotificationsAsSeen = async (req, res) => {
  const { role, requestIds } = req.body; // role should be either 'maker' or 'checker'

  if (!role || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Role and requestids are required.",
    });
  }

  try {
    // Update the seen status based on the role
    let columnToUpdate = "";
    if (role === "maker") {
      columnToUpdate = "makerseen";
    } else if (role === "checker") {
      columnToUpdate = "checkerseen";
    }

    const changeTrackerQuery = `
            UPDATE app.change_tracker
            SET ${columnToUpdate} = true
            WHERE request_id = ANY($1::uuid[]) AND ${columnToUpdate} = false;
        `;

    const addRowQuery = `
        UPDATE app.add_row_table
        SET ${columnToUpdate} = true
        WHERE request_id = ANY($1::uuid[]) AND ${columnToUpdate} = false;
      `;

      const [changeTrackerResult, addRowResult] = await Promise.all([
        client_update.query(changeTrackerQuery, [requestIds]),
        client_update.query(addRowQuery, [requestIds])
      ]);

      await client_update.query('COMMIT');

      const totalUpdated = changeTrackerResult.rowCount + addRowResult.rowCount;


    return res.status(200).json({
      success: true,
      message: "Notifications marked as seen successfully.",
      result: totalUpdated,
    });
  } catch (error) {
    console.error("Error marking notifications as seen:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while marking notifications as seen.",
      error: error.message,
    });
  }
};
