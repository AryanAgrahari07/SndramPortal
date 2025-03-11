const { client_update } = require('../configuration/database/databaseUpdate.js');
const { isSymbolAllowed } = require('./allowedcolumns/symbolAllowed.js');
const { isNumberAllowed } = require('./allowedcolumns/numberAllowed.js');
const { isSpaceAllowed } = require('./allowedcolumns/spaceAllowed.js');

  const validateField = async (columnName, value, dataType) => {
  if (value === null || value === undefined) {
    return null; // Allow null values if the database schema permits
  }

  const stringValue = String(value).trim();
  const normalizedColumn = columnName.toLowerCase();

  // SQL Injection Prevention
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(['";])/i;
  if (sqlInjectionPattern.test(stringValue)) {
    return "Invalid input: Contains potentially harmful characters or keywords";
  }

  if (dataType === 'text' || dataType?.includes('character varying')) {
    // Symbol validation
    if (!isSymbolAllowed(normalizedColumn)) {
      const symbolRegex = /[!@#$%^&*()+=\[\]{};:'"\\|,.<>/?`~\-_]/;
      if (symbolRegex.test(stringValue)) {
        return "Special characters are not allowed in this field";
      }
    }

    // Number validation
    if (!isNumberAllowed(normalizedColumn)) {
      const numberRegex = /\d/;
      if (numberRegex.test(stringValue)) {
        return "Numbers are not allowed in this field";
      }
    }

    // Space validation
    if (!isSpaceAllowed(columnName)) {
      if (stringValue.includes(' ')) {
        return "Spaces are not allowed in this field";
      }
    }

  }

  // Data type specific validations
  switch (dataType) {
    case "integer":
      const numValue = Number(stringValue);
      if (isNaN(numValue) || !Number.isInteger(numValue)) {
        return "Must be a valid integer";
      }
      break;

    case "date":
      const dateValue = new Date(stringValue);
      if (isNaN(dateValue.getTime())) {
        return "Must be a valid date";
      }
      break;

    case "uuid":
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(stringValue)) {
        return "Must be a valid UUID";
      }
      break;

    case "numeric":
    case "decimal":
      const numericValue = Number(stringValue);
      if (isNaN(numericValue)) {
        return "Must be a valid number";
      }
      break;

    case "boolean":
      if (!["true", "false", "0", "1"].includes(stringValue.toLowerCase())) {
        return "Must be true or false";
      }
      break;

    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone":
      const timestampValue = new Date(stringValue);
      if (isNaN(timestampValue.getTime())) {
        return "Must be a valid timestamp";
      }
      break;
  }

  return null; // No validation errors
};

const getTableSchema = async (tableName) => {
  const query = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'app'
    AND table_name = $1;
  `;
  const result = await client_update.query(query, [tableName]);
  return result.rows;
};

const validateData = async (req, res, next) => {
  try {
    const { table_name, row_data, new_values, old_values } = req.body;
    const dataToValidate = row_data || new_values;
    const oldData = old_values || {}; 

    if (!dataToValidate) {
      return next();
    }

    // Get table schema
    const tableSchema = await getTableSchema(table_name);
    if (!tableSchema.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid table name"
      });
    }

    const validationErrors = {};

    // Validate each field
    for (const [columnName, newValue] of Object.entries(dataToValidate)) {
      const oldValue = oldData[columnName];
      
      // Skip validation if the value hasn't changed
      if (oldValue === newValue || 
          (oldValue === null && newValue === '') || 
          (oldValue === '' && newValue === null)) {
        continue;
      }

      const columnSchema = tableSchema.find(col => col.column_name === columnName);
      
      if (!columnSchema) {
        validationErrors[columnName] = "Invalid column name";
        continue;
      }

      // Skip validation if field is empty and nullable
      if ((newValue === null || newValue === undefined || newValue === '' || newValue === 'null' || newValue === 'NULL') && 
           columnSchema.is_nullable === 'YES') {
        continue;
      }

      const error = await validateField(columnName, newValue, columnSchema.data_type);
      if (error) {
        validationErrors[columnName] = error;
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: "Error during data validation",
      error: error.message
    });
  }
};

module.exports = validateData;