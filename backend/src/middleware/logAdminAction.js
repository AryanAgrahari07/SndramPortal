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
            // Restore the original json function
            res.json = originalJson;
            
            try {
                // Only log if the user is an admin
                if (req.user && req.user.role === 'admin') {
                    const adminId = req.user.user_id;
                    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
                    
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
                    } else if (section === 'USER_MANAGEMENT') {
                        targetTable = 'app.users';
                        targetId = req.body.user_id || req.params.id;
                    } else if (req.originalUrl) {
                        // Extract from URL if possible
                        const urlParts = req.originalUrl.split('/');
                        if (urlParts.length > 2) {
                            targetTable = urlParts[1];
                            if (urlParts[2] && !urlParts[2].includes('?')) {
                                targetId = urlParts[2];
                            }
                        }
                    }
                    
                    // Determine if the action was successful
                    const status = data.success === false ? 'failed' : 'completed';
                    
                    // Extract old and new data if available
                    if (req.body.oldData) {
                        actionDetails.oldData = req.body.oldData;
                    }
                    
                    if (req.body.newData) {
                        actionDetails.newData = req.body.newData;
                    }
                    
                    // For user management, enhance details
                    let additionalInfo = null;
                    if (section === 'USER_MANAGEMENT') {
                        additionalInfo = extractUserDetails(req.body, actionType);
                    } else if (section === 'GROUP_MANAGEMENT') {
                        additionalInfo = extractGroupDetails(req.body, actionType);
                    } else if (section === 'COLUMN_PERMISSION') {
                        additionalInfo = extractColumnPermissionDetails(req.body);
                    } else if (section === 'VALIDATION_CONFIG') {
                        additionalInfo = extractValidationDetails(req.body);
                    } else if (section === 'DROPDOWN_MANAGEMENT') {
                        additionalInfo = extractDropdownDetails(req.body);
                    } else if (section === 'COLUMN_RENAME') {
                        additionalInfo = extractColumnRenameDetails(req.body);
                    } else if (section === 'TABLE_CONFIG') {
                        additionalInfo = extractTableConfigDetails(req.body, actionType);
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

function extractUserDetails(body, actionType) {
    const details = {};
    
    if (actionType === 'CREATE') {
        details.email = body.email;
        details.first_name = body.first_name;
        details.last_name = body.last_name;
        details.role = body.role;
    } else if (actionType === 'UPDATE') {
        // For user activation/deactivation
        if (body.active !== undefined) {
            details.action = body.active ? 'User Activated' : 'User Deactivated';
            details.email = body.email;
        } else {
            // For general user updates
            details.user_id = body.user_id || body.id;
            
            // Include changed fields
            const fields = ['email', 'role', 'first_name', 'last_name', 'active'];
            fields.forEach(field => {
                if (body[field] !== undefined) {
                    details[field] = body[field];
                }
            });
            
            // Include before/after comparison if available
            if (body.oldData && body.newData) {
                details.changes = [];
                fields.forEach(field => {
                    if (body.oldData[field] !== body.newData[field]) {
                        details.changes.push({
                            field,
                            oldValue: body.oldData[field],
                            newValue: body.newData[field]
                        });
                    }
                });
            }
        }
    }
    
    return details;
}

function extractGroupDetails(body, actionType) {
    const details = {};
    
    if (actionType === 'CREATE') {
        details.group_name = body.group_name;
        details.tables = body.tables || [];
    } else if (actionType === 'UPDATE') {
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
    } else if (actionType === 'DELETE') {
        details.group_name = body.group_name;
        details.action = 'Group Deleted';
    }
    
    return details;
}

function extractColumnPermissionDetails(body) {
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

function extractValidationDetails(body) {
    const details = {
        table_name: body.table_name || body.tableName,
        column_name: body.column_name || body.columnName
    };
    
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
    
    return details;
}

function extractDropdownDetails(body) {
    const details = {
        table_name: body.table_name,
        column_name: body.column_name,
        dropdown_options: body.dropdown_options || {}
    };
    
    // For dependent dropdowns
    if (body.parent_column) {
        details.is_dependent = true;
        details.parent_column = body.parent_column;
    }
    
    // If we're tracking changes between old and new dropdown options
    if (body.old_options && body.dropdown_options) {
        const oldOptions = Array.isArray(body.old_options) ? body.old_options : Object.keys(body.old_options);
        const newOptions = Array.isArray(body.dropdown_options) ? body.dropdown_options : Object.keys(body.dropdown_options);
        
        details.added_options = newOptions.filter(o => !oldOptions.includes(o));
        details.removed_options = oldOptions.filter(o => !newOptions.includes(o));
    }
    
    return details;
}

function extractColumnRenameDetails(body) {
    return {
        table_name: body.table_name,
        original_column_name: body.original_column_name,
        renamed_column_name: body.renamed_column_name
    };
}

function extractTableConfigDetails(body, actionType) {
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