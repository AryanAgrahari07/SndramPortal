const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { v4: uuidv4 } = require('uuid');

exports.updateColumnDropDown = async (req, res) => {
    try {
        const { table_name, dropdown_options } = req.body;

        if (!table_name || !Array.isArray(dropdown_options)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input. Provide table_name and dropdown_options as an array of objects.',
            });
        }

        // Validate dropdown options structure
        for (const option of dropdown_options) {
            if (!option.columnName) {
                return res.status(400).json({
                    success: false,
                    message: "Each option must have a columnName property"
                });
            }
            
            if (!option.options) {
                return res.status(400).json({
                    success: false,
                    message: `Options for column ${option.columnName} are required`
                });
            }
            
            // If it's a dependent dropdown, verify parent column exists
            if (option.parentColumn) {
                const parentColumnExists = dropdown_options.some(opt => opt.columnName === option.parentColumn);
                if (!parentColumnExists) {
                    return res.status(400).json({
                        success: false,
                        message: `Parent column ${option.parentColumn} for ${option.columnName} not found in configuration`
                    });
                }
                
                // Validate parent references in options
                if (Array.isArray(option.options)) {
                    for (const opt of option.options) {
                        if (typeof opt === 'object' && !opt.parent) {
                            return res.status(400).json({
                                success: false,
                                message: `Options for dependent column ${option.columnName} must have parent property`
                            });
                        }
                    }
                }
            }
        }

        const queryCheckTable = `
            SELECT dropdown_options, row_id
            FROM app.dynamic_dropdowns 
            WHERE table_name = $1;
        `;

        const queryInsert = `
            INSERT INTO app.dynamic_dropdowns (table_name, dropdown_options, created_at, updated_at, row_id)
            VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3);
        `;

        const queryUpdate = `
            UPDATE app.dynamic_dropdowns
            SET dropdown_options = $1::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE row_id = $2;
        `;

        // Check if the table exists
        const result = await client_update.query(queryCheckTable, [table_name]);

        if (result.rows.length > 0) {
            // Table exists, get existing dropdown_options for logging
            let existingOptions = result.rows[0].dropdown_options || [];
            
            // Add old_options to request body for logging middleware
            req.body.old_options = existingOptions;
            
            const rowId = result.rows[0].row_id;

            // Merge incoming dropdown_options into existingOptions
            dropdown_options.forEach(newOption => {
                const existingIndex = existingOptions.findIndex(
                    item => item.columnName === newOption.columnName
                );

                if (existingIndex > -1) {
                    // Update existing column configuration
                    existingOptions[existingIndex] = {
                        ...existingOptions[existingIndex],
                        options: newOption.options,
                        // Update parentColumn if provided
                        ...(newOption.parentColumn ? { parentColumn: newOption.parentColumn } : {}),
                        // Remove parentColumn if it was previously set but now should be removed
                        ...(!newOption.parentColumn && existingOptions[existingIndex].parentColumn 
                            ? { parentColumn: undefined } 
                            : {})
                    };
                } else {
                    // Column does not exist, add new column
                    existingOptions.push(newOption);
                }
            });

            // Update the table with merged dropdown_options
            await client_update.query(queryUpdate, [
                JSON.stringify(existingOptions),
                rowId,
            ]);
        } else {
            // Table does not exist, insert new row
            // No previous options to compare for logging
            req.body.old_options = [];
            
            const rowId = uuidv4();
            await client_update.query(queryInsert, [
                table_name,
                JSON.stringify(dropdown_options),
                rowId
            ]);
        }

        res.status(200).json({
            success: true,
            message: 'Dropdown options updated successfully.',
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the request',
            error: error.message,
        });
    }
};