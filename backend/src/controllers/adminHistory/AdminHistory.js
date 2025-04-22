const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.AdminHistory = async (req, res) => {
  try {
    const {
      page,
      limit,
      status,
      search,
      from,
      to,
      sortBy,
      sortOrder = 'desc',
      type
    } = req.query;

    const offset = (page - 1) * limit;

    // Base query for both change_tracker and add_row_table
    const baseQuery = `
      WITH change_history AS (
        SELECT 
          ct.request_id::text as request_id,
          ct.table_name,
          ct.row_id,
          ct.maker,
          maker_user.email as maker_email,
          ct.checker,
          checker_user.email as checker_email,
          ct.status,
          ct.created_at,
          ct.comments,
          ct.old_data::text as old_data,
          ct.new_data::text as new_data,
          NULL::text as row_data,
          'change' as type,
          ct.makerseen,
          ct.checkerseen
        FROM app.change_tracker ct
        LEFT JOIN app.users maker_user ON ct.maker = maker_user.user_id::text
        LEFT JOIN app.users checker_user ON ct.checker = checker_user.user_id::text
        WHERE ct.status IN ('approved', 'rejected')
      ),
      add_history AS (
        SELECT 
          art.request_id::text as request_id,
          art.table_name,
          art.request_id::text as row_id,
          art.maker,
          maker_user.email as maker_email,
          art.admin as checker,
          admin_user.email as checker_email,
          art.status,
          art.created_at,
          art.comments,
          NULL::text as old_data,
          NULL::text as new_data,
          art.row_data::text as row_data,
          'add' as type,
          false as makerseen,
          false as checkerseen
        FROM app.add_row_table art
        LEFT JOIN app.users maker_user ON art.maker = maker_user.user_id::text
        LEFT JOIN app.users admin_user ON art.admin = admin_user.user_id::text
        WHERE art.status IN ('approved', 'rejected')
      )
      SELECT * FROM (
        SELECT * FROM change_history
        UNION ALL
        SELECT * FROM add_history
      ) combined_history
      WHERE 1=1
    `;

    // Add filters
    const params = [];
    let paramCount = 1;
    let whereClauses = [];

    // Add type filter
    if (type && type !== 'all') {
      whereClauses.push(`type = $${paramCount}`);
      params.push(type);
      paramCount++;
    }
    
    if (status && status !== 'all') {
      whereClauses.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (search) {
      whereClauses.push(`
        (table_name ILIKE $${paramCount}
        OR maker_email ILIKE $${paramCount}
        OR checker_email ILIKE $${paramCount}
        OR comments ILIKE $${paramCount})
      `);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (from) {
      whereClauses.push(`created_at >= $${paramCount}`);
      params.push(from);
      paramCount++;
    }

    if (to) {
      whereClauses.push(`created_at <= $${paramCount}`);
      params.push(to);
      paramCount++;
    }

    // Combine all where clauses
    const whereClause = whereClauses.length > 0 
      ? ' AND ' + whereClauses.join(' AND ')
      : '';

    // Add sorting
    let orderByClause = 'ORDER BY created_at DESC';
    if (sortBy) {
      const validSortColumns = [
        'table_name',
        'maker_email',
        'checker_email',
        'status',
        'created_at',
        'updated_at',
        'type'
      ];
      
      if (validSortColumns.includes(sortBy)) {
        orderByClause = `ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
      }
    } else {
      orderByClause = 'ORDER BY created_at DESC';
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${baseQuery}${whereClause}) as filtered_history
    `;

    const countResult = await client_update.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const finalQuery = `
      ${baseQuery}${whereClause}
      ${orderByClause}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);
    const result = await client_update.query(finalQuery, params);

    // Convert text back to JSON for the response
    const processedRows = result.rows.map(row => ({
      ...row,
      old_data: row.old_data ? JSON.parse(row.old_data) : null,
      new_data: row.new_data ? JSON.parse(row.new_data) : null,
      row_data: row.row_data ? JSON.parse(row.row_data) : null
    }));

    return res.status(200).json({
      success: true,
      data: processedRows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching admin history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch history',
      error: error.message
    });
  }
};