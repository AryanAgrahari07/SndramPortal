const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

exports.fetchCheckerRequest = async (req, res) => {
  try {
    // Check if we only need summary data
    const summary = req.query.summary === 'true';

    if (summary) {
      // For summary, we only need counts per table
      const summaryQuery = `
        SELECT 
          table_name, 
          COUNT(*) as pending_count
        FROM app.change_tracker
        WHERE status = 'pending'
        GROUP BY table_name
        ORDER BY table_name ASC;
      `;
      
      const result = await client_update.query(summaryQuery);
      
      // Get total count across all tables
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM app.change_tracker
        WHERE status = 'pending';
      `;
      
      const countResult = await client_update.query(countQuery);
      const totalItems = parseInt(countResult.rows[0].total);
      
      return res.status(200).json({
        success: true,
        message: "Successfully fetched pending checker requests summary",
        data: result.rows,
        pagination: {
          total: totalItems
        }
      });
    }
    
    // If not summary, proceed with regular pagination
    // Extract pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const tableName = req.query.tableName || req.query.table_name; // Support both parameter names

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Base query to count total records
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM app.change_tracker
      WHERE status = 'pending'
    `;

    // Base query to fetch paginated data
    let dataQuery = `
      SELECT *
      FROM app.change_tracker
      WHERE status = 'pending'
    `;

    // Add table filter if specified
    if (tableName) {
      countQuery += ` AND table_name = $1`;
      dataQuery += ` AND table_name = $1`;
    }

    // Add sorting and pagination
    dataQuery += `
      ORDER BY created_at DESC
      ${tableName ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2'}
    `;

    // Execute both queries
    let countResult, dataResult;
    
    if (tableName) {
      countResult = await client_update.query(countQuery, [tableName]);
      dataResult = await client_update.query(dataQuery, [tableName, limit, offset]);
    } else {
      countResult = await client_update.query(countQuery);
      dataResult = await client_update.query(dataQuery, [limit, offset]);
    }

    // Calculate total pages
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      success: true,
      message: "Successfully fetched pending checker requests",
      data: dataResult.rows,
      pagination: {
        total: totalItems,
        page: page,
        limit: limit,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching pending checker requests:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch pending checker requests",
      error: error.message,
      stack: error.stack,
    });
  }
};
