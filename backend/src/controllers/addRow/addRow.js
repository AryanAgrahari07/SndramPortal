const {
  client_update,
} = require("../../configuration/database/databaseUpdate.js");
const { v4: uuidv4 } = require("uuid");

const validateTableName = (tableName) => {
  // Only allow alphanumeric characters and underscores
  const validTableNameRegex = /^[a-zA-Z0-9_]+$/;
  return validTableNameRegex.test(tableName);
};

const getTableSchema = async (client, tableName) => {
  const query = `
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = $1;
    `;
  const result = await client.query(query, [tableName]);
  return result.rows;
};

const validateRowData = (rowData, tableSchema) => {
  const errors = [];

  for (const [key, value] of Object.entries(rowData)) {
    const column = tableSchema.find((col) => col.column_name === key);

    if (!column) {
      errors.push(`Invalid column: ${key}`);
      continue;
    }

    // Validate data types
    switch (column.data_type) {
      case "integer":
        if (!Number.isInteger(Number(value)) && value !== null) {
          errors.push(`Column ${key} must be an integer`);
        }
        break;
      case "character varying":
        if (typeof value !== "string" && value !== null) {
          errors.push(`Column ${key} must be a string`);
        }
        if (
          column.character_maximum_length &&
          value &&
          value.length > column.character_maximum_length
        ) {
          errors.push(
            `Column ${key} exceeds maximum length of ${column.character_maximum_length}`
          );
        }
        break;
      // Add more data type validations as needed
    }
  }

  return errors;
};

exports.addRow = async (req, res) => {
  const { table_name, row_data } = req.body;
  const maker = req.user.user_id; // Get maker ID from JWT token

  try {
    // Basic validation
    if (!table_name || !row_data) {
      return res.status(400).json({
        success: false,
        message: "Required fields: table_name and row_data are missing.",
      });
    }

    // Validate table name format
    if (!validateTableName(table_name)) {
      return res.status(400).json({
        success: false,
        message: "Invalid table name format",
      });
    }

    // Validate table name length
    if (table_name.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Table name cannot exceed 50 characters",
      });
    }

    // Start a transaction
    await client_update.query("BEGIN");

    // Get table schema and validate row data
    const tableSchema = await getTableSchema(client_update, table_name);

    if (tableSchema.length === 0) {
      await client_update.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Table does not exist",
      });
    }

    const validationErrors = validateRowData(row_data, tableSchema);
    if (validationErrors.length > 0) {
      await client_update.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Data validation failed",
        errors: validationErrors,
      });
    }

    const request_id = uuidv4();

    // Insert into add_row_table
    const query = `
            INSERT INTO app.add_row_table (
                request_id, 
                table_name, 
                row_data, 
                status, 
                maker, 
                created_at, 
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *;
        `;

    const values = [
      request_id,
      table_name,
      JSON.stringify(row_data),
      "pending",
      maker,
    ];

    const result = await client_update.query(query, values);

    // Commit the transaction
    await client_update.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Row addition request created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    // Rollback in case of error
    await client_update.query("ROLLBACK");
    console.error("Error during row addition:", error);

    // Handle specific database errors
    if (error.code === "23505") {
      // Unique violation
      return res.status(409).json({
        success: false,
        message: "A row with this unique key already exists",
        error: error.detail,
      });
    }

    if (error.code === "23503") {
      // Foreign key violation
      return res.status(409).json({
        success: false,
        message: "Foreign key constraint violation",
        error: error.detail,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the row addition",
      error: error.message,
    });
  }
};
