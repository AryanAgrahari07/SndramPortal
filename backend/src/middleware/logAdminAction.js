const { client_update } = require('../configuration/database/databaseUpdate');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to log admin actions
 * @param {string} actionType - Type of action (CREATE, UPDATE, DELETE)
 * @param {string} section - Section where action is performed
 * @returns {Function} Middleware function
 */
const logAdminAction = (actionType, section) => {
    return async (req, res, next) => {
        // Store the original json function
        const originalJson = res.json;
        
        // Override the json function to capture response data
        res.json = async function(data) {
            // Store response data for use in extract functions
            req.responseData = data;
            
            // Restore the original json function
            res.json = originalJson;
            
            try {
                // Only log if the user is an admin
                if (req.user && req.user.role === 'admin') {
                    const adminId = req.user.user_id;
                    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
                    
                    // Skip logging certain GET requests that don't modify data
                    if (section === 'COLUMN_PERMISSION' && 
                        req.body.action === 'get' && 
                        req.method === 'POST') {
                        // Just call the original json function and return
                        return res.json.apply(res, arguments);
                    }
                    
                    // Prepare action details
                    const actionDetails = {
                        requestBody: req.body,
                        response: data
                    };

                    // Extract target table and id if available
                    let targetTable = null;
                    let targetId = null;
                    
                    // Try to determine the target table from request
                    if (req.body.table_name) {
                        targetTable = req.body.table_name;
                    } else if (req.body.tableName) {
                        targetTable = req.body.tableName;
                    } else if (req.body.original_table_name) {
                        targetTable = req.body.original_table_name;
                    } else if (section === 'USER_MANAGEMENT') {
                        targetTable = 'app.users';
                        targetId = req.body.user_id || req.params.id;
                    } else if (section === 'DROPDOWN_MANAGEMENT' && req.params.tableName) {
                        // Extract table name from URL parameters for dropdown management
                        targetTable = req.params.tableName;
                    } else if (section === 'VALIDATION_CONFIG' && req.params.tableName) {
                        targetTable = req.params.tableName;
                    } else if (section === 'COLUMN_RENAME') {
                        targetTable = req.body.table_name || req.params.table_name;
                    } else if (section === 'TABLE_CONFIG' && req.params.id) {
                        // For table metadata updates by ID, extract the original table name
                        targetTable = req.body.original_table_name;
                    } else if (req.originalUrl) {
                        // Extract from URL if possible
                        const urlParts = req.originalUrl.split('/');
                        if (urlParts.length > 2) {
                            // Handle special case for API routes
                            if (urlParts[1] === 'api' && urlParts[2] === 'admin') {
                                if (urlParts[3] === 'dropdowns' && urlParts[4]) {
                                    targetTable = urlParts[4]; // The table name is the 4th part of the URL
                                } else if (urlParts[3] === 'validations' && urlParts[4]) {
                                    targetTable = urlParts[4]; // The table name is the 4th part of the URL
                                }
                            } else {
                                targetTable = urlParts[1];
                            }
                            if (urlParts[2] && !urlParts[2].includes('?')) {
                                targetId = urlParts[2];
                            }
                        }
                    }
                    
                    // For tables that store their names differently
                    if (section === 'COLUMN_RENAME' && !targetTable) {
                        targetTable = req.body.table_name;
                    }
                    
                    // Check if we have the new data structure with previous/current data
                    if (data && data.data && data.data.previous && data.data.current) {
                        // Extract old and new data from the new structure
                        actionDetails.oldData = data.data.previous;
                        actionDetails.newData = data.data.current;
                    }
                    // Fallback to old structure if available
                    else if (req.body.oldData) {
                        actionDetails.oldData = req.body.oldData;
                    }
                    
                    if (req.body.newData && !actionDetails.newData) {
                        actionDetails.newData = req.body.newData;
                    }
                    
                    // Determine if the action was successful
                    const status = data.success === false ? 'failed' : 'completed';
                    
                    // For user management, enhance details
                    let additionalInfo = null;
                    if (section === 'USER_MANAGEMENT') {
                        additionalInfo = extractUserDetails(req.body, actionType, req);
                    } else if (section === 'GROUP_MANAGEMENT') {
                        additionalInfo = extractGroupDetails(req.body, actionType, req);
                    } else if (section === 'COLUMN_PERMISSION') {
                        additionalInfo = extractColumnPermissionDetails(req.body, actionType, req);
                    } else if (section === 'VALIDATION_CONFIG') {
                        additionalInfo = extractValidationDetails(req.body, actionType, req);
                    } else if (section === 'DROPDOWN_MANAGEMENT') {
                        additionalInfo = extractDropdownDetails(req.body, actionType, req);
                    } else if (section === 'COLUMN_RENAME') {
                        additionalInfo = extractColumnRenameDetails(req.body, actionType, req);
                    } else if (section === 'TABLE_CONFIG') {
                        additionalInfo = extractTableConfigDetails(req.body, actionType, req);
                    }
                    
                    // Insert log into database
                    const query = `
                        INSERT INTO app.admin_action_logs 
                        (log_id, admin_id, action_type, section, action_details, ip_address, target_table, target_id, status, additional_info)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `;
                    
                    const values = [
                        uuidv4(),
                        adminId,
                        actionType,
                        section,
                        actionDetails,
                        ipAddress,
                        targetTable,
                        targetId,
                        status,
                        additionalInfo
                    ];
                    
                    await client_update.query(query, values);
                }
            } catch (error) {
                console.error('Error logging admin action:', error);
                // Don't break the main request flow if logging fails
            }
            
            // Call the original json function
            return res.json.apply(res, arguments);
        };
        
        next();
    };
};

