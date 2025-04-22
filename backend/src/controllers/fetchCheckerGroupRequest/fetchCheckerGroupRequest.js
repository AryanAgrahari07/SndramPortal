const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

/**
 * Fetches all groups and their tables that have pending checker requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const fetchCheckerGroupRequest = async (req, res) => {
  try {
    // Get all groups with their tables
    const groupQuery = `
      SELECT group_name, table_list::json as table_list
      FROM app.group_table
      where is_enabled = true
      ORDER BY group_name ASC;
    `;
    const groupResult = await client_update.query(groupQuery);

    // Get all pending change requests with counts
    const pendingQuery = `
      SELECT 
        table_name, 
        COUNT(*) as pending_count
      FROM app.change_tracker
      WHERE status = 'pending'
      GROUP BY table_name;
    `;
    const pendingResult = await client_update.query(pendingQuery);

    // Transform the data to include only groups with pending tables
    const groupedData = groupResult.rows.reduce((acc, group) => {
      // table_list is already parsed by Postgres
      const tables = Array.isArray(group.table_list)
        ? group.table_list
        : [group.table_list]; // Handle single table case

      const tablesWithPending = tables
        .filter((tableName) =>
          pendingResult.rows.some((pt) => pt.table_name === tableName)
        )
        .map((tableName) => ({
          table_name: tableName,
          pending_count:
            pendingResult.rows.find((pt) => pt.table_name === tableName)
              ?.pending_count || 0,
        }));

      if (tablesWithPending.length > 0) {
        acc[group.group_name] = tablesWithPending;
      }

      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Successfully fetched grouped checker requests",
      data: groupedData,
    });
  } catch (error) {
    console.error("Error fetching checker group requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch checker group requests",
      error: error.message,
      stack: error.stack,
    });
  }
};

module.exports = {
  fetchCheckerGroupRequest,
};
