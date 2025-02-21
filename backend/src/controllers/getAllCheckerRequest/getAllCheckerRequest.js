const { client_update } = require("../../configuration/database/databaseUpdate.js");

exports.getAllCheckerRequest = async (req, res) => {
  try {
    const checker = req.user.user_id;
    const {
      search = "",
      status = "all",
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    if (!checker) {
      return res.status(400).json({
        success: false,
        message: "Checker ID not found in session.",
      });
    }

    const offset = (page - 1) * limit;

    let whereClause = ` WHERE ct.checker = $1 `;
    const values = [checker];

    if (status !== "all") {
      whereClause += ` AND ct.status = $${values.length + 1}`;
      values.push(status);
    }

    if (search) {
      whereClause += ` AND (
        ct.table_name ILIKE $${values.length + 1} OR 
        u.email ILIKE $${values.length + 2} OR 
        ct.comments ILIKE $${values.length + 3} OR 
        TO_CHAR(ct.created_at, 'YYYY-MM-DD') ILIKE $${values.length + 4}
      )`;
      values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (startDate) {
      whereClause += ` AND ct.updated_at >= $${values.length + 1}`;
      values.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND ct.updated_at <= $${values.length + 1}`;
      values.push(endDate);
    }

    // Debugging: Log the constructed SQL query and parameters
    // console.log("SQL Query:", `SELECT ct.*, u.email AS maker_email FROM app.change_tracker ct JOIN app.users u ON ct.maker::uuid = u.user_id ${whereClause} ORDER BY ct.updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`);
    // console.log("Parameters:", values);

    // Query to get total count of rows
    const countQuery = `SELECT COUNT(*) AS total FROM app.change_tracker ct JOIN app.users u ON ct.maker::uuid = u.user_id ${whereClause}`;
    const countResult = await client_update.query(countQuery, values);
    const totalRows = parseInt(countResult.rows[0].total, 10);

    // Query to get paginated data
    const dataQuery = `SELECT ct.*, u.email AS maker_email FROM app.change_tracker ct JOIN app.users u ON ct.maker::uuid = u.user_id ${whereClause} ORDER BY ct.updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);
    const dataResult = await client_update.query(dataQuery, values);

    // console.log("Data Result:", dataResult.rows);
    
    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      total: totalRows,
    });
  } catch (error) {
    console.error("Error in getAllCheckerRequest:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the request.",
      error: error.message,
    });
  }
};