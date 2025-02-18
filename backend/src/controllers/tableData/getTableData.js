const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");

exports.getTableData = async (req, res) => {
  try {
    const tableName = req.params.tableName;
    const {
      sortColumn,
      sortDirection,
      filters,
      searchQuery,
      page = 1,
      pageSize = 10,
    } = req.query;

    // base query
    let query = `SELECT * FROM app.${tableName}`;
    const values = [];
    let valueIndex = 1;

    // WHERE clause for filters and search
    const whereConditions = [];

    // Handle global search
    if (searchQuery) {
      const searchConditions = [];
      const columns = await getTableColumns(tableName);

      columns.forEach((column) => {
        searchConditions.push(`CAST(${column} AS TEXT) ILIKE $${valueIndex}`);
        values.push(`%${searchQuery}%`);
        valueIndex++;
      });

      if (searchConditions.length > 0) {
        whereConditions.push(`(${searchConditions.join(" OR ")})`);
      }
    }

    // Handle column filters
    if (filters) {
      const filterObj = JSON.parse(filters);
      Object.entries(filterObj).forEach(([column, filterData]) => {
        const { operator, value } = filterData;
        if (value) {
          let condition;
          switch (operator) {
            case "contains":
              condition = `CAST(${column} AS TEXT) ILIKE $${valueIndex}`;
              values.push(`%${value}%`);
              break;
            case "equals":
              condition = `CAST(${column} AS TEXT) = $${valueIndex}`;
              values.push(value);
              break;
            case "startsWith":
              condition = `CAST(${column} AS TEXT) ILIKE $${valueIndex}`;
              values.push(`${value}%`);
              break;
            case "endsWith":
              condition = `CAST(${column} AS TEXT) ILIKE $${valueIndex}`;
              values.push(`%${value}`);
              break;
            case "isEmpty":
              condition = `${column} IS NULL OR CAST(${column} AS TEXT) = ''`;
              valueIndex--; // No value needed for isEmpty
              break;
            default:
              condition = `CAST(${column} AS TEXT) ILIKE $${valueIndex}`;
              values.push(`%${value}%`);
          }
          whereConditions.push(condition);
          valueIndex++;
        }
      });
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    // ORDER BY clause
    if (sortColumn && sortDirection) {
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;
    }

    // pagination
    const offset = (page - 1) * pageSize;
    query += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(pageSize, offset);

    // Execute query
    const result = await client_update.query(query, values);

    // Get total count for pagination
    const countQuery = `
            SELECT COUNT(*) 
            FROM app.${tableName}
            ${
              whereConditions.length > 0
                ? `WHERE ${whereConditions.join(" AND ")}`
                : ""
            }
        `;
    const countResult = await client_update.query(
      countQuery,
      values.slice(0, -2)
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
      columns: result.fields.map((field) => field.name), // Add columns
      pagination: {
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / parseInt(pageSize)
        ),
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching table data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching table data",
      error: error.message,
    });
  }
};

// Helper function to get table columns
async function getTableColumns(tableName) {
  const query = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = $1;
    `;
  const result = await client_update.query(query, [tableName]);
  return result.rows.map((row) => row.column_name);
}
