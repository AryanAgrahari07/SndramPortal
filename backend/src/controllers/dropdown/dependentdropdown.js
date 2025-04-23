const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { v4: uuidv4 } = require('uuid');

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
            
            // If it's a dependent dropdown, verify parent column exists
            // if (option.parentColumn) {
            //     const parentColumnExists = dropdown_options.some(opt => opt.columnName === option.parentColumn);
                // if (!parentColumnExists) {
                //     return res.status(400).json({
                //         success: false,
                //         message: `Parent column ${option.parentColumn} for ${option.columnName} not found in configuration`
                //     });
                // }
                
                // Validate parent references in options
                // if (Array.isArray(option.options)) {
                //     for (const opt of option.options) {
                //         if (typeof opt === 'object' && !opt.parent) {
                //             return res.status(400).json({
                //                 success: false,
                //                 message: `Options for dependent column ${option.columnName} must have parent property`
                //             });
                //         }
                //     }
                // }
            // }
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