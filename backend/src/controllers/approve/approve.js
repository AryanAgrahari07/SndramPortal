const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.approve = async (req, res) => {
    const { request_id, row_id, comments } = req.body;
    const checker = req.user.user_id;

    console.log('Received request_id:', request_id, 'type:', typeof request_id);
    console.log('Received row_id:', row_id, 'type:', typeof row_id);

    if (!request_id || !row_id) {
        return res.status(400).json({
            success: false,
            message: 'Both request_id and row_id are required fields.',
        });
    }

    try {
        await client_update.query('BEGIN');

        // First, get the change details and validate request_id exists
        const checkRequestQuery = `
            SELECT request_id 
            FROM app.change_tracker 
            WHERE request_id = $1::uuid;
        `;
        console.log('Checking request_id with query:', checkRequestQuery);
        const checkResult = await client_update.query(checkRequestQuery, [request_id]);
        
        if (checkResult.rowCount === 0) {
            throw new Error('No record found with the given request_id.');
        }

        // Get the change details
        const selectQuery = `
            SELECT ct.table_name, ct.new_data, ct.request_id::text as request_id
            FROM app.change_tracker ct
            WHERE ct.request_id = $1::uuid;
        `;
        console.log('Select Query:', selectQuery);
        console.log('Select Query Params:', [request_id]);
        
        const selectResult = await client_update.query(selectQuery, [request_id]);
        console.log('Select Result:', selectResult.rows[0]);

        const { table_name, new_data } = selectResult.rows[0];

        if (!table_name || !new_data) {
            throw new Error('Invalid data in change_tracker: table_name or new_data is missing.');
        }

        // Get column types to identify UUID columns
        const columnTypesQuery = `
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'app'
            AND table_name = $1;
        `;
        const columnTypesResult = await client_update.query(columnTypesQuery, [table_name]);
        
        // Get all columns and their types
        const columnTypes = columnTypesResult.rows.reduce((acc, col) => {
            acc[col.column_name] = col.udt_name;
            return acc;
        }, {});

        console.log('Column types:', columnTypes);
        console.log('Original new_data:', new_data);

        // Determine the SK column name based on table name
        const skColumnName = `${table_name}_sk`;
        console.log('Using SK column:', skColumnName);

        // Verify that the SK column exists
        if (!columnTypes[skColumnName]) {
            throw new Error(`SK column ${skColumnName} not found in table ${table_name}`);
        }

        // Prepare updates by filtering out request_id and row_id
        const updates = Object.entries(new_data)
            .filter(([column]) => column !== 'request_id' && column !== 'row_id')
            .map(([column, value]) => {
             const processedValue = (value === 'null' || value === 'NULL' || value === '') 
                ? null 
                : value;
             return [column, processedValue];
            });

        console.log('Prepared updates:', updates);

        if (updates.length === 0) {
            console.log('No columns to update');
            await client_update.query('COMMIT');
            return res.status(200).json({
                success: true,
                message: 'No columns required update',
                trackerData: selectResult.rows[0]
            });
        }

        // Use double quotes around column names to preserve case
        const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
        const updateValues = updates.map(([, value]) => value);
        updateValues.push(row_id); // Add row_id for WHERE clause

        // Use the SK column in the WHERE clause with double quotes
        const whereClause = `WHERE "${skColumnName}" = $${updates.length + 1}`;

        console.log('Update SQL:', `UPDATE app.${table_name} SET ${updateColumns} ${whereClause}`);
        console.log('Update values:', updateValues);

        const dynamicUpdateQuery = `
            UPDATE app.${table_name}
            SET ${updateColumns}
            ${whereClause}
            RETURNING *;
        `;

        const updateResult = await client_update.query(dynamicUpdateQuery, updateValues);

        if (updateResult.rowCount === 0) {
            throw new Error(`Failed to update record in ${table_name}`);
        }

        // Update change_tracker status
        const updateTrackerQuery = `
            UPDATE app.change_tracker
            SET 
                status = $1,
                comments = $2,
                updated_at = NOW(),
                checker = $3,
                row_id = $4
            WHERE request_id = $5::uuid
            RETURNING *;
        `;

        console.log('Update Tracker Query:', updateTrackerQuery);
        console.log('Update Tracker Values:', ['approved', comments || null, checker, row_id, request_id]);

        const trackerValues = ['approved', comments || null, checker, row_id, request_id];
        const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

        if (trackerResult.rowCount === 0) {
            throw new Error('Failed to update change_tracker.');
        }

        await client_update.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Change request approved and applied successfully',
            trackerData: trackerResult.rows[0],
            updatedRecord: updateResult.rows[0]
        });
    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Error in approve controller:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            detail: error.detail,
            where: error.where
        });
        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the request',
            error: error.message,
            details: {
                code: error.code,
                detail: error.detail,
                where: error.where
            }
        });
    }
};

