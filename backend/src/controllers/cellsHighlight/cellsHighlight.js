const { client_update } = require('../../configuration/database/databaseUpdate.js');

exports.highlightCells = async (req, res) => {
    const { tableName } = req.body;
    const userId = req.user.user_id; // Get user ID from JWT token

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'Table Name is required'
        });
    }

    try {
        // Query to get pending changes for the current user and specific table
        const query = `
            SELECT table_id, old_data, new_data, row_id
            FROM app.change_tracker
            WHERE maker = $1 
            AND status = 'pending'
            AND table_name = $2;
        `;

        const result = await client_update.query(query, [userId, tableName]);

        // Create a map to group changes by row_id
        const changesMap = {};

        // Process each row and group by row_id
        result.rows.forEach(row => {
            const oldData = row.old_data;
            const newData = row.new_data;
            const rowId = row.row_id;

            if (!changesMap[rowId]) {
                changesMap[rowId] = {
                    table_name: row.table_name,
                    row_id: rowId,
                    changed_fields: new Set()
                };
            }

            // Compare old_data and new_data to find changed fields
            for (const key in newData) {
                const oldValue = oldData[key];
                const newValue = newData[key];

                // Skip if both values are empty (null, undefined, or empty string)
                if (
                    (oldValue === null || oldValue === undefined || oldValue === '') &&
                    (newValue === null || newValue === undefined || newValue === '')
                ) {
                    continue;
                }

                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    changesMap[rowId].changed_fields.add(key);
                }
            }
        });

        // Convert the map to array and convert Sets to arrays
        const changes = Object.values(changesMap)
            .filter(change => change.changed_fields.size > 0)
            .map(change => ({
                ...change,
                changed_fields: Array.from(change.changed_fields)
        }));

        return res.status(200).json({
            success: true,
            data: changes
        });

    } catch (error) {
        console.error('Error fetching highlighted cells:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch highlighted cells',
            error: error.message
        });
    }
};