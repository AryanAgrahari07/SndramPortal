const { client_update } = require('../../configuration/database/databaseUpdate.js');
const { v4: uuidv4 } = require('uuid');
const { validateField } = require('../../middleware/dataValidation');

// In-memory storage for upload sessions
const uploadSessions = new Map();

/**
 * Process a chunk of CSV data
 * @param {Array} chunk - Array of objects representing rows from CSV
 * @param {string} tableName - Name of the table to update
 * @param {string} userId - ID of the user making the upload
 * @param {number} chunkIndex - Index of the current chunk
 * @param {number} totalChunks - Total number of chunks
 * @returns {Object} Processing results for this chunk
 */
exports.processChunk = async (chunk, tableName, userId, chunkIndex, totalChunks) => {
  try {
    // Initialize session if it doesn't exist
    if (!uploadSessions.has(userId)) {
      uploadSessions.set(userId, {
        tableName,
        results: {
          updates: [],
          inserts: [],
          skipped: [],
          errors: []
        },
        processingComplete: false,
        schema: null,
        primaryKeyColumn: null
      });
    }

    const session = uploadSessions.get(userId);

    // Get table schema and primary key if not already fetched
    if (!session.schema || !session.primaryKeyColumn) {
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
      session.primaryKeyColumn = pkResult.rows[0]?.column_name || `${tableName}_sk`;
      
      // Get column information for validation
      const columnQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = $1;
      `;
      const columnResult = await client_update.query(columnQuery, [tableName]);
      
      // Get validation rules
      const validationQuery = `
        SELECT *
        FROM app.column_validations
        WHERE table_name = $1
        AND is_active = true;
      `;
      const validationResult = await client_update.query(validationQuery, [tableName]);
      
      // Combine column info with validation rules
      session.schema = columnResult.rows.map(column => ({
        ...column,
        validation_rule: validationResult.rows.find(rule => rule.column_name === column.column_name)
      }));
    }
    
    // Process each row in the chunk
    const processedRows = [];
    
    for (const row of chunk) {
      try {
        // Validate the row data
        const validationErrors = {};
        
        for (const [columnName, value] of Object.entries(row)) {
          // Skip empty values for validation
          if (value === null || value === undefined || value === '') continue;
          
          const columnSchema = session.schema.find(col => col.column_name === columnName);
          if (!columnSchema) {
            validationErrors[columnName] = "Invalid column name";
            continue;
          }
          
          const error = await validateField(
            columnName,
            value,
            columnSchema.data_type,
            columnSchema.validation_rule
          );
          
          if (error) {
            validationErrors[columnName] = error;
          }
        }
        
        // If validation errors, add to errors array and skip processing
        if (Object.keys(validationErrors).length > 0) {
          session.results.errors.push({
            data: row,
            errors: validationErrors
          });
          continue;
        }
        
        // Check if row is empty or contains only primary key
        const nonPrimaryKeyValues = Object.entries(row).filter(([key, value]) => {
          return key !== session.primaryKeyColumn && 
                value !== null && 
                value !== undefined && 
                value !== '' &&
                value !== 'null' &&
                value !== 'NULL';
        });

        // Skip if row is empty or has only primary key
        if (nonPrimaryKeyValues.length === 0) {
          session.results.skipped.push({
            id: row[session.primaryKeyColumn] || 'unknown',
            reason: 'Empty row or contains only primary key'
          });
          continue;
        }
        
        // Add to processed rows for database operations
        processedRows.push(row);
      } catch (error) {
        console.error('Error processing row:', error);
        session.results.errors.push({
          data: row,
          errors: { "_general": error.message }
        });
      }
    }
    
    // Store processed rows for later database operations
    if (!session.processedRows) {
      session.processedRows = [];
    }
    session.processedRows.push(...processedRows);
    
    // Return progress information
    return {
      processed: processedRows.length,
      errors: session.results.errors.slice(-10), // Return the last 10 errors (from this chunk)
      errorCount: session.results.errors.length,
      chunkIndex,
      totalChunks
    };
  } catch (error) {
    console.error('Error processing chunk:', error);
    throw error;
  }
};

/**
 * Finalize the upload by processing all rows in the database
 * @param {string} tableName - Name of the table to update
 * @param {string} userId - ID of the user making the upload
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @returns {Object} Final results of the upload
 */
exports.finalizeUpload = async (tableName, userId, socket) => {
  try {
    // Get session
    const session = uploadSessions.get(userId);
    if (!session) {
      throw new Error('No active upload session found');
    }
    
    // Check if there are any validation errors before proceeding
    if (session.results.errors.length > 0) {
      // Send error details to client
      if (socket) {
        socket.emit('csv-validation-failed', {
          status: 'failed',
          message: 'Validation errors found in CSV data',
          totalErrors: session.results.errors.length,
          errors: session.results.errors.slice(0, 100) // Send first 100 errors
        });
      }
      
      // Clean up session
      uploadSessions.delete(userId);
      
      return {
        success: false,
        message: 'Validation failed',
        totalErrors: session.results.errors.length
      };
    }
    
    // If no validation errors, proceed with database operations
    await client_update.query('BEGIN');
    
    try {
      const totalRows = session.processedRows.length;
      
      // Send initial database processing status
      if (socket) {
        socket.emit('csv-db-processing', {
          status: 'processing_database',
          message: 'Processing data in database...',
          totalRows,
          processedRows: 0
        });
      }
      
      for (let i = 0; i < session.processedRows.length; i++) {
        const row = session.processedRows[i];
        let existingRow = null;

        // Check if row exists only if it has a primary key value
        if (row[session.primaryKeyColumn]) {
          const checkQuery = `
            SELECT *
            FROM app.${tableName}
            WHERE ${session.primaryKeyColumn} = $1;
          `;
          
          const exists = await client_update.query(checkQuery, [row[session.primaryKeyColumn]]);
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
            if ((oldValue !== newValue) && 
                !(oldValue === null && (newValue === 'null' || newValue === 'NULL' || newValue === '')) && 
                !((oldValue === 'null' || oldValue === 'NULL' || oldValue === '') && newValue === null) &&
                !((oldValue === 'null' || oldValue === 'NULL' || oldValue === '') && 
                  (newValue === 'null' || newValue === 'NULL' || newValue === ''))) {
              changes[column] = row[column];
              hasChanges = true;
            }
          });

          if (hasChanges) {
            // Create new data by merging existing data with only the changed values
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
              userId, // This is the authenticated user ID from the socket
              requestId,
              tableName,
              row[session.primaryKeyColumn],
            ]);

            session.results.updates.push({
              id: row[session.primaryKeyColumn],
              status: 'pending_approval',
              request_id: requestId,
              changes: changes
            });
          } else {
            // No changes detected for this row
            session.results.skipped.push({
              id: row[session.primaryKeyColumn],
              reason: 'No changes detected'
            });
          }
        } else {
          // For new insertions, only include non-empty values
          const cleanRow = Object.fromEntries(
            Object.entries(row).filter(([key, value]) => 
              key !== session.primaryKeyColumn && 
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
            userId, // This is the authenticated user ID from the socket
            requestId,
          ]);

          session.results.inserts.push({
            status: 'pending_approval',
            request_id: requestId
          });
        }
        
        // Send progress updates every 10 rows or at specific percentage milestones
        if (socket && (i % 10 === 0 || i === totalRows - 1 || i === Math.floor(totalRows / 4) || i === Math.floor(totalRows / 2) || i === Math.floor(3 * totalRows / 4))) {
          socket.emit('csv-db-processing', {
            status: 'processing_database',
            message: 'Processing data in database...',
            totalRows,
            processedRows: i + 1,
            updates: session.results.updates.length,
            inserts: session.results.inserts.length,
            skipped: session.results.skipped.length
          });
        }
      }
      
      // Send final status before commit
      if (socket) {
        socket.emit('csv-db-processing', {
          status: 'finalizing',
          message: 'Finalizing transaction...',
          totalRows,
          processedRows: totalRows
        });
      }
      
      await client_update.query('COMMIT');
      
      // Prepare final summary
      const summary = {
        total: session.processedRows.length,
        updates: session.results.updates.length,
        inserts: session.results.inserts.length,
        skipped: session.results.skipped.length,
        errors: session.results.errors.length
      };
      
      // Clean up session after successful processing
      uploadSessions.delete(userId);
      
      return {
        success: true,
        summary,
        results: session.results
      };
    } catch (error) {
      await client_update.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error finalizing upload:', error);
    throw error;
  }
};

/**
 * Clean up an upload session
 * @param {string} userId - ID of the user whose session to clean up
 */
exports.cleanupSession = (userId) => {
  if (uploadSessions.has(userId)) {
    uploadSessions.delete(userId);
    return true;
  }
  return false;
}; 