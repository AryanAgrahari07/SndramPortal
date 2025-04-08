const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.reject = async (req, res) => {
    const { row_id, comments, request_id } = req.body;
    const checker = req.user.user_id;

    // console.log('Received row_id:', row_id, 'type:', typeof row_id);
    // console.log('Received request_id:', request_id, 'type:', typeof request_id);
    
    if (!row_id || !request_id) {
        return res.status(400).json({
            success: false,
            message: 'row_id and request_id are required.',
        });
    }

    try {
        await client_update.query('BEGIN');

        // Get the change details
        const selectQuery = `
            SELECT ct.table_name, ct.new_data, ct.request_id::text as request_id
            FROM app.change_tracker ct
            WHERE ct.row_id = $1
            AND ct.request_id = $2
            AND ct.status = 'pending';
        `;
        // console.log('Select Query:', selectQuery);
        // console.log('Select Query Params:', [row_id]);
        
        const selectResult = await client_update.query(selectQuery, [row_id, request_id]);

        if (selectResult.rowCount === 0) {
            throw new Error('No pending record found with the given row_id.');
        }

        // const { request_id } = selectResult.rows[0];

        // if (!request_id) {
        //     throw new Error('Invalid data in change_tracker: request_id is missing.');
        // }

        // Update change_tracker status
        const updateTrackerQuery = `
            UPDATE app.change_tracker
            SET 
                status = $1,
                comments = $2,
                updated_at = NOW(),
                checker = $3
            WHERE row_id = $4
            AND request_id = $5
            AND status = 'pending'
            RETURNING *;
        `;

        // console.log('Update Tracker Query:', updateTrackerQuery);
        // console.log('Update Tracker Values:', ['rejected', comments || null, checker, row_id]);

        const trackerValues = ['rejected', comments || null, checker, row_id , request_id];
        const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

        if (trackerResult.rowCount === 0) {
            throw new Error('Failed to update change_tracker.');
        }

        await client_update.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Change request rejected successfully',
            trackerData: trackerResult.rows[0]
        });

    } catch (error) {
        await client_update.query('ROLLBACK');
        console.error('Error in reject controller:', error);
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