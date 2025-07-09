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
    // For the group request, we always return summary data
    // since we're already grouping by table name
    // Extract pagination parameters from query string only if not summary
    const summary = req.query.summary === 'true';
    const page = summary ? 1 : (parseInt(req.query.page) || 1);
    const limit = summary ? 1000 : (parseInt(req.query.limit) || 10); // Use high limit for summary
    
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

    // Calculate total number of groups with pending tables
    const totalItems = Object.keys(groupedData).length;
    
    // For summary, return all data
    // For paginated requests, apply pagination
    let responseData = groupedData;
    
    if (!summary) {
      const totalPages = Math.ceil(totalItems / limit);
      
      // Apply pagination to the grouped data
      const paginatedGroupedData = {};
      const groupNames = Object.keys(groupedData);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, groupNames.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const groupName = groupNames[i];
        paginatedGroupedData[groupName] = groupedData[groupName];
      }
      
      responseData = paginatedGroupedData;
      
      res.status(200).json({
        success: true,
        message: "Successfully fetched grouped checker requests",
        data: responseData,
        pagination: {
          total: totalItems,
          page: page,
          limit: limit,
          totalPages: totalPages
        }
      });
    } else {
      // For summary, just return all data with total count
      res.status(200).json({
        success: true,
        message: "Successfully fetched grouped checker requests summary",
        data: responseData,
        pagination: {
          total: totalItems
        }
      });
    }
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