exports.approveAll = async (req, res) => {
    const { request_ids, comments } = req.body;
    const checker = req.user.user_id;

    console.log('Received request_ids:', request_ids);

    if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'request_ids must be a non-empty array.',
        });
    }

    try {
        await client_update.query('BEGIN');

        const results = [];
        const errors = [];

        // Process each request_id
        for (const request_id of request_ids) {
            try {
                // Get the change details
                const selectQuery = `
                    SELECT ct.table_name, ct.new_data, ct.row_id, ct.request_id::text as request_id
                    FROM app.change_tracker ct
                    WHERE ct.request_id = $1::uuid
                    AND ct.status = 'pending';
                `;
                const selectResult = await client_update.query(selectQuery, [request_id]);

                if (selectResult.rowCount === 0) {
                    throw new Error(`No pending record found with request_id: ${request_id}`);
                }

                const { table_name, new_data, row_id } = selectResult.rows[0];

                if (!table_name || !new_data || !row_id) {
                    throw new Error('Invalid data in change_tracker: table_name, new_data, or row_id is missing.');
                }

                // Get column types
                const columnTypesQuery = `
                    SELECT column_name, data_type, udt_name
                    FROM information_schema.columns
                    WHERE table_schema = 'app'
                    AND table_name = $1;
                `;
                const columnTypesResult = await client_update.query(columnTypesQuery, [table_name]);
                
                const columnTypes = columnTypesResult.rows.reduce((acc, col) => {
                    acc[col.column_name] = col.udt_name;
                    return acc;
                }, {});

                // Determine the SK column name based on table name
                const skColumnName = `${table_name}_sk`;
                console.log('Using SK column:', skColumnName);

                // Verify that the SK column exists
                if (!columnTypes[skColumnName]) {
                    throw new Error(`SK column ${skColumnName} not found in table ${table_name}`);
                }

                // Prepare updates
                const updates = Object.entries(new_data)
                    .filter(([column]) => column !== 'request_id' && column !== 'row_id')
                    .map(([column, value]) => {
                        const processedValue = (value === 'null' || value === 'NULL' || value === '') 
                            ? null 
                            : value;
                        return [column, processedValue];
                    });

                if (updates.length === 0) {
                    console.log(`No columns to update for request_id: ${request_id}`);
                    continue;
                }

                // Use double quotes around column names to preserve case
                const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
                const updateValues = updates.map(([, value]) => value);
                updateValues.push(row_id); // Add row_id for WHERE clause

                // Use the SK column in the WHERE clause with double quotes
                const whereClause = `WHERE "${skColumnName}" = $${updates.length + 1}`;

                const dynamicUpdateQuery = `
                    UPDATE app.${table_name}
                    SET ${updateColumns}
                    ${whereClause}
                    RETURNING *;
                `;

                const updateResult = await client_update.query(dynamicUpdateQuery, updateValues);

                if (updateResult.rowCount === 0) {
                    throw new Error(`Failed to update record in ${table_name}`);
                }

                // Update change_tracker status
                const updateTrackerQuery = `
                    UPDATE app.change_tracker
                    SET 
                        status = $1,
                        comments = $2,
                        updated_at = NOW(),
                        checker = $3
                    WHERE request_id = $4::uuid
                    RETURNING *;
                `;

                const trackerValues = ['approved', comments || null, checker, request_id];
                const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

                if (trackerResult.rowCount === 0) {
                    throw new Error('Failed to update change_tracker.');
                }

                results.push({
                    request_id,
                    success: true,
                    message: 'Approved successfully',
                    trackerData: trackerResult.rows[0],
                    updatedRecord: updateResult.rows[0]
                });

            } catch (error) {
                console.error(`Error processing request_id ${request_id}:`, error);
                errors.push({
                    request_id,
                    error: error.message
                });
            }
        }

        if (errors.length === request_ids.length) {
            // If all requests failed, rollback
            await client_update.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                message: 'All approval requests failed',
                errors
            });
        }

        // Commit if at least one request succeeded
        await client_update.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: `Successfully processed ${results.length} out of ${request_ids.length} requests`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Error in approveAll controller:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the requests',
            error: error.message
        });
    }
};