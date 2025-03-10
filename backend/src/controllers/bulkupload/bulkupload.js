const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { v4: uuidv4 } = require('uuid');

exports.bulkUpdate = async (req, res) => {
  const { table_name: tableName, data } = req.body;
  const maker = req.user.user_id;

  try {
    await client_update.query('BEGIN');

    const results = {
      updates: [],
      inserts: [],
      skipped: [],
      errors: [],
    };

    // Get primary key column
    const pkQuery = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'app'
        AND tc.table_name = $1;
    `;

    const pkResult = await client_update.query(pkQuery, [tableName]);
    const primaryKeyColumn = pkResult.rows[0]?.column_name || `${tableName}_sk`;

    for (const row of data) {
      try {
        let existingRow = null;

        // Check if row exists only if it has a primary key value
        if (row[primaryKeyColumn]) {
          const checkQuery = `
            SELECT *
            FROM app.${tableName}
            WHERE ${primaryKeyColumn} = $1;
          `;
          
          const exists = await client_update.query(checkQuery, [row[primaryKeyColumn]]);
          existingRow = exists.rows[0];
        }

        if (existingRow) {
          // Compare old and new values to find actual changes
          const changes = {};
          let hasChanges = false;

          // Only check columns that are present in the CSV row
          Object.keys(row).forEach(column => {
            // Skip empty strings, null, or undefined values to preserve existing data
            if (row[column] === '' || row[column] === null || row[column] === undefined) {
              return;
            }
            
            // Convert both values to strings for comparison
            const oldValue = String(existingRow[column] || '');
            const newValue = String(row[column]);

            // Only include if values are different
            if (oldValue !== newValue) {
              changes[column] = row[column];
              hasChanges = true;
            }
          });

          if (hasChanges) {
            // Create new data by merging existing data with only the changed values
            // This ensures we keep old values for fields not present in the update
            const newData = { ...existingRow, ...changes };
            const requestId = uuidv4();

            const trackerQuery = `
              INSERT INTO app.change_tracker (
                table_name, 
                old_data, 
                new_data, 
                status, 
                maker,
                request_id, 
                table_id, 
                row_id,
                created_at,
                updated_at,
                makerseen,
                checkerseen
              )
              VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false)
              RETURNING *;
            `;

            await client_update.query(trackerQuery, [
              tableName,
              existingRow,
              newData,
              maker,
              requestId,
              tableName,
              row[primaryKeyColumn],
            ]);

            results.updates.push({
              id: row[primaryKeyColumn],
              status: 'pending_approval',
              request_id: requestId,
              changes: changes // Shows only what actually changed
            });
          } else {
            // No changes detected for this row
            results.skipped.push({
              id: row[primaryKeyColumn],
              reason: 'No changes detected'
            });
          }
        } else {
          // For new insertions, only include non-empty values
          const cleanRow = Object.fromEntries(
            Object.entries(row).filter(([key, value]) => 
              key !== primaryKeyColumn && 
              key !== `${tableName}_sk` && 
              value !== '' && 
              value !== null && 
              value !== undefined
            )
          );

          const requestId = uuidv4();
          
          const addRowQuery = `
            INSERT INTO app.add_row_table (
              table_name, 
              row_data, 
              status, 
              maker, 
              request_id,
              created_at,
              updated_at
            )
            VALUES ($1, $2, 'pending', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *;
          `;

          await client_update.query(addRowQuery, [
            tableName,
            cleanRow,
            maker,
            requestId,
          ]);

          results.inserts.push({
            status: 'pending_approval',
            request_id: requestId
          });
        }
      } catch (error) {
        console.error('Error processing row:', error);
        results.errors.push({
          data: row,
          error: error.message,
        });
      }
    }

    await client_update.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Bulk update processed successfully',
      results: {
        ...results,
        summary: {
          total: data.length,
          updates: results.updates.length,
          inserts: results.inserts.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        }
      }
    });

  } catch (error) {
    await client_update.query('ROLLBACK');
    console.error('Error in bulk update:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing the bulk update',
      error: error.message,
    });
  }
};