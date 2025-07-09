const { client_update } = require('../../configuration/database/databaseUpdate.js');

// In-memory storage for bulk operation sessions
const bulkOperationSessions = new Map();

/**
 * Initialize a session for bulk approval operations
 * @param {string} userId - ID of the user making the approval
 * @param {string} tableName - Table name to filter requests
 * @param {boolean} selectAllPages - Whether this is a "select all pages" operation
 * @param {Array} excludedItems - Array of row IDs to exclude when selectAllPages is true
 */
exports.initializeApproveSession = async (userId, tableName, selectAllPages = false, excludedItems = []) => {
  try {
    // Initialize or reset the session
    bulkOperationSessions.set(userId, {
      results: {
        approved: [],
        failed: []
      },
      processingComplete: false,
      tableName,
      selectAllPages,
      excludedItems: excludedItems || [],
      processedRequests: []
    });
    
    console.log(`Initialized bulk approve session for user ${userId}, table ${tableName}, selectAllPages: ${selectAllPages}`);
    
    return true;
  } catch (error) {
    console.error('Error initializing bulk approve session:', error);
    throw error;
  }
};

/**
 * Initialize a session for bulk rejection operations
 * @param {string} userId - ID of the user making the rejection
 * @param {string} tableName - Table name to filter requests
 * @param {string} comments - Rejection comments
 * @param {boolean} selectAllPages - Whether this is a "select all pages" operation
 * @param {Array} excludedItems - Array of row IDs to exclude when selectAllPages is true
 */
exports.initializeRejectSession = async (userId, tableName, comments, selectAllPages = false, excludedItems = []) => {
  try {
    // Initialize or reset the session
    bulkOperationSessions.set(userId, {
      results: {
        rejected: [],
        failed: []
      },
      processingComplete: false,
      tableName,
      comments,
      selectAllPages,
      excludedItems: excludedItems || [],
      processedRequests: []
    });
    
    console.log(`Initialized bulk reject session for user ${userId}, table ${tableName}, selectAllPages: ${selectAllPages}`);
    
    return true;
  } catch (error) {
    console.error('Error initializing bulk reject session:', error);
    throw error;
  }
};

/**
 * Process a chunk of requests for bulk approval
 * @param {Array} chunk - Array of request objects to approve
 * @param {string} userId - ID of the user making the approval
 * @param {number} chunkIndex - Index of the current chunk
 * @param {number} totalChunks - Total number of chunks
 * @param {string} tableName - Optional table name for filtering
 * @param {boolean} selectAllPages - Whether this is a "select all pages" operation
 * @param {Array} excludedItems - Array of row IDs to exclude when selectAllPages is true
 * @returns {Object} Processing results for this chunk
 */
