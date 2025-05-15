const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.ColumnPermission = async (req, res) => {
    const { table_name, column_list, action } = req.body;

    if (!table_name) {
        return res.status(400).json({
            success: false,
            message: '"table_name" is a required field',
        });
    }

    try {
        if (action === 'get') {
            const getQuery = `
                SELECT column_list 
                FROM app.column_permission
                WHERE table_name = $1;
            `;
            const result = await client_update.query(getQuery, [table_name]);
            
            return res.status(200).json({
                success: true,
                column_list: result.rowCount > 0 ? result.rows[0].column_list : []
            });
        }

        // For update action
        if (!Array.isArray(column_list)) {
            return res.status(400).json({
                success: false,
                message: 'For update action, "column_list" is required and must be an array',
            });
        }

        await client_update.query('BEGIN');

        const checkQuery = `
            SELECT column_list 
            FROM app.column_permission
            WHERE table_name = $1;
        `;
        const checkResult = await client_update.query(checkQuery, [table_name]);
        
        // Store original column list for logging
        const existingColumnList = checkResult.rowCount > 0 ? checkResult.rows[0].column_list || [] : [];
        
        // Add oldData to request for logging middleware
        req.body.oldData = {
            table_name,
            column_list: existingColumnList
        };
        
        let updatedColumnList = [];

        if (checkResult.rowCount > 0) {
            updatedColumnList = existingColumnList.map((existingColumn) => {
                const match = column_list.find(col => col.column_name === existingColumn.column_name);
                return match ? { ...existingColumn, column_status: match.column_status } : existingColumn;
            });

            column_list.forEach(newColumn => {
                if (!updatedColumnList.some(col => col.column_name === newColumn.column_name)) {
                    updatedColumnList.push(newColumn);
                }
            });

            // Update the row
            const updateQuery = `
                UPDATE app.column_permission
                SET column_list = $1,
                    updated_at = NOW()
                WHERE table_name = $2;
            `;
            await client_update.query(updateQuery, [JSON.stringify(updatedColumnList), table_name]);
        } else {
            // Row does not exist, insert a new row
            updatedColumnList = column_list;
            const insertQuery = `
                INSERT INTO app.column_permission (table_name, column_list, created_at, updated_at)
                VALUES ($1, $2, NOW(), NOW());
            `;
            await client_update.query(insertQuery, [table_name, JSON.stringify(column_list)]);
        }
        
        // Add newData to request for logging middleware
        req.body.newData = {
            table_name,
            column_list: updatedColumnList
        };

        await client_update.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Column permissions updated successfully'
        });

    } catch (error) {
        if (action !== 'get') {
            await client_update.query('ROLLBACK');
        }
        console.error('Error in columnStatusPermission:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};