// Helper functions to extract detailed information

function extractUserDetails(body, actionType, req) {
    const details = {};
    const response = req.responseData || {};
    
    if (actionType === 'CREATE') {
        details.email = body.email;
        details.first_name = body.first_name;
        details.last_name = body.last_name;
        details.role = body.role;
    } else if (actionType === 'UPDATE') {
        // Check for the new data structure that includes previous and current data
        const responseData = response?.data || {};
        
        if (responseData.previous && responseData.current) {
            // New format - with previous/current data and changes array
            details.email = responseData.current.email || body.email;
            details.user_id = responseData.current.user_id || body.user_id || body.id;
            
            // Check for activation/deactivation
            if (responseData.previous.active !== responseData.current.active) {
                if (responseData.current.active) {
                    details.action = 'User Activated';
                } else {
                    details.action = 'User Deactivated';
                }
            }
            
            // Include the changes array if available
            if (responseData.changes && Array.isArray(responseData.changes)) {
                details.changes = responseData.changes;
            } else {
                // Create changes array manually if not provided
                details.changes = [];
                
                // Compare fields
                const compareFields = ['email', 'role', 'first_name', 'last_name', 'active'];
                compareFields.forEach(field => {
                    if (responseData.previous[field] !== responseData.current[field]) {
                        details.changes.push({
                            field,
                            oldValue: responseData.previous[field],
                            newValue: responseData.current[field]
                        });
                    }
                });
            }
        } 
        // For user activation/deactivation using the old format
        else if (body.active !== undefined) {
            details.action = body.active ? 'User Activated' : 'User Deactivated';
            details.email = body.email;
        } 
        // For general user updates using the old format
        else {
            // For general user updates
            details.email = body.email;
            details.user_id = body.user_id || body.id;
            
            // Include changed fields
            const fields = ['email', 'role', 'first_name', 'last_name', 'active'];
            fields.forEach(field => {
                if (body[field] !== undefined) {
                    details[field] = body[field];
                }
            });
        }
    }
    
    return details;
}

function extractGroupDetails(body, actionType, req) {
    const details = {};
    
    if (actionType === 'CREATE') {
        details.group_name = body.group_name;
        details.tables = body.tables || [];
    } else if (actionType === 'UPDATE') {
        // Special handling for group name updates
        if (body.old_group_name && body.new_group_name) {
            details.action = 'Group Renamed';
            details.old_group_name = body.old_group_name;
            details.group_name = body.new_group_name;
        } else {
            details.group_name = body.group_name;
            
            if (body.action === 'toggle') {
                details.action = 'Group Toggled';
                details.new_status = body.is_enabled ? 'Enabled' : 'Disabled';
            } else if (body.action === 'addTable') {
                details.action = 'Table Added to Group';
                details.tables = body.tables || [];
            } else {
                details.action = 'Group Updated';
                details.tables = body.tables || [];
                
                // If we have old tables, show what changed
                if (body.old_tables) {
                    const oldTables = body.old_tables || [];
                    const newTables = body.tables || [];
                    
                    details.added_tables = newTables.filter(t => !oldTables.includes(t));
                    details.removed_tables = oldTables.filter(t => !newTables.includes(t));
                }
            }
        }
    } else if (actionType === 'DELETE') {
        details.group_name = body.group_name;
        details.action = 'Group Deleted';
    }
    
    return details;
}

