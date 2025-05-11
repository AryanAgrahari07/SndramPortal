const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { v4: uuidv4 } = require('uuid');
const { validateField } = require('../../middleware/dataValidation.js');

/**
 * Get dropdown configuration for a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDropdownConfig = async (req, res) => {
    const { tableName } = req.params;
    
    try {
        // Check if table exists in information_schema
        const tableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `;
        
        const tableCheck = await client_update.query(tableQuery, [tableName]);
        
        if (!tableCheck.rows[0].exists) {
            return res.status(404).json({
                success: false,
                message: `Table ${tableName} not found`
            });
        }
        
        // Get dropdown configuration
        const query = `
            SELECT dropdown_options 
            FROM app.dynamic_dropdowns 
            WHERE table_name = $1;
        `;
        
        const result = await client_update.query(query, [tableName]);
        
        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No dropdown configuration found for this table",
                dropdownOptions: []
            });
        }
        
        // Extract relationships between columns
        const dropdownOptions = result.rows[0].dropdown_options;
        const relationships = [];
        
        dropdownOptions.forEach(option => {
            if (option.parentColumn) {
                relationships.push({
                    parentColumn: option.parentColumn,
                    childColumn: option.columnName
                });
            }
        });
        
        return res.status(200).json({
            success: true,
            dropdownOptions: dropdownOptions,
            relationships: relationships
        });
    } catch (error) {
        console.error("Error fetching dropdown configuration:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dropdown configuration",
            error: error.message
        });
    }
};

/**
 * Get filtered options based on parent value
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFilteredOptions = async (req, res) => {
    const { tableName, columnName, parentValue } = req.params;
  
    try {
      // Get dropdown configuration from the database
      const result = await client_update.query(
        "SELECT dropdown_options FROM app.dynamic_dropdowns WHERE table_name = $1",
        [tableName]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No dropdown configuration found for this table"
        });
      }
      
      const dropdownConfig = result.rows[0].dropdown_options;
      
      // Find the column configuration
      const columnConfig = dropdownConfig.find(config => config.columnName === columnName);
      
      if (!columnConfig) {
        return res.status(404).json({
          success: false,
          message: `No dropdown configuration found for column ${columnName}`
        });
      }
      
      // Check if it's a dependent dropdown
      if (!columnConfig.parentColumn) {
        return res.status(400).json({
          success: false,
          message: `Column ${columnName} is not configured as a dependent dropdown`
        });
      }
      
      // Get two types of options:
      // 1. Options that match the specific parent value
      // 2. Options with null parent (shared options that should appear for all parents)
      let filteredOptions = [];
      
      if (Array.isArray(columnConfig.options)) {
        // Get parent-specific options
        const parentSpecificOptions = columnConfig.options
          .filter(opt => typeof opt === 'object' && opt.parent === parentValue)
          .map(opt => opt.value);
        
        // Get shared options (with explicitly null parent)
        const sharedOptions = columnConfig.options
          .filter(opt => typeof opt === 'object' && (opt.parent === null))
          .map(opt => opt.value);
        
        // Combine both sets
        filteredOptions = [...parentSpecificOptions, ...sharedOptions];
      }
      
      return res.status(200).json({
        success: true,
        options: filteredOptions
      });
    } catch (error) {
      console.error("Error fetching filtered options:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch filtered options",
        error: error.message
      });
    }
  };

/**
 * Update dropdown configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateDropdownConfig = async (req, res) => {
    // Verify admin role (should be handled by middleware already)
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Only admin users can update dropdown configurations"
        });
    }
    
    const { tableName } = req.params;
    const { dropdown_options } = req.body;
    
    if (!Array.isArray(dropdown_options)) {
        return res.status(400).json({
            success: false,
            message: "dropdown_options must be an array"
        });
    }
    
    try {
        // Validate dropdown options structure
        for (const option of dropdown_options) {
            if (!option.columnName) {
                return res.status(400).json({
                    success: false,
                    message: "Each option must have a columnName property"
                });
            }
            
            if (!option.options || (!Array.isArray(option.options) && typeof option.options !== 'object')) {
                return res.status(400).json({
                    success: false,
                    message: `Options for column ${option.columnName} must be an array or object`
                });
            }
            
            // Get column data type for validation
            const typeQuery = `
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'app' 
                AND table_name = $1 
                AND column_name = $2;
            `;
            const typeResult = await client_update.query(typeQuery, [tableName, option.columnName]);
            
            if (typeResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Column ${option.columnName} not found in table ${tableName}`
                });
            }
            
            const dataType = typeResult.rows[0].data_type;
            
            // Get validation rule if it exists
            const validationQuery = `
                SELECT *
                FROM app.column_validations
                WHERE table_name = $1
                AND column_name = $2
                AND is_active = true;
            `;
            const validationResult = await client_update.query(validationQuery, [tableName, option.columnName]);
            const validationRule = validationResult.rows[0];
            
            // Validate every option if it's a simple string array
            if (Array.isArray(option.options) && typeof option.options[0] === 'string') {
                for (let i = 0; i < option.options.length; i++) {
                    const value = option.options[i];
                    
                    // Validate the value against validation rules
                    const error = await validateField(
                        option.columnName,
                        value,
                        dataType,
                        validationRule
                    );
                    
                    if (error) {
                        return res.status(400).json({
                            success: false,
                            message: `Validation error for option "${value}" in column ${option.columnName}: ${error}`
                        });
                    }
                }
            }
            // Validate each option.value if it's an array of objects
            else if (Array.isArray(option.options) && typeof option.options[0] === 'object') {
                for (let i = 0; i < option.options.length; i++) {
                    const optObj = option.options[i];
                    
                    if (!optObj.value) {
                        return res.status(400).json({
                            success: false,
                            message: `Option at index ${i} in column ${option.columnName} is missing 'value' property`
                        });
                    }
                    
                    // Validate the value against validation rules
                    const error = await validateField(
                        option.columnName,
                        optObj.value,
                        dataType,
                        validationRule
                    );
                    
                    if (error) {
                        return res.status(400).json({
                            success: false,
                            message: `Validation error for option "${optObj.value}" in column ${option.columnName}: ${error}`
                        });
                    }
                }
            }
        }
        
        // Check if configuration already exists
        const query = `
            SELECT row_id 
            FROM app.dynamic_dropdowns 
            WHERE table_name = $1;
        `;
        
        const checkResult = await client_update.query(query, [tableName]);
        
        const now = new Date();
        
        if (checkResult.rows.length > 0) {
            // Update existing configuration
            const rowId = checkResult.rows[0].row_id;
            
            const updateQuery = `
                UPDATE app.dynamic_dropdowns 
                SET dropdown_options = $1::jsonb, 
                    updated_at = $2 
                WHERE row_id = $3;
            `;
            
            await client_update.query(updateQuery, [
                JSON.stringify(dropdown_options),
                now,
                rowId
            ]);
        } else {
            // Insert new configuration
            const rowId = uuidv4();
            
            const insertQuery = `
                INSERT INTO app.dynamic_dropdowns 
                (table_name, dropdown_options, created_at, updated_at, row_id) 
                VALUES ($1, $2::jsonb, $3, $4, $5);
            `;
            
            await client_update.query(insertQuery, [
                tableName,
                JSON.stringify(dropdown_options),
                now,
                now,
                rowId
            ]);
        }
        
        return res.status(200).json({
            success: true,
            message: "Dropdown configuration updated successfully"
        });
    } catch (error) {
        console.error("Error updating dropdown configuration:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update dropdown configuration",
            error: error.message
        });
    }
};

/**
 * Bulk upload dropdown options from CSV
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.bulkUploadDropdownOptions = async (req, res) => {
    // Verify admin role (should be handled by middleware already)
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Only admin users can update dropdown configurations"
        });
    }
    
    const { tableName } = req.params;
    const { columnName, parentColumn, options, newParentValues = [], autoAddNewParentValues = false } = req.body;
    
    // console.log("Received bulk upload request:", {
    //     tableName,
    //     columnName,
    //     parentColumn,
    //     optionsCount: options?.length || 0
    // });
    
    if (!columnName || !parentColumn) {
        return res.status(400).json({
            success: false,
            message: "columnName and parentColumn are required"
        });
    }
    
    if (!Array.isArray(options)) {
        return res.status(400).json({
            success: false,
            message: "options must be an array of {parent_value, option_value} objects"
        });
    }
    
    try {
        // Get column data type for validation
        const typeQuery = `
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'app' 
            AND table_name = $1 
            AND column_name = $2;
        `;
        const typeResult = await client_update.query(typeQuery, [tableName, columnName]);
        
        if (typeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Column ${columnName} not found in table ${tableName}`
            });
        }
        
        const dataType = typeResult.rows[0].data_type;
        
        // Get validation rule if it exists
        const validationQuery = `
            SELECT *
            FROM app.column_validations
            WHERE table_name = $1
            AND column_name = $2
            AND is_active = true;
        `;
        const validationResult = await client_update.query(validationQuery, [tableName, columnName]);
        const validationRule = validationResult.rows[0];
        
        // Get existing configuration
        const query = `
            SELECT row_id, dropdown_options 
            FROM app.dynamic_dropdowns 
            WHERE table_name = $1;
        `;
        
        const result = await client_update.query(query, [tableName]);
        const now = new Date();
        
        // Validate each option - reject rows where either field is missing
        const validOptions = [];
        const invalidOptions = [];
        
        for (const opt of options) {
            if (!opt.parent_value || !opt.parent_value.trim() || 
                !opt.option_value || !opt.option_value.trim()) {
                invalidOptions.push({
                    option: opt,
                    reason: "Missing parent_value or option_value"
                });
                continue;
            }
            
            // Validate the option_value against validation rules
            const error = await validateField(
                columnName,
                opt.option_value.trim(),
                dataType,
                validationRule
            );
            
            if (error) {
                invalidOptions.push({
                    option: opt,
                    reason: error
                });
                continue;
            }
            
            validOptions.push(opt);
        }
        
        // console.log("Valid options count:", validOptions.length);
        // console.log("Invalid options count:", invalidOptions.length);
        
        if (validOptions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid options provided after validation",
                invalidOptions: invalidOptions
            });
        }
        
        // Get all existing parent column values to validate against
        let parentColumnValues = [];
        let allOptions = [];
        let parentColumnConfig = null;
        
        try {
            // First check if we have parent dropdown values defined
            const parentValuesQuery = `
                SELECT dropdown_options 
                FROM app.dynamic_dropdowns 
                WHERE table_name = $1;
            `;
            
            const parentValuesResult = await client_update.query(parentValuesQuery, [tableName]);
            
            if (parentValuesResult.rows.length > 0) {
                allOptions = parentValuesResult.rows[0].dropdown_options || [];
                // Find the parent column configuration
                parentColumnConfig = allOptions.find(opt => opt.columnName === parentColumn);
                
                if (parentColumnConfig && Array.isArray(parentColumnConfig.options)) {
                    // Extract parent values
                    parentColumnValues = parentColumnConfig.options.map(opt => 
                        typeof opt === 'string' ? opt.toLowerCase() : opt.value.toLowerCase()
                    );
                    
                    // console.log(`Found ${parentColumnValues.length} parent values for validation`);
                }
            }
        } catch (error) {
            console.error("Error fetching parent column values:", error);
            // Continue processing as we can still handle 'shared' values
        }
        
        // Track new parent values that need to be added
        const newParentValuesToAdd = new Set();
        
        // If autoAddNewParentValues is enabled, process newParentValues
        if (autoAddNewParentValues && Array.isArray(newParentValues) && newParentValues.length > 0) {
            // Add new parent values that don't already exist
            for (const newParent of newParentValues) {
                if (newParent && typeof newParent === 'string' && 
                    !parentColumnValues.includes(newParent.toLowerCase())) {
                    newParentValuesToAdd.add(newParent);
                }
            }
        }
        
        // Additional validation for parent values that aren't 'shared'
        const invalidParentValues = [];
        const finalValidOptions = validOptions.filter(opt => {
            // Skip validation for 'shared' parent values
            if (opt.parent_value.toLowerCase() === 'shared') {
                return true;
            }
            
            // Skip validation if we couldn't retrieve parent values
            if (parentColumnValues.length === 0) {
                return true;
            }
            
            // Check if parent value exists or is going to be added as a new parent value
            const parentExists = parentColumnValues.includes(opt.parent_value.toLowerCase()) || 
                                 newParentValuesToAdd.has(opt.parent_value);
            
            if (!parentExists && !autoAddNewParentValues) {
                invalidParentValues.push(opt.parent_value);
                return false;
            }
            
            // If autoAddNewParentValues is true, accept this option and add parent to list of new ones
            if (!parentExists && autoAddNewParentValues) {
                newParentValuesToAdd.add(opt.parent_value);
            }
            
            return true;
        });
        
        if (invalidParentValues.length > 0 && !autoAddNewParentValues) {
            // console.log(`Rejected ${invalidParentValues.length} options with invalid parent values`);
        }
        
        if (finalValidOptions.length === 0) {
            return res.status(400).json({
                success: false,
                message: invalidParentValues.length > 0 
                    ? `All options have invalid parent values. Valid parent values are required.` 
                    : "No valid options provided after validation"
            });
        }
        
        // Track statistics for response message
        let addedCount = 0;
        let skippedDuplicates = 0;
        let sharedCount = 0;
        let newParentsAdded = 0;
        
        // Process the options from CSV
        const processedOptions = [];
        const sharedOptions = new Set(); // For keeping track of unique shared options
        
        // Get existing column options if any
        let existingOptions = [];
        let existingColumnOptions = [];
        
        if (result.rows.length > 0) {
            existingOptions = result.rows[0].dropdown_options || [];
            const existingColumnConfig = existingOptions.find(opt => opt.columnName === columnName);
            
            if (existingColumnConfig && Array.isArray(existingColumnConfig.options)) {
                existingColumnOptions = existingColumnConfig.options;
                
                // Add existing options to processedOptions and track shared options
                existingColumnOptions.forEach(opt => {
                    // Add all existing options to our processed list
                    processedOptions.push(opt);
                    
                    // Track existing shared options (with parent = null)
                    if (opt.parent === null && opt.value) {
                        sharedOptions.add(opt.value.toLowerCase());
                    }
                });
            }
        }
        
        // First, extract shared options (parent_value = "shared")
        finalValidOptions.forEach(opt => {
            if (opt.parent_value && opt.parent_value.toLowerCase() === 'shared') {
                const optionValue = opt.option_value.trim();
                
                // Check if this shared option already exists (case insensitive)
                if (!sharedOptions.has(optionValue.toLowerCase())) {
                    sharedOptions.add(optionValue.toLowerCase());
                    
                    // Check if it doesn't already exist in processedOptions
                    const exists = processedOptions.some(
                        existing => existing.value && 
                        existing.value.toLowerCase() === optionValue.toLowerCase() && 
                        existing.parent === null
                    );
                    
                    if (!exists) {
                        processedOptions.push({
                            value: optionValue,
                            parent: null
                        });
                        sharedCount++;
                        addedCount++;
                    } else {
                        skippedDuplicates++;
                    }
                } else {
                    skippedDuplicates++;
                }
            }
        });
        
        // Then process parent-specific options
        finalValidOptions.forEach(opt => {
            if (opt.parent_value && opt.option_value && 
                opt.parent_value.toLowerCase() !== 'shared') {
                
                const parentValue = opt.parent_value.trim();
                const optionValue = opt.option_value.trim();
                
                // Check if this is already added as a shared option
                if (sharedOptions.has(optionValue.toLowerCase())) {
                    skippedDuplicates++; // Skip if already a shared option
                    return;
                }
                
                // Check if this parent-specific option already exists
                const exists = processedOptions.some(
                    existing => existing.value && existing.parent &&
                    existing.value.toLowerCase() === optionValue.toLowerCase() && 
                    existing.parent.toLowerCase() === parentValue.toLowerCase()
                );
                
                if (!exists) {
                    processedOptions.push({
                        value: optionValue,
                        parent: parentValue
                    });
                    addedCount++;
                } else {
                    skippedDuplicates++;
                }
            }
        });
        
        // Now add new parent values to the parent column dropdown options
        if (newParentValuesToAdd.size > 0 && parentColumnConfig) {
            for (const newParentValue of newParentValuesToAdd) {
                const parentOptionExists = parentColumnConfig.options.some(
                    opt => typeof opt === 'string' 
                        ? opt.toLowerCase() === newParentValue.toLowerCase()
                        : opt.value.toLowerCase() === newParentValue.toLowerCase()
                );
                
                if (!parentOptionExists) {
                    // Add the new parent value to the parent column options
                    // Use the same format as existing options (string or object)
                    if (typeof parentColumnConfig.options[0] === 'string') {
                        parentColumnConfig.options.push(newParentValue);
                    } else {
                        parentColumnConfig.options.push({
                            value: newParentValue
                        });
                    }
                    newParentsAdded++;
                }
            }
            
            // console.log(`Added ${newParentsAdded} new parent values to ${parentColumn} dropdown options`);
        }
        
        if (result.rows.length > 0) {
            // Update existing configuration
            const rowId = result.rows[0].row_id;
            let allUpdatedOptions = [...existingOptions]; // Copy existing options array
            
            // Find if this column already has configuration
            const existingIndex = allUpdatedOptions.findIndex(
                item => item.columnName === columnName
            );
            
            // console.log("Existing configuration:", {
            //     hasExistingConfig: existingIndex > -1,
            //     existingColumnIndex: existingIndex,
            //     processedOptionsCount: processedOptions.length
            // });
            
            if (existingIndex > -1) {
                // Update existing column configuration
                allUpdatedOptions[existingIndex] = {
                    ...allUpdatedOptions[existingIndex],
                    options: processedOptions, // Use merged options array
                    parentColumn: parentColumn
                };
            } else {
                // Column does not exist, add new column
                allUpdatedOptions.push({
                    columnName: columnName,
                    options: processedOptions,
                    parentColumn: parentColumn
                });
            }
            
            // If we need to update the parent column options, find and update that configuration
            if (newParentsAdded > 0) {
                const parentIndex = allUpdatedOptions.findIndex(
                    item => item.columnName === parentColumn
                );
                
                if (parentIndex > -1) {
                    // Update parent column with new parent values
                    allUpdatedOptions[parentIndex] = parentColumnConfig;
                }
            }
            
            // Update the table
            const updateQuery = `
                UPDATE app.dynamic_dropdowns 
                SET dropdown_options = $1::jsonb, 
                    updated_at = $2 
                WHERE row_id = $3;
            `;
            
            try {
                await client_update.query(updateQuery, [
                    JSON.stringify(allUpdatedOptions),
                    now,
                    rowId
                ]);
                // console.log("Successfully updated dropdown options in database");
            } catch (dbError) {
                console.error("Database update error:", dbError);
                throw dbError;
            }
        } else {
            // Insert new configuration
            const rowId = uuidv4();
            const newOptions = [{
                columnName: columnName,
                options: processedOptions,
                parentColumn: parentColumn
            }];
            
            // If we have new parent values, add the parent column configuration
            if (newParentsAdded > 0 && parentColumnConfig) {
                newOptions.push(parentColumnConfig);
            }
            
            const insertQuery = `
                INSERT INTO app.dynamic_dropdowns 
                (table_name, dropdown_options, created_at, updated_at, row_id) 
                VALUES ($1, $2::jsonb, $3, $4, $5);
            `;
            
            await client_update.query(insertQuery, [
                tableName,
                JSON.stringify(newOptions),
                now,
                now,
                rowId
            ]);
        }
        
        return res.status(200).json({
            success: true,
            message: `Successfully processed options: ${addedCount} added, ${skippedDuplicates} skipped (duplicates)${invalidParentValues.length > 0 ? `, ${invalidParentValues.length} rejected (invalid parent values)` : ''}${newParentsAdded > 0 ? `, ${newParentsAdded} new parent values added` : ''}`,
            added: addedCount,
            skipped: skippedDuplicates,
            rejected: invalidParentValues.length,
            shared: sharedCount,
            newParentsAdded: newParentsAdded
        });
    } catch (error) {
        console.error("Error bulk uploading dropdown options:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to bulk upload dropdown options",
            error: error.message
        });
    }
};