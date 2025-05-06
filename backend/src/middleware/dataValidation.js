const { client_update } = require('../configuration/database/databaseUpdate.js');

const validateField = async (columnName, value, dataType, validationRule) => {
  // Allow null/empty values if no validation rule exists
  if (!validationRule && (value === null || value === undefined || value === '')) {
    return null;
  }

  // Convert empty strings to null for proper handling
  if (value === '') {
    value = null;
  }

  // If value is null and validation rule exists, check if it's required
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();

  // SQL Injection Prevention
  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(['";])/i;
  if (sqlInjectionPattern.test(stringValue)) {
    return "Invalid input: Contains potentially harmful characters or keywords";
  }

  // Apply validation rules if they exist
  if (validationRule) {
    // Check for special characters
    if (validationRule.allow_special_chars === false) {
      const symbolRegex = /[!@#$%^&*()+=\[\]{};:'"\\|,.<>/?`~\-_]/;
      if (symbolRegex.test(stringValue)) {
        return validationRule.custom_error_message || "Special characters are not allowed in this field";
      }
    }

    // Check for numbers
    if (validationRule.allow_numbers === false) {
      const numberRegex = /\d/;
      if (numberRegex.test(stringValue)) {
        return validationRule.custom_error_message || "Numbers are not allowed in this field";
      }
    }

    // Check for spaces
    if (validationRule.allow_spaces === false) {
      if (stringValue.includes(' ')) {
        return validationRule.custom_error_message || "Spaces are not allowed in this field";
      }
    }

    // Check min length
    if (validationRule.min_length && stringValue.length < validationRule.min_length) {
      return `Minimum length should be ${validationRule.min_length} characters`;
    }

    // Check max length
    if (validationRule.max_length && stringValue.length > validationRule.max_length) {
      return `Maximum length should be ${validationRule.max_length} characters`;
    }

    // Check regex pattern if provided
    if (validationRule.regex_pattern) {
      try {
        const regex = new RegExp(validationRule.regex_pattern);
        if (!regex.test(stringValue)) {
          return validationRule.custom_error_message || "Input format is invalid";
        }
      } catch (error) {
        console.error('Invalid regex pattern:', error);
      }
    }
  }

  // Data type specific validations
  switch (dataType?.toLowerCase()) {
    case "integer":
      const numValue = Number(stringValue);
      if (isNaN(numValue) || !Number.isInteger(numValue)) {
        return "Must be a valid integer";
      }
      if (validationRule) {
        // Number sign validations
        if (validationRule.number_sign) {
          switch (validationRule.number_sign) {
            case 'positive':
              if (numValue <= 0) {
                return "Value must be positive (> 0)";
              }
              break;
            case 'negative':
              if (numValue >= 0) {
                return "Value must be negative (< 0)";
              }
              break;
            case 'non_negative':
              if (numValue < 0) {
                return "Value must be non-negative (≥ 0)";
              }
              break;
            case 'non_positive':
              if (numValue > 0) {
                return "Value must be non-positive (≤ 0)";
              }
              break;
          }
        }

        // Parity validations
        if (validationRule.parity && Number.isInteger(numValue)) {
          switch (validationRule.parity) {
            case 'even':
              if (numValue % 2 !== 0) {
                return "Value must be an even number";
              }
              break;
            case 'odd':
              if (numValue % 2 === 0) {
                return "Value must be an odd number";
              }
              break;
          }
        }

        if (typeof validationRule.min_value === 'number' && numValue < validationRule.min_value) {
          return `Value must be greater than or equal to ${validationRule.min_value}`;
        }
        if (typeof validationRule.max_value === 'number' && numValue > validationRule.max_value) {
          return `Value must be less than or equal to ${validationRule.max_value}`;
        }
        if (typeof validationRule.decimal_places === 'number') {
          const decimalParts = stringValue.split('.');
          if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
            return `Maximum ${validationRule.decimal_places} decimal places allowed`;
          }
        }
      }
      break;

    case "numeric":
    case "decimal":
      const numericValue = Number(stringValue);
      if (isNaN(numericValue)) {
        return "Must be a valid number";
      }
      if (validationRule) {
        // Number sign validations
        if (validationRule.number_sign) {
          switch (validationRule.number_sign) {
            case 'positive':
              if (numericValue <= 0) {
                return "Value must be positive (> 0)";
              }
              break;
            case 'negative':
              if (numericValue >= 0) {
                return "Value must be negative (< 0)";
              }
              break;
            case 'non_negative':
              if (numericValue < 0) {
                return "Value must be non-negative (≥ 0)";
              }
              break;
            case 'non_positive':
              if (numericValue > 0) {
                return "Value must be non-positive (≤ 0)";
              }
              break;
          }
        }

        // Parity validations
        if (validationRule.parity && Number.isInteger(numericValue)) {
          switch (validationRule.parity) {
            case 'even':
              if (numericValue % 2 !== 0) {
                return "Value must be an even number";
              }
              break;
            case 'odd':
              if (numericValue % 2 === 0) {
                return "Value must be an odd number";
              }
              break;
          }
        }

        if (typeof validationRule.min_value === 'number' && numericValue < validationRule.min_value) {
          return `Value must be greater than or equal to ${validationRule.min_value}`;
        }
        if (typeof validationRule.max_value === 'number' && numericValue > validationRule.max_value) {
          return `Value must be less than or equal to ${validationRule.max_value}`;
        }
        if (typeof validationRule.decimal_places === 'number') {
          const decimalParts = stringValue.split('.');
          if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
            return `Maximum ${validationRule.decimal_places} decimal places allowed`;
          }
        }
      }
      break;

    case "date":
    case "timestamp":
    case "timestamp without time zone":
    case "timestamp with time zone":
      const dateValue = new Date(stringValue);
      if (isNaN(dateValue.getTime())) {
        return "Must be a valid date";
      }
      if (validationRule) {
        // Date restriction validations
        if (validationRule.date_restriction) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          switch (validationRule.date_restriction) {
            case 'past':
              if (dateValue >= today) {
                return "Date must be in the past";
              }
              break;
            case 'future':
              if (dateValue <= today) {
                return "Date must be in the future";
              }
              break;
            case 'custom':
              if (validationRule.days_from_today) {
                const limitDate = new Date(today);
                limitDate.setDate(today.getDate() + validationRule.days_from_today);
                if (validationRule.days_from_today > 0) {
                  if (dateValue > limitDate) {
                    return `Date cannot be more than ${validationRule.days_from_today} days in the future`;
                  }
                } else {
                  if (dateValue < limitDate) {
                    return `Date cannot be more than ${Math.abs(validationRule.days_from_today)} days in the past`;
                  }
                }
              }
              break;
          }
        }

        if (validationRule.min_date && dateValue < new Date(validationRule.min_date)) {
          return `Date must be after ${new Date(validationRule.min_date).toLocaleDateString()}`;
        }
        if (validationRule.max_date && dateValue > new Date(validationRule.max_date)) {
          return `Date must be before ${new Date(validationRule.max_date).toLocaleDateString()}`;
        }
        if (validationRule.allow_weekends === false) {
          const day = dateValue.getDay();
          if (day === 0 || day === 6) {
            return "Weekend dates are not allowed";
          }
        }
      }
      break;

    case "uuid":
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(stringValue)) {
        return "Must be a valid UUID";
      }
      break;

    case "boolean":
      if (!["true", "false", "0", "1"].includes(stringValue.toLowerCase())) {
        return "Must be true or false";
      }
      break;

    case "character varying":
    case "text":
      if (validationRule) {
        // Case restriction validations
        if (validationRule.case_restriction) {
          switch (validationRule.case_restriction) {
            case 'uppercase':
              if (stringValue !== stringValue.toUpperCase()) {
                return "Value must be in uppercase";
              }
              break;
            case 'lowercase':
              if (stringValue !== stringValue.toLowerCase()) {
                return "Value must be in lowercase";
              }
              break;
          }
        }
      }
      break;
  }

  return null;
};

const getTableSchema = async (tableName) => {
  try {
    // First get the column information
    const columnQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'app'
      AND table_name = $1;
    `;
    const columnResult = await client_update.query(columnQuery, [tableName]);

    // Then get the validation rules
    const validationQuery = `
      SELECT *
      FROM app.column_validations
      WHERE table_name = $1
      AND is_active = true;
    `;
    const validationResult = await client_update.query(validationQuery, [tableName]);

    // Combine the information
    return columnResult.rows.map(column => ({
      ...column,
      validation_rule: validationResult.rows.find(rule => rule.column_name === column.column_name)
    }));
  } catch (error) {
    console.error('Error fetching table schema:', error);
    throw error;
  }
};

const validateData = async (req, res, next) => {
  try {
    const { table_name, row_data, new_values, old_values } = req.body;
    const dataToValidate = row_data || new_values;
    const oldData = old_values || {}; 

    if (!dataToValidate) {
      return next();
    }

    // Get table schema with validation rules
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

      const error = await validateField(
        columnName, 
        newValue, 
        columnSchema.data_type,
        columnSchema.validation_rule
      );
      
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