function extractColumnPermissionDetails(body, actionType, req) {
    const details = {
        table_name: body.table_name,
        columns: []
    };
    
    if (body.column_list && Array.isArray(body.column_list)) {
        body.column_list.forEach(column => {
            details.columns.push({
                column_name: column.column_name,
                status: column.column_status
            });
        });
        
        // Count editable and non-editable columns
        details.editable_count = body.column_list.filter(c => c.column_status === 'editable').length;
        details.non_editable_count = body.column_list.filter(c => c.column_status === 'non-editable').length;
    }
    
    return details;
}

function extractValidationDetails(body, actionType, req) {
    const details = {
        table_name: body.table_name || body.tableName,
        column_name: body.column_name || body.columnName
    };
    
    // Add current validation configuration
    if (body.validation) {
        details.validations = body.validation;
    } else if (body.validations) {
        details.validations = body.validations;
    }
    
    // Add data type if available
    if (body.data_type) {
        details.data_type = body.data_type;
    }
    
    // Add status information
    if (body.is_active !== undefined) {
        details.is_active = body.is_active;
    }
    
    // Track changes between old and new data if available
    if (body.oldData && body.newData) {
        // Extract old and new validation settings
        const oldValidations = body.oldData.validation || body.oldData.validations || {};
        const newValidations = body.newData.validation || body.newData.validations || {};
        
        // Find added, removed, and modified validation rules
        details.added_validations = [];
        details.removed_validations = [];
        details.modified_validations = [];
        
        // Find added and modified validation rules
        Object.keys(newValidations).forEach(key => {
            // Check if the key exists in old data
            if (!(key in oldValidations)) {
                details.added_validations.push(key);
            } 
            // If it exists, check if the value changed
            else if (oldValidations[key] !== newValidations[key]) {
                details.modified_validations.push(key);
            }
        });
        
        // Find removed validation rules
        Object.keys(oldValidations).forEach(key => {
            if (!(key in newValidations)) {
                details.removed_validations.push(key);
            }
        });
    }
    
    return details;
}

