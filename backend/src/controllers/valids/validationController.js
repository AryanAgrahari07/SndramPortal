const { client_update } = require("../../configuration/database/databaseUpdate");
const { v4: uuidv4, validate: validateUUID } = require('uuid');

// Get all validation rules for a table
exports.getTableValidationRules = async (req, res) => {
  try {
    const { tableName } = req.params;

    const query = `
      SELECT * FROM app.column_validations 
      WHERE table_name = $1 AND is_active = true
    `;
    const result = await client_update.query(query, [tableName]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching table validation rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation rules',
      error: error.message
    });
  }
};

// Get validation rules for a table/column
exports.getValidationRule = async (req, res) => {
  try {
    const { tableName, columnName } = req.params;

    const query = `
      SELECT * FROM app.column_validations 
      WHERE table_name = $1 AND column_name = $2 AND is_active = true
    `;
    const result = await client_update.query(query, [tableName, columnName]);

    if (result.rows.length === 0) {
      // Return default validation rule if none exists
      return res.json({
        success: true,
        data: {
          table_name: tableName,
          column_name: columnName,
          allow_numbers: true,
          allow_special_chars: true,
          allow_spaces: true,
          is_active: true
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation rule',
      error: error.message
    });
  }
};

// Create or update validation rule
exports.upsertValidationRule = async (req, res) => {
  try {
    const {
      validation_id,
      table_name,
      column_name,
      allow_numbers,
      allow_special_chars,
      allow_spaces,
      min_length,
      max_length,
      regex_pattern,
      custom_error_message,
      min_value,
      max_value,
      decimal_places,
      min_date,
      max_date,
      allow_weekends,
      is_active,
      date_restriction,
      days_in_past,
      days_in_future,
      case_restriction,
      number_sign,
      parity
    } = req.body;

    // Get column data type
    const typeQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = $1 
        AND column_name = $2
    `;
    const typeResult = await client_update.query(typeQuery, [table_name, column_name]);
    const data_type = typeResult.rows[0]?.data_type;

    // If date_restriction is 'custom', ensure days_in_past and days_in_future are handled correctly
    const finalDaysInPast = date_restriction === 'custom' ? days_in_past : null;
    const finalDaysInFuture = date_restriction === 'custom' ? days_in_future : null;

    const query = `
      INSERT INTO app.column_validations (
        table_name,
        column_name,
        data_type,
        allow_numbers,
        allow_special_chars,
        allow_spaces,
        min_length,
        max_length,
        regex_pattern,
        custom_error_message,
        min_value,
        max_value,
        decimal_places,
        min_date,
        max_date,
        allow_weekends,
        is_active,
        date_restriction,
        days_in_past,
        days_in_future,
        case_restriction,
        number_sign,
        parity,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        CASE 
          WHEN $18 = 'none' THEN NULL 
          WHEN $18 IN ('past', 'future', 'today', 'custom') THEN $18
          ELSE NULL 
        END,
        $19, $20, $21, $22, $23,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (table_name, column_name) DO UPDATE SET
        data_type = EXCLUDED.data_type,
        allow_numbers = EXCLUDED.allow_numbers,
        allow_special_chars = EXCLUDED.allow_special_chars,
        allow_spaces = EXCLUDED.allow_spaces,
        min_length = EXCLUDED.min_length,
        max_length = EXCLUDED.max_length,
        regex_pattern = EXCLUDED.regex_pattern,
        custom_error_message = EXCLUDED.custom_error_message,
        min_value = EXCLUDED.min_value,
        max_value = EXCLUDED.max_value,
        decimal_places = EXCLUDED.decimal_places,
        min_date = EXCLUDED.min_date,
        max_date = EXCLUDED.max_date,
        allow_weekends = EXCLUDED.allow_weekends,
        is_active = EXCLUDED.is_active,
        date_restriction = EXCLUDED.date_restriction,
        days_in_past = EXCLUDED.days_in_past,
        days_in_future = EXCLUDED.days_in_future,
        case_restriction = EXCLUDED.case_restriction,
        number_sign = EXCLUDED.number_sign,
        parity = EXCLUDED.parity,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      table_name,
      column_name,
      data_type,
      allow_numbers,
      allow_special_chars,
      allow_spaces,
      min_length,
      max_length,
      regex_pattern,
      custom_error_message,
      min_value,
      max_value,
      decimal_places,
      min_date,
      max_date,
      allow_weekends,
      is_active,
      date_restriction,
      finalDaysInPast,
      finalDaysInFuture,
      case_restriction,
      number_sign,
      parity
    ];

    const result = await client_update.query(query, values);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error upserting validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save validation rule',
      error: error.message
    });
  }
};

// Delete validation rule
exports.deleteValidationRule = async (req, res) => {
  try {
    const { tableName, columnName } = req.params;

    const query = `
      DELETE FROM app.column_validations 
      WHERE table_name = $1 AND column_name = $2
      RETURNING *
    `;
    const result = await client_update.query(query, [tableName, columnName]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Validation rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Validation rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete validation rule',
      error: error.message
    });
  }
};

// Toggle validation rule status
exports.toggleValidationRule = async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    const { is_active } = req.body;

    const query = `
      UPDATE app.column_validations 
      SET is_active = $3, updated_at = CURRENT_TIMESTAMP
      WHERE table_name = $1 AND column_name = $2
      RETURNING *
    `;
    const result = await client_update.query(query, [tableName, columnName, is_active]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Validation rule not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling validation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle validation rule',
      error: error.message
    });
  }
};

// Validate dropdown value against column validation rules
exports.validateDropdownValue = async (req, res) => {
  try {
    const { tableName, columnName, value } = req.body;

    if (!tableName || !columnName || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tableName, columnName, value'
      });
    }

    // Get column data type
    const typeQuery = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'app' 
        AND table_name = $1 
        AND column_name = $2
    `;
    const typeResult = await client_update.query(typeQuery, [tableName, columnName]);
    
    if (typeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Column ${columnName} not found in table ${tableName}`
      });
    }
    
    const dataType = typeResult.rows[0]?.data_type;

    // Get validation rule
    const validationQuery = `
      SELECT *
      FROM app.column_validations
      WHERE table_name = $1
        AND column_name = $2
        AND is_active = true;
    `;
    const validationResult = await client_update.query(validationQuery, [tableName, columnName]);
    const validationRule = validationResult.rows[0];

    // Import the validation function
    const validateField = require('../../middleware/dataValidation').validateField;
    if (!validateField) {
      // If function is not directly accessible, recreate the validation logic here
      const { validateField: importedValidateField } = require('../../middleware/dataValidation');
      
      if (!importedValidateField) {
        throw new Error('validateField function not available');
      }
      
      const error = await importedValidateField(columnName, value, dataType, validationRule);
      
      return res.json({
        success: true,
        isValid: !error,
        error: error
      });
    }
    
    // Validate the value
    const error = await validateField(columnName, value, dataType, validationRule);
    
    return res.json({
      success: true,
      isValid: !error,
      error: error
    });
    
  } catch (error) {
    console.error('Error validating dropdown value:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate dropdown value',
      error: error.message
    });
  }
};