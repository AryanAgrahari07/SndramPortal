const validateData = require('./dataValidation.js');

const validateBulkData = async (req, res, next) => {
  try {
    const { tableName, data } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: "Data must be an array"
      });
    }

    const validationErrors = [];

    // Validate each row in the bulk data
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Create a proper request object with all necessary properties
      const tempReq = {
        body: {
          table_name: tableName,
          new_values: row
        },
        user: req.user  // Pass through the user context
      };

      // Create a proper response object
      let validationError = null;
      const tempRes = {
        status: function(code) {
          return {
            json: function(data) {
              if (code === 400) {
                validationError = data;
              }
            }
          };
        }
      };

      // Create a next function that captures if validation passed
      let validationPassed = false;
      const tempNext = () => {
        validationPassed = true;
      };

      // Run validation for this row
      await validateData(tempReq, tempRes, tempNext);

      // If validation didn't pass, add to errors
      if (!validationPassed && validationError) {
        validationErrors.push({
          row: i + 1,
          ...validationError
        });
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }

    // Modify the original request body to use validated format
    req.body = {
      table_name: tableName,
      data: data
    };

    next();
  } catch (error) {
    console.error('Bulk validation error:', error);
    return res.status(500).json({
      success: false,
      message: "Error during bulk validation",
      error: error.message
    });
  }
};

module.exports = validateBulkData;