function extractDropdownDetails(body, actionType, req) {
    // Handle both direct body properties and nested structures
    const details = {
        table_name: body.table_name || body.tableName,
        dropdown_options: body.dropdown_options || {}
    };
    
    // For individual column updates
    if (body.column_name) {
        details.column_name = body.column_name;
    }
    
    // For dependent dropdowns
    if (body.parent_column) {
        details.is_dependent = true;
        details.parent_column = body.parent_column;
    }
    
    // For bulk dropdown configurations with array structure
    if (Array.isArray(body.dropdown_options)) {
        // Organize dropdown options by type for better readability
        details.is_dependent = false;
        details.columns_updated = [];
        details.regular_dropdowns = [];
        details.dependent_dropdowns = [];
        
        body.dropdown_options.forEach(colConfig => {
            if (colConfig.columnName) {
                details.columns_updated.push(colConfig.columnName);
                
                if (colConfig.parentColumn) {
                    details.is_dependent = true;
                    
                    // Format dependent dropdown options for better display
                    const formattedValues = Array.isArray(colConfig.options) ? 
                        colConfig.options.map(opt => {
                            if (typeof opt === 'object' && opt.value) {
                                return opt.parent ? 
                                    `${opt.value} (parent: ${opt.parent})` : 
                                    opt.value;
                            }
                            return opt;
                        }) : [];
                    
                    details.dependent_dropdowns.push({
                        column: colConfig.columnName,
                        parent_column: colConfig.parentColumn,
                        values: formattedValues
                    });
                } else {
                    // Regular dropdown options
                    details.regular_dropdowns.push({
                        column: colConfig.columnName,
                        values: colConfig.options || []
                    });
                }
            }
        });
        
        // Find regular dropdowns and dependent dropdowns
        const regularOptions = body.dropdown_options.filter(opt => 
            Array.isArray(opt.options) && 
            (!opt.options[0] || typeof opt.options[0] !== 'object')
        );
        
        const dependentOptions = body.dropdown_options.filter(opt => 
            opt.parentColumn && Array.isArray(opt.options) && 
            opt.options.length > 0 && typeof opt.options[0] === 'object'
        );
        
        if (dependentOptions.length > 0) {
            details.is_dependent = true;
            details.dependent_columns = dependentOptions.map(opt => ({
                column: opt.columnName,
                parent: opt.parentColumn
            }));
        }
    }
    
    // If we're tracking changes between old and new dropdown options
    if (body.old_options && body.dropdown_options) {
        // Track changes for each column
        const regular_changes = {};
        const dependent_changes = {};
        const changes = { added: [], removed: [] };
        
        // Compare old and new dropdown configurations by column
        if (Array.isArray(body.old_options) && Array.isArray(body.dropdown_options)) {
            
            // Process old dropdown options by column
            const oldOptionsByColumn = {};
            body.old_options.forEach(opt => {
                if (opt.columnName) {
                    oldOptionsByColumn[opt.columnName] = opt;
                }
            });
            
            // Process new dropdown options by column and compare
            body.dropdown_options.forEach(newOpt => {
                if (!newOpt.columnName) return;
                
                const oldOpt = oldOptionsByColumn[newOpt.columnName];
                if (!oldOpt) {
                    // This is a completely new column config
                    if (newOpt.parentColumn) {
                        // Dependent dropdown
                        dependent_changes[newOpt.columnName] = {
                            parent_column: newOpt.parentColumn,
                            added: newOpt.options.map(o => {
                                if (typeof o === 'object' && o.value) {
                                    return { value: o.value, parent: o.parent };
                                }
                                return { value: o };
                            }),
                            removed: []
                        };
                        
                        // Also track each option added in the changes array
                        newOpt.options.forEach(o => {
                            changes.added.push({
                                column: newOpt.columnName,
                                value: typeof o === 'object' ? o.value : o,
                                parent_column: newOpt.parentColumn,
                                parent_value: typeof o === 'object' ? o.parent : null
                            });
                        });
                    } else {
                        // Regular dropdown
                        regular_changes[newOpt.columnName] = {
                            added: [...newOpt.options],
                            removed: []
                        };
                        
                        // Track each option added
                        newOpt.options.forEach(o => {
                            changes.added.push({
                                column: newOpt.columnName,
                                value: o
                            });
                        });
                    }
                    return;
                }
                
                // This column exists in both old and new configs
                // Compare options to find additions and removals
                if (newOpt.parentColumn) {
                    // Handle dependent dropdown comparison
                    const oldOptions = oldOpt.options || [];
                    const newOptions = newOpt.options || [];
                    
                    // Extract values with their parents for comparison
                    const oldValuesMap = new Map();
                    oldOptions.forEach(o => {
                        const key = typeof o === 'object' ? 
                            `${o.value}:${o.parent || 'null'}` : 
                            `${o}:null`;
                        oldValuesMap.set(key, o);
                    });
                    
                    const added = [];
                    newOptions.forEach(o => {
                        const key = typeof o === 'object' ? 
                            `${o.value}:${o.parent || 'null'}` : 
                            `${o}:null`;
                        
                        if (!oldValuesMap.has(key)) {
                            added.push(typeof o === 'object' ? 
                                { value: o.value, parent: o.parent } : 
                                { value: o });
                                
                            // Also track in the changes array
                            changes.added.push({
                                column: newOpt.columnName,
                                value: typeof o === 'object' ? o.value : o,
                                parent_column: newOpt.parentColumn,
                                parent_value: typeof o === 'object' ? o.parent : null
                            });
                        }
                        
                        // Remove this key so we can track what's left as removed
                        oldValuesMap.delete(key);
                    });
                    
                    // Remaining items in oldValuesMap were removed
                    const removed = [];
                    oldValuesMap.forEach((o, key) => {
                        removed.push(typeof o === 'object' ? 
                            { value: o.value, parent: o.parent } : 
                            { value: o });
                            
                        // Track in the changes array
                        changes.removed.push({
                            column: newOpt.columnName,
                            value: typeof o === 'object' ? o.value : o,
                            parent_column: newOpt.parentColumn,
                            parent_value: typeof o === 'object' ? o.parent : null
                        });
                    });
                    
                    // Only record changes if something actually changed
                    if (added.length > 0 || removed.length > 0) {
                        dependent_changes[newOpt.columnName] = {
                            parent_column: newOpt.parentColumn,
                            added,
                            removed
                        };
                    }
                } else {
                    // Handle regular dropdown comparison
                    const oldValues = new Set(oldOpt.options || []);
                    const newValues = new Set(newOpt.options || []);
                    
                    const added = [];
                    const removed = [];
                    
                    // Find added values
                    newOpt.options.forEach(val => {
                        if (!oldValues.has(val)) {
                            added.push(val);
                            
                            // Track in changes array
                            changes.added.push({
                                column: newOpt.columnName,
                                value: val
                            });
                        }
                    });
                    
                    // Find removed values
                    if (oldOpt.options) {
                        oldOpt.options.forEach(val => {
                            if (!newValues.has(val)) {
                                removed.push(val);
                                
                                // Track in changes array
                                changes.removed.push({
                                    column: newOpt.columnName,
                                    value: val
                                });
                            }
                        });
                    }
                    
                    // Only record changes if something actually changed
                    if (added.length > 0 || removed.length > 0) {
                        regular_changes[newOpt.columnName] = {
                            added,
                            removed
                        };
                    }
                }
            });
            
            // Check for columns that were completely removed
            Object.keys(oldOptionsByColumn).forEach(columnName => {
                const oldOpt = oldOptionsByColumn[columnName];
                const columnExists = body.dropdown_options.some(opt => opt.columnName === columnName);
                
                if (!columnExists) {
                    // This column was completely removed
                    if (oldOpt.parentColumn) {
                        // It was a dependent dropdown
                        dependent_changes[columnName] = {
                            parent_column: oldOpt.parentColumn,
                            added: [],
                            removed: oldOpt.options.map(o => {
                                if (typeof o === 'object' && o.value) {
                                    return { value: o.value, parent: o.parent };
                                }
                                return { value: o };
                            })
                        };
                        
                        // Track each option removed
                        oldOpt.options.forEach(o => {
                            changes.removed.push({
                                column: columnName,
                                value: typeof o === 'object' ? o.value : o,
                                parent_column: oldOpt.parentColumn,
                                parent_value: typeof o === 'object' ? o.parent : null
                            });
                        });
                    } else {
                        // It was a regular dropdown
                        regular_changes[columnName] = {
                            added: [],
                            removed: [...(oldOpt.options || [])]
                        };
                        
                        // Track each option removed
                        (oldOpt.options || []).forEach(o => {
                            changes.removed.push({
                                column: columnName,
                                value: o
                            });
                        });
                    }
                }
            });
        }
        
        // Add the detailed changes to the log details
        if (Object.keys(regular_changes).length > 0) {
            details.regular_changes = regular_changes;
        }
        
        if (Object.keys(dependent_changes).length > 0) {
            details.dependent_changes = dependent_changes;
        }
        
        // Always include the changes array for compatibility
        details.changes = changes;
    }
    
    return details;
}

function extractColumnRenameDetails(body, actionType, req) {
    // For DELETE operations, we need to get data from params
    if (actionType === 'DELETE' && req && req.params) {
        return {
            table_name: req.params.table_name,
            original_column_name: req.params.column_name,
            renamed_column_name: ''  // No renamed column name for delete operations
        };
    }
    
    // For CREATE/UPDATE operations, data comes from body
    return {
        table_name: body.table_name,
        original_column_name: body.original_column_name,
        renamed_column_name: body.renamed_column_name
    };
}

function extractTableConfigDetails(body, actionType, req) {
    const details = {
        original_table_name: body.original_table_name,
        display_name: body.display_name
    };
    
    if (body.description) {
        details.description = body.description;
    }
    
    // For updates, track what changed
    if (actionType === 'UPDATE' && body.id) {
        details.table_id = body.id;
        
        if (body.old_display_name && body.old_display_name !== body.display_name) {
            details.old_display_name = body.old_display_name;
        }
        
        if (body.old_description && body.old_description !== body.description) {
            details.old_description = body.old_description;
        }
    }
    
    return details;
}

module.exports = logAdminAction;