exports.processBulkApproveChunk = async (chunk, userId, chunkIndex, totalChunks, tableName, selectAllPages = false, excludedItems = []) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          approved: [],
          failed: []
        },
        processingComplete: false,
        tableName, // Store table name for filtering
        selectAllPages,
        excludedItems,
        processedRequests: []
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Process each request in the chunk
    const processedRequests = [];
    const failedRequests = [];
    
    // Use a transaction for each chunk
    await client_update.query('BEGIN');
    
    try {
      for (const request of chunk) {
        try {
          // Get full request details if needed
          let fullRequest = request;
          
          // If we only have IDs, fetch the full request data
          if (!request.new_data) {
            const requestQuery = `
              SELECT ct.table_name, ct.new_data, ct.request_id::text as request_id, ct.row_id
              FROM app.change_tracker ct
              WHERE ct.row_id = $1
              AND ct.request_id = $2
              AND ct.status = 'pending';
            `;
            
            const requestResult = await client_update.query(requestQuery, [request.row_id, request.request_id]);
            
            if (requestResult.rowCount === 0) {
              throw new Error(`Request ${request.request_id} not found or already processed`);
            }
            
            fullRequest = requestResult.rows[0];
          }
          
          const { table_name, new_data, row_id } = fullRequest;

          if (!table_name || !new_data) {
            throw new Error(`Invalid data in change_tracker for row_id: ${row_id}. Missing required fields.`);
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
            console.log(`No columns to update for row_id: ${row_id}`);
            continue;
          }

          const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
          const updateValues = updates.map(([, value]) => value);
          updateValues.push(row_id); // Add row_id for WHERE clause

          // Use the SK column in the WHERE clause
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
            WHERE row_id = $4 AND request_id = $5
            RETURNING *;
          `;

          const trackerValues = ['approved', null, userId, row_id, fullRequest.request_id];
          const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

          if (trackerResult.rowCount === 0) {
            throw new Error(`Failed to update change_tracker for row_id: ${row_id}`);
          }
          
          // Record successful processing
          processedRequests.push(request);
          
          // Record in session results
          session.results.approved.push({
            request_id: fullRequest.request_id,
            row_id: fullRequest.row_id
          });
        } catch (error) {
          console.error('Error processing approval request:', error);
          failedRequests.push(request);
          session.results.failed.push({
            request_id: request.request_id,
            row_id: request.row_id,
            error: error.message
          });
        }
      }
      
      // Commit changes for the successful requests
      await client_update.query('COMMIT');
    } catch (error) {
      // Rollback on error
      await client_update.query('ROLLBACK');
      throw error;
    }
    
    // Store processed requests for later operations
    if (!session.processedRequests) {
      session.processedRequests = [];
    }
    session.processedRequests.push(...processedRequests);
    
    // Return progress information
    return {
      processed: processedRequests.length,
      failed: session.results.failed.slice(-10), // Return the last 10 failures
      failureCount: session.results.failed.length,
      chunkIndex,
      totalChunks
    };
  } catch (error) {
    console.error('Error processing approve chunk:', error);
    throw error;
  }
};

/**
 * Process all pages for bulk approval
 * @param {string} userId - ID of the user making the approval
 * @param {string} tableName - Table name to filter requests
 * @param {Array} excludedIds - Array of row IDs to exclude from approval
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @returns {Object} Processing results
 */
exports.processAllPagesApprove = async (userId, tableName, excludedIds, socket) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          approved: [],
          failed: []
        },
        processingComplete: false,
        tableName,
        excludedIds: excludedIds || []
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Get count of pending requests for this table
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM app.change_tracker
      WHERE status = 'pending'
    `;
    
    if (tableName) {
      countQuery += ` AND table_name = $1`;
    }
    
    const countResult = tableName 
      ? await client_update.query(countQuery, [tableName])
      : await client_update.query(countQuery);
    
    const totalRequests = parseInt(countResult.rows[0].total);
    
    // Process in batches to avoid memory issues
    const batchSize = 50;
    const totalBatches = Math.ceil(totalRequests / batchSize);
    
    await client_update.query('BEGIN');
    
    try {
      let processedCount = 0;
      
      // Send initial status
      if (socket) {
        socket.emit('bulk-approve-processing', {
          status: 'processing_database',
          message: 'Processing approvals in database...',
          totalRequests,
          processedRequests: 0
        });
      }
      
      // Process in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Fetch a batch of requests
        let fetchQuery = `
          SELECT * FROM app.change_tracker 
          WHERE status = 'pending'
        `;
        
        const queryParams = [];
        let paramIndex = 1;
        
        if (tableName) {
          fetchQuery += ` AND table_name = $${paramIndex++}`;
          queryParams.push(tableName);
        }
        
        // Add exclusion if needed
        if (excludedIds && excludedIds.length > 0) {
          fetchQuery += ` AND row_id NOT IN (${excludedIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
          queryParams.push(...excludedIds);
        }
        
        fetchQuery += `
          ORDER BY created_at ASC
          LIMIT ${batchSize} OFFSET ${batchIndex * batchSize}
        `;
        
        const batchResult = await client_update.query(fetchQuery, queryParams);
        const requests = batchResult.rows;
        
        // Process each request in the batch
        for (const request of requests) {
          try {
            // Get column types
            const columnTypesQuery = `
              SELECT column_name, data_type, udt_name
              FROM information_schema.columns
              WHERE table_schema = 'app'
              AND table_name = $1;
            `;
            const columnTypesResult = await client_update.query(columnTypesQuery, [request.table_name]);
            
            const columnTypes = columnTypesResult.rows.reduce((acc, col) => {
              acc[col.column_name] = col.udt_name;
              return acc;
            }, {});

            // Determine the SK column name based on table name
            const skColumnName = `${request.table_name}_sk`;

            // Verify that the SK column exists
            if (!columnTypes[skColumnName]) {
              throw new Error(`SK column ${skColumnName} not found in table ${request.table_name}`);
            }

            // Prepare updates
            const updates = Object.entries(request.new_data)
              .filter(([column]) => column !== 'request_id' && column !== 'row_id')
              .map(([column, value]) => {
                const processedValue = (value === 'null' || value === 'NULL' || value === '') 
                  ? null 
                  : value;
                return [column, processedValue];
              });

            if (updates.length === 0) {
              console.log(`No columns to update for row_id: ${request.row_id}`);
              continue;
            }

            const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
            const updateValues = updates.map(([, value]) => value);
            updateValues.push(request.row_id); // Add row_id for WHERE clause

            // Use the SK column in the WHERE clause
            const whereClause = `WHERE "${skColumnName}" = $${updates.length + 1}`;

            const dynamicUpdateQuery = `
              UPDATE app.${request.table_name}
              SET ${updateColumns}
              ${whereClause}
              RETURNING *;
            `;

            const updateResult = await client_update.query(dynamicUpdateQuery, updateValues);

            if (updateResult.rowCount === 0) {
              throw new Error(`Failed to update record in ${request.table_name}`);
            }

            // Update change_tracker status
            const updateTrackerQuery = `
              UPDATE app.change_tracker
              SET 
                status = $1,
                comments = $2,
                updated_at = NOW(),
                checker = $3
              WHERE row_id = $4 AND request_id = $5
              RETURNING *;
            `;

            const trackerValues = ['approved', null, userId, request.row_id, request.request_id];
            const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

            if (trackerResult.rowCount === 0) {
              throw new Error(`Failed to update change_tracker for row_id: ${request.row_id}`);
            }
            
            session.results.approved.push({
              request_id: request.request_id,
              row_id: request.row_id
            });
          } catch (error) {
            console.error('Error approving request:', error);
            session.results.failed.push({
              request_id: request.request_id,
              row_id: request.row_id,
              error: error.message
            });
          }
          
          processedCount++;
          
          // Send progress updates periodically
          if (socket && (processedCount % 10 === 0 || processedCount === totalRequests)) {
            socket.emit('bulk-approve-processing', {
              status: 'processing_database',
              message: 'Processing approvals in database...',
              totalRequests,
              processedRequests: processedCount,
              approved: session.results.approved.length,
              failed: session.results.failed.length
            });
          }
        }
      }
      
      // Send final status before commit
      if (socket) {
        socket.emit('bulk-approve-processing', {
          status: 'finalizing',
          message: 'Finalizing transaction...',
          totalRequests,
          processedRequests: totalRequests
        });
      }
      
      await client_update.query('COMMIT');
      
      // Prepare final summary
      const summary = {
        total: totalRequests,
        approved: session.results.approved.length,
        failed: session.results.failed.length
      };
      
      // Clean up session
      session.processingComplete = true;
      
      return summary;
    } catch (error) {
      await client_update.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error processing all pages approve:', error);
    throw error;
  }
};

/**
 * Finalize the bulk approval operation by processing all requests in the database
 * @param {string} userId - ID of the user making the approval
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @returns {Object} Final results of the operation
 */
exports.finalizeBulkApprove = async (userId, socket) => {
  try {
    // Get session
    const session = bulkOperationSessions.get(userId);
    if (!session) {
      throw new Error('No active bulk operation session found');
    }
    
    // For "Select All Pages" case, we need to process in the database
    // For regular chunk-based processing, we mostly summarize results
    if (session.selectAllPages) {
      await client_update.query('BEGIN');
      
      try {
        let requestsToProcess = [];
        
        // Build a query to get all pending requests for the table
        let query = `
          SELECT * FROM app.change_tracker 
          WHERE status = 'pending'
        `;
        
        const params = [];
        
        // Add table filter if provided
        if (session.tableName) {
          query += ` AND table_name = $1`;
          params.push(session.tableName);
        }
        
        // Add exclusion for specific row IDs
        if (session.excludedItems && session.excludedItems.length > 0) {
          // For large exclusion lists, we need to handle them differently
          if (session.excludedItems.length > 1000) {
            console.log(`Large exclusion list (${session.excludedItems.length} items), using chunked approach`);
            
            // Process in smaller batches with multiple queries
            const chunkSize = 500;
            let filteredRequests = [];
            
            // Get all pending requests first
            let baseQuery = `
              SELECT * FROM app.change_tracker 
              WHERE status = 'pending'
            `;
            
            if (session.tableName) {
              baseQuery += ` AND table_name = $1`;
            }
            
            baseQuery += ` ORDER BY created_at ASC`;
            
            const allRequests = session.tableName 
              ? await client_update.query(baseQuery, [session.tableName])
              : await client_update.query(baseQuery);
            
            // Filter out excluded items in memory
            filteredRequests = allRequests.rows.filter(
              request => !session.excludedItems.includes(request.row_id)
            );
            
            requestsToProcess = filteredRequests;
          } else {
            // Use regular parameter binding for smaller lists
            query += ` AND row_id NOT IN (${session.excludedItems.map((_, idx) => `$${params.length + idx + 1}`).join(',')})`;
            params.push(...session.excludedItems);
          }
        }
        
        // Order by creation date
        query += ` ORDER BY created_at ASC`;
        
        // Execute query to get all requests
        const result = await client_update.query(query, params);
        requestsToProcess = result.rows;
        
        console.log(`Processing ${requestsToProcess.length} requests for all pages`);
        
        const totalRequests = requestsToProcess.length;
        
        // Send initial database processing status
        if (socket) {
          socket.emit('bulk-approve-processing', {
            status: 'processing_database',
            message: 'Processing approvals in database...',
            totalRequests,
            processedRequests: 0
          });
        }
        
        // Process requests in batches to avoid memory issues
        const processBatchSize = 50;
        const totalBatches = Math.ceil(totalRequests / processBatchSize);
        
        let processedCount = 0;
        let successCount = 0;
        let failureCount = 0;
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * processBatchSize;
          const batchEnd = Math.min(batchStart + processBatchSize, totalRequests);
          const batch = requestsToProcess.slice(batchStart, batchEnd);
          
          // Process each request in the batch
          for (const request of batch) {
            try {
              // Get column types
              const columnTypesQuery = `
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'app'
                AND table_name = $1;
              `;
              const columnTypesResult = await client_update.query(columnTypesQuery, [request.table_name]);
              
              const columnTypes = columnTypesResult.rows.reduce((acc, col) => {
                acc[col.column_name] = col.udt_name;
                return acc;
              }, {});

              // Determine the SK column name based on table name
              const skColumnName = `${request.table_name}_sk`;

              // Verify that the SK column exists
              if (!columnTypes[skColumnName]) {
                throw new Error(`SK column ${skColumnName} not found in table ${request.table_name}`);
              }

              // Prepare updates
              const updates = Object.entries(request.new_data)
                .filter(([column]) => column !== 'request_id' && column !== 'row_id')
                .map(([column, value]) => {
                  const processedValue = (value === 'null' || value === 'NULL' || value === '') 
                    ? null 
                    : value;
                  return [column, processedValue];
                });

              if (updates.length === 0) {
                console.log(`No columns to update for row_id: ${request.row_id}`);
                continue;
              }

              const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
              const updateValues = updates.map(([, value]) => value);
              updateValues.push(request.row_id); // Add row_id for WHERE clause

              // Use the SK column in the WHERE clause
              const whereClause = `WHERE "${skColumnName}" = $${updates.length + 1}`;

              const dynamicUpdateQuery = `
                UPDATE app.${request.table_name}
                SET ${updateColumns}
                ${whereClause}
                RETURNING *;
              `;

              const updateResult = await client_update.query(dynamicUpdateQuery, updateValues);

              if (updateResult.rowCount === 0) {
                throw new Error(`Failed to update record in ${request.table_name}`);
              }

              // Update change_tracker status
              const updateTrackerQuery = `
                UPDATE app.change_tracker
                SET 
                  status = $1,
                  comments = $2,
                  updated_at = NOW(),
                  checker = $3
                WHERE row_id = $4 AND request_id = $5 AND status = 'pending'
                RETURNING *;
              `;

              const trackerValues = ['approved', null, userId, request.row_id, request.request_id];
              const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

              if (trackerResult.rowCount === 0) {
                throw new Error(`Failed to update change_tracker for row_id: ${request.row_id}`);
              }
              
              session.results.approved.push({
                request_id: request.request_id,
                row_id: request.row_id
              });
              
              successCount++;
            } catch (error) {
              console.error('Error approving request:', error);
              session.results.failed.push({
                request_id: request.request_id,
                row_id: request.row_id,
                error: error.message
              });
              
              failureCount++;
            }
            
            processedCount++;
            
            // Send progress updates periodically
            if (socket && (
                processedCount % Math.max(1, Math.floor(totalRequests / 20)) === 0 || 
                processedCount === totalRequests || 
                processedCount === 1 ||
                processedCount === Math.floor(totalRequests / 4) || 
                processedCount === Math.floor(totalRequests / 2) || 
                processedCount === Math.floor(3 * totalRequests / 4)
              )) {
              socket.emit('bulk-approve-processing', {
                status: 'processing_database',
                message: 'Processing approvals in database...',
                totalRequests,
                processedRequests: processedCount,
                approved: successCount,
                failed: failureCount
              });
            }
          }
        }
        
        // Send final status before commit
        if (socket) {
          socket.emit('bulk-approve-processing', {
            status: 'finalizing',
            message: 'Finalizing transaction...',
            totalRequests,
            processedRequests: processedCount,
            approved: successCount,
            failed: failureCount
          });
        }
        
        await client_update.query('COMMIT');
        
        // Prepare final summary
        const summary = {
          total: totalRequests,
          approved: successCount,
          failed: failureCount
        };
        
        // Clean up session
        session.processingComplete = true;
        
        return summary;
      } catch (error) {
        await client_update.query('ROLLBACK');
        throw error;
      }
    } else {
      // For chunk-based processing, we've already processed the requests in processBulkApproveChunk
      // So just summarize the results
      const successCount = session.results.approved.length;
      const failureCount = session.results.failed.length;
      const totalRequests = successCount + failureCount;
      
      // Send summary update
      if (socket) {
        socket.emit('bulk-approve-processing', {
          status: 'finalizing',
          message: 'Finalizing operation...',
          totalRequests,
          processedRequests: totalRequests,
          approved: successCount,
          failed: failureCount
        });
      }
      
      // Prepare final summary
      const summary = {
        total: totalRequests,
        approved: successCount,
        failed: failureCount
      };
      
      // Clean up session
      session.processingComplete = true;
      
      return summary;
    }
  } catch (error) {
    console.error('Error finalizing bulk approve:', error);
    throw error;
  }
};

/**
 * Process a chunk of requests for bulk rejection
 * @param {Array} chunk - Array of request objects to reject
 * @param {string} userId - ID of the user making the rejection
 * @param {number} chunkIndex - Index of the current chunk
 * @param {number} totalChunks - Total number of chunks
 * @param {string} tableName - Optional table name for filtering
 * @param {boolean} selectAllPages - Whether this is a "select all pages" operation
 * @param {Array} excludedItems - Array of row IDs to exclude when selectAllPages is true
 * @returns {Object} Processing results for this chunk
 */
exports.processBulkRejectChunk = async (chunk, userId, comments, chunkIndex, totalChunks, tableName, selectAllPages = false, excludedItems = []) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          rejected: [],
          failed: []
        },
        processingComplete: false,
        comments,
        tableName, // Store table name for filtering
        selectAllPages,
        excludedItems,
        processedRequests: []
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Process each request in the chunk
    const processedRequests = [];
    const failedRequests = [];
    
    // Use a transaction for each chunk
    await client_update.query('BEGIN');
    
    try {
      for (const request of chunk) {
        try {
          // Get full request details if needed
          let fullRequest = request;
          
          // If we only have IDs, fetch the full request data
          if (!request.new_data) {
            const requestQuery = `
              SELECT * FROM app.change_tracker 
              WHERE request_id = $1 AND status = 'pending'
            `;
            
            const requestResult = await client_update.query(requestQuery, [request.request_id]);
            
            if (requestResult.rows.length === 0) {
              throw new Error(`Request ${request.request_id} not found or already processed`);
            }
            
            fullRequest = requestResult.rows[0];
          }
          
          // Update the change tracker status to rejected
          const updateTrackerQuery = `
            UPDATE app.change_tracker
            SET status = 'rejected',
                checker = $1,
                updated_at = CURRENT_TIMESTAMP,
                comments = $2
            WHERE request_id = $3
            RETURNING *;
          `;
          
          await client_update.query(updateTrackerQuery, [
            userId,
            comments,
            fullRequest.request_id
          ]);
          
          // Record successful processing
          processedRequests.push(request);
          
          // Record in session results
          session.results.rejected.push({
            request_id: fullRequest.request_id,
            row_id: fullRequest.row_id
          });
        } catch (error) {
          console.error('Error processing rejection request:', error);
          failedRequests.push(request);
          session.results.failed.push({
            request_id: request.request_id,
            row_id: request.row_id,
            error: error.message
          });
        }
      }
      
      // Commit changes for the successful requests
      await client_update.query('COMMIT');
    } catch (error) {
      // Rollback on error
      await client_update.query('ROLLBACK');
      throw error;
    }
    
    // Store processed requests for later operations
    if (!session.processedRequests) {
      session.processedRequests = [];
    }
    session.processedRequests.push(...processedRequests);
    
    // Return progress information
    return {
      processed: processedRequests.length,
      failed: session.results.failed.slice(-10), // Return the last 10 failures
      failureCount: session.results.failed.length,
      chunkIndex,
      totalChunks
    };
  } catch (error) {
    console.error('Error processing reject chunk:', error);
    throw error;
  }
};

/**
 * Process all pages for bulk rejection
 * @param {string} userId - ID of the user making the rejection
 * @param {string} tableName - Table name to filter requests
 * @param {Array} excludedIds - Array of row IDs to exclude from rejection
 * @param {string} comments - Rejection comments
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @returns {Object} Processing results
 */
exports.processAllPagesReject = async (userId, tableName, excludedIds, comments, socket) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          rejected: [],
          failed: []
        },
        processingComplete: false,
        tableName,
        excludedIds: excludedIds || [],
        comments
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Get count of pending requests for this table
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM app.change_tracker
      WHERE status = 'pending'
    `;
    
    if (tableName) {
      countQuery += ` AND table_name = $1`;
    }
    
    const countResult = tableName 
      ? await client_update.query(countQuery, [tableName])
      : await client_update.query(countQuery);
    
    const totalRequests = parseInt(countResult.rows[0].total);
    
    // Process in batches to avoid memory issues
    const batchSize = 50;
    const totalBatches = Math.ceil(totalRequests / batchSize);
    
    await client_update.query('BEGIN');
    
    try {
      let processedCount = 0;
      
      // Send initial status
      if (socket) {
        socket.emit('bulk-reject-processing', {
          status: 'processing_database',
          message: 'Processing rejections in database...',
          totalRequests,
          processedRequests: 0
        });
      }
      
      // Process in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Fetch a batch of requests
        let fetchQuery = `
          SELECT * FROM app.change_tracker 
          WHERE status = 'pending'
        `;
        
        const queryParams = [];
        let paramIndex = 1;
        
        if (tableName) {
          fetchQuery += ` AND table_name = $${paramIndex++}`;
          queryParams.push(tableName);
        }
        
        // Add exclusion if needed
        if (excludedIds && excludedIds.length > 0) {
          fetchQuery += ` AND row_id NOT IN (${excludedIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
          queryParams.push(...excludedIds);
        }
        
        fetchQuery += `
          ORDER BY created_at ASC
          LIMIT ${batchSize} OFFSET ${batchIndex * batchSize}
        `;
        
        const batchResult = await client_update.query(fetchQuery, queryParams);
        const requests = batchResult.rows;
        
        // Process each request in the batch
        for (const request of requests) {
          try {
            // Update the change tracker status to rejected
            const updateTrackerQuery = `
              UPDATE app.change_tracker
              SET status = 'rejected',
                  checker = $1,
                  updated_at = CURRENT_TIMESTAMP,
                  comments = $3
              WHERE request_id = $2
              RETURNING *;
            `;
            
            await client_update.query(updateTrackerQuery, [userId, request.request_id, comments]);
            
            session.results.rejected.push({
              request_id: request.request_id,
              row_id: request.row_id
            });
          } catch (error) {
            console.error('Error rejecting request:', error);
            session.results.failed.push({
              request_id: request.request_id,
              row_id: request.row_id,
              error: error.message
            });
          }
          
          processedCount++;
          
          // Send progress updates periodically
          if (socket && (processedCount % 10 === 0 || processedCount === totalRequests)) {
            socket.emit('bulk-reject-processing', {
              status: 'processing_database',
              message: 'Processing rejections in database...',
              totalRequests,
              processedRequests: processedCount,
              rejected: session.results.rejected.length,
              failed: session.results.failed.length
            });
          }
        }
      }
      
      // Send final status before commit
      if (socket) {
        socket.emit('bulk-reject-processing', {
          status: 'finalizing',
          message: 'Finalizing transaction...',
          totalRequests,
          processedRequests: totalRequests
        });
      }
      
      await client_update.query('COMMIT');
      
      // Prepare final summary
      const summary = {
        total: totalRequests,
        rejected: session.results.rejected.length,
        failed: session.results.failed.length
      };
      
      // Clean up session
      session.processingComplete = true;
      
      return summary;
    } catch (error) {
      await client_update.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error processing all pages reject:', error);
    throw error;
  }
};

/**
 * Finalize the bulk rejection operation by processing all requests in the database
 * @param {string} userId - ID of the user making the rejection
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @param {string} [commentsOverride] - Optional comments to use if session doesn't have them
 * @returns {Object} Final results of the operation
 */
exports.finalizeBulkReject = async (userId, socket, commentsOverride = null) => {
  try {
    // Get session
    const session = bulkOperationSessions.get(userId);
    if (!session) {
      throw new Error('No active bulk operation session found');
    }
    
    // Use comments from session or override
    const comments = session.comments || commentsOverride;
    if (!comments) {
      throw new Error('Rejection comments are required');
    }
    
    // For "Select All Pages" case, we need to process in the database
    // For regular chunk-based processing, we mostly summarize results
    if (session.selectAllPages) {
      await client_update.query('BEGIN');
      
      try {
        let requestsToProcess = [];
        
        // Build a query to get all pending requests for the table
        let query = `
          SELECT * FROM app.change_tracker 
          WHERE status = 'pending'
        `;
        
        const params = [];
        
        // Add table filter if provided
        if (session.tableName) {
          query += ` AND table_name = $1`;
          params.push(session.tableName);
        }
        
        // Add exclusion for specific row IDs
        if (session.excludedItems && session.excludedItems.length > 0) {
          // For large exclusion lists, we need to handle them differently
          if (session.excludedItems.length > 1000) {
            console.log(`Large exclusion list (${session.excludedItems.length} items), using chunked approach`);
            
            // Process in smaller batches with multiple queries
            const chunkSize = 500;
            let filteredRequests = [];
            
            // Get all pending requests first
            let baseQuery = `
              SELECT * FROM app.change_tracker 
              WHERE status = 'pending'
            `;
            
            if (session.tableName) {
              baseQuery += ` AND table_name = $1`;
            }
            
            baseQuery += ` ORDER BY created_at ASC`;
            
            const allRequests = session.tableName 
              ? await client_update.query(baseQuery, [session.tableName])
              : await client_update.query(baseQuery);
            
            // Filter out excluded items in memory
            filteredRequests = allRequests.rows.filter(
              request => !session.excludedItems.includes(request.row_id)
            );
            
            requestsToProcess = filteredRequests;
          } else {
            // Use regular parameter binding for smaller lists
            query += ` AND row_id NOT IN (${session.excludedItems.map((_, idx) => `$${params.length + idx + 1}`).join(',')})`;
            params.push(...session.excludedItems);
          }
        }
        
        // Order by creation date
        query += ` ORDER BY created_at ASC`;
        
        // Execute query to get all requests
        const result = await client_update.query(query, params);
        requestsToProcess = result.rows;
        
        console.log(`Processing ${requestsToProcess.length} requests for all pages`);
        
        const totalRequests = requestsToProcess.length;
        
        // Send initial database processing status
        if (socket) {
          socket.emit('bulk-reject-processing', {
            status: 'processing_database',
            message: 'Processing rejections in database...',
            totalRequests,
            processedRequests: 0
          });
        }
        
        // Process requests in batches to avoid memory issues
        const processBatchSize = 50;
        const totalBatches = Math.ceil(totalRequests / processBatchSize);
        
        let processedCount = 0;
        let successCount = 0;
        let failureCount = 0;
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * processBatchSize;
          const batchEnd = Math.min(batchStart + processBatchSize, totalRequests);
          const batch = requestsToProcess.slice(batchStart, batchEnd);
          
          // Process each request in the batch
          for (const request of batch) {
            try {
              // Get column types
              const columnTypesQuery = `
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'app'
                AND table_name = $1;
              `;
              const columnTypesResult = await client_update.query(columnTypesQuery, [request.table_name]);
              
              const columnTypes = columnTypesResult.rows.reduce((acc, col) => {
                acc[col.column_name] = col.udt_name;
                return acc;
              }, {});

              // Determine the SK column name based on table name
              const skColumnName = `${request.table_name}_sk`;

              // Verify that the SK column exists
              if (!columnTypes[skColumnName]) {
                throw new Error(`SK column ${skColumnName} not found in table ${request.table_name}`);
              }

              // Prepare updates
              const updates = Object.entries(request.new_data)
                .filter(([column]) => column !== 'request_id' && column !== 'row_id')
                .map(([column, value]) => {
                  const processedValue = (value === 'null' || value === 'NULL' || value === '') 
                    ? null 
                    : value;
                  return [column, processedValue];
                });

              if (updates.length === 0) {
                console.log(`No columns to update for row_id: ${request.row_id}`);
                continue;
              }

              const updateColumns = updates.map(([column], index) => `"${column}" = $${index + 1}`).join(', ');
              const updateValues = updates.map(([, value]) => value);
              updateValues.push(request.row_id); // Add row_id for WHERE clause

              // Use the SK column in the WHERE clause
              const whereClause = `WHERE "${skColumnName}" = $${updates.length + 1}`;

              const dynamicUpdateQuery = `
                UPDATE app.${request.table_name}
                SET ${updateColumns}
                ${whereClause}
                RETURNING *;
              `;

              const updateResult = await client_update.query(dynamicUpdateQuery, updateValues);

              if (updateResult.rowCount === 0) {
                throw new Error(`Failed to update record in ${request.table_name}`);
              }

              // Update change_tracker status
              const updateTrackerQuery = `
                UPDATE app.change_tracker
                SET 
                  status = $1,
                  comments = $2,
                  updated_at = NOW(),
                  checker = $3
                WHERE row_id = $4 AND request_id = $5 AND status = 'pending'
                RETURNING *;
              `;

              const trackerValues = ['rejected', null, userId, request.row_id, request.request_id];
              const trackerResult = await client_update.query(updateTrackerQuery, trackerValues);

              if (trackerResult.rowCount === 0) {
                throw new Error(`Failed to update change_tracker for row_id: ${request.row_id}`);
              }
              
              session.results.rejected.push({
                request_id: request.request_id,
                row_id: request.row_id
              });
              
              successCount++;
            } catch (error) {
              console.error('Error rejecting request:', error);
              session.results.failed.push({
                request_id: request.request_id,
                row_id: request.row_id,
                error: error.message
              });
              
              failureCount++;
            }
            
            processedCount++;
            
            // Send progress updates periodically
            if (socket && (
                processedCount % Math.max(1, Math.floor(totalRequests / 20)) === 0 || 
                processedCount === totalRequests || 
                processedCount === 1 ||
                processedCount === Math.floor(totalRequests / 4) || 
                processedCount === Math.floor(totalRequests / 2) || 
                processedCount === Math.floor(3 * totalRequests / 4)
              )) {
              socket.emit('bulk-reject-processing', {
                status: 'processing_database',
                message: 'Processing rejections in database...',
                totalRequests,
                processedRequests: processedCount,
                rejected: successCount,
                failed: failureCount
              });
            }
          }
        }
        
        // Send final status before commit
        if (socket) {
          socket.emit('bulk-reject-processing', {
            status: 'finalizing',
            message: 'Finalizing transaction...',
            totalRequests,
            processedRequests: processedCount,
            rejected: successCount,
            failed: failureCount
          });
        }
        
        await client_update.query('COMMIT');
        
        // Prepare final summary
        const summary = {
          total: totalRequests,
          rejected: successCount,
          failed: failureCount
        };
        
        // Clean up session
        session.processingComplete = true;
        
        return summary;
      } catch (error) {
        await client_update.query('ROLLBACK');
        throw error;
      }
    } else {
      // For chunk-based processing, we've already processed the requests in processBulkRejectChunk
      // So just summarize the results
      const successCount = session.results.rejected.length;
      const failureCount = session.results.failed.length;
      const totalRequests = successCount + failureCount;
      
      // Send summary update
      if (socket) {
        socket.emit('bulk-reject-processing', {
          status: 'finalizing',
          message: 'Finalizing operation...',
          totalRequests,
          processedRequests: totalRequests,
          rejected: successCount,
          failed: failureCount
        });
      }
      
      // Prepare final summary
      const summary = {
        total: totalRequests,
        rejected: successCount,
        failed: failureCount
      };
      
      // Clean up session
      session.processingComplete = true;
      
      return summary;
    }
  } catch (error) {
    console.error('Error finalizing bulk reject:', error);
    throw error;
  }
};

/**
 * Clean up a bulk operation session
 * @param {string} userId - ID of the user whose session to clean up
 */
exports.cleanupSession = (userId) => {
  if (bulkOperationSessions.has(userId)) {
    bulkOperationSessions.delete(userId);
    return true;
  }
  return false;
};