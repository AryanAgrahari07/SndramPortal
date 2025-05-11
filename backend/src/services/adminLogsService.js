const { client_update } = require('../configuration/database/databaseUpdate');

/**
 * Get admin logs with filtering and pagination
 * @param {Object} filters - Filter parameters
 * @returns {Object} Logs with pagination info
 */
const getAdminLogs = async (filters = {}) => {
    try {
        // Base query
        let query = `
            SELECT 
                al.log_id,
                al.action_type,
                al.section,
                al.action_details,
                al.ip_address,
                al.created_at,
                al.target_table,
                al.target_id,
                al.status,
                al.additional_info,
                u.email AS admin_email,
                u.first_name,
                u.last_name,
                COUNT(*) OVER() as total_count
            FROM app.admin_action_logs al
            JOIN app.users u ON al.admin_id = u.user_id
            WHERE 1=1
        `;
        
        const queryParams = [];
        let paramCount = 1;
        
        // Apply filters
        if (filters.section && filters.section !== 'all') {
            query += ` AND al.section = $${paramCount}`;
            queryParams.push(filters.section);
            paramCount++;
        }
        
        if (filters.actionType && filters.actionType !== 'all') {
            query += ` AND al.action_type = $${paramCount}`;
            queryParams.push(filters.actionType);
            paramCount++;
        }
        
        if (filters.adminId) {
            query += ` AND al.admin_id = $${paramCount}`;
            queryParams.push(filters.adminId);
            paramCount++;
        }
        
        if (filters.startDate) {
            query += ` AND al.created_at >= $${paramCount}`;
            queryParams.push(filters.startDate);
            paramCount++;
        }
        
        if (filters.endDate) {
            query += ` AND al.created_at <= $${paramCount}`;
            queryParams.push(filters.endDate);
            paramCount++;
        }
        
        if (filters.tableName) {
            query += ` AND al.target_table = $${paramCount}`;
            queryParams.push(filters.tableName);
            paramCount++;
        }
        
        // Full text search
        if (filters.search) {
            query += ` AND (
                u.email ILIKE $${paramCount} OR
                u.first_name ILIKE $${paramCount} OR
                u.last_name ILIKE $${paramCount} OR
                al.target_table ILIKE $${paramCount} OR
                al.section ILIKE $${paramCount} OR
                al.action_type ILIKE $${paramCount} OR
                al.action_details::text ILIKE $${paramCount} OR
                al.additional_info::text ILIKE $${paramCount}
            )`;
            queryParams.push(`%${filters.search}%`);
            paramCount++;
        }
        
        // Add specific filters for JSONB fields
        if (filters.groupName) {
            query += ` AND (al.additional_info->>'group_name' = $${paramCount} OR 
                       al.action_details->'requestBody'->>'group_name' = $${paramCount})`;
            queryParams.push(filters.groupName);
            paramCount++;
        }
        
        if (filters.columnName) {
            query += ` AND (al.additional_info->>'column_name' = $${paramCount} OR 
                       al.action_details->'requestBody'->>'column_name' = $${paramCount})`;
            queryParams.push(filters.columnName);
            paramCount++;
        }
        
        // Sorting
        const sortBy = filters.sortBy || 'created_at';
        const sortOrder = filters.sortOrder || 'DESC';
        query += ` ORDER BY al.${sortBy} ${sortOrder}`;
        
        // Pagination
        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const offset = (page - 1) * limit;
        
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        queryParams.push(limit, offset);
        
        // Execute query
        const result = await client_update.query(query, queryParams);
        
        // Process results
        const logs = result.rows.map(row => {
            const { total_count, ...log } = row;
            
            // Parse JSONB fields
            if (typeof log.action_details === 'string') {
                try {
                    log.action_details = JSON.parse(log.action_details);
                } catch (e) {
                    // Keep as is if parsing fails
                }
            }
            
            if (typeof log.additional_info === 'string') {
                try {
                    log.additional_info = JSON.parse(log.additional_info);
                } catch (e) {
                    // Keep as is if parsing fails
                }
            }
            
            return log;
        });
        
        // Calculate pagination info
        const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
        const totalPages = Math.ceil(totalCount / limit);
        
        return {
            logs,
            page,
            limit,
            total: totalCount,
            totalPages
        };
    } catch (error) {
        console.error('Error in getAdminLogs service:', error);
        throw new Error('Failed to fetch admin logs');
    }
};

/**
 * Get available sections for filtering
 * @returns {Array} List of unique sections
 */
const getSections = async () => {
    try {
        const query = `
            SELECT DISTINCT section 
            FROM app.admin_action_logs 
            ORDER BY section
        `;
        const result = await client_update.query(query);
        return result.rows.map(row => row.section);
    } catch (error) {
        console.error('Error in getSections service:', error);
        throw new Error('Failed to fetch sections');
    }
};

/**
 * Get available action types for filtering
 * @returns {Array} List of unique action types
 */
const getActionTypes = async () => {
    try {
        const query = `
            SELECT DISTINCT action_type 
            FROM app.admin_action_logs 
            ORDER BY action_type
        `;
        const result = await client_update.query(query);
        return result.rows.map(row => row.action_type);
    } catch (error) {
        console.error('Error in getActionTypes service:', error);
        throw new Error('Failed to fetch action types');
    }
};

/**
 * Get a specific admin log by ID
 * @param {string} logId - The log ID
 * @returns {Object} Log details
 */
const getLogById = async (logId) => {
    try {
        const query = `
            SELECT 
                al.log_id,
                al.action_type,
                al.section,
                al.action_details,
                al.ip_address,
                al.created_at,
                al.target_table,
                al.target_id,
                al.status,
                al.additional_info,
                u.email AS admin_email,
                u.first_name,
                u.last_name
            FROM app.admin_action_logs al
            JOIN app.users u ON al.admin_id = u.user_id
            WHERE al.log_id = $1
        `;
        
        const result = await client_update.query(query, [logId]);
        
        if (result.rows.length === 0) {
            throw new Error('Log not found');
        }
        
        const log = result.rows[0];
        
        // Parse JSONB fields
        if (typeof log.action_details === 'string') {
            try {
                log.action_details = JSON.parse(log.action_details);
            } catch (e) {
                // Keep as is if parsing fails
            }
        }
        
        if (typeof log.additional_info === 'string') {
            try {
                log.additional_info = JSON.parse(log.additional_info);
            } catch (e) {
                // Keep as is if parsing fails
            }
        }
        
        return log;
    } catch (error) {
        console.error('Error in getLogById service:', error);
        throw new Error(`Failed to fetch log: ${error.message}`);
    }
};

module.exports = {
    getAdminLogs,
    getSections,
    getActionTypes,
    getLogById
}; 