const { client_update } = require('../../configuration/database/databaseUpdate.js');

// Import the bulk operations controllers
const { 
  processBulkApproveChunk,
  finalizeBulkApprove,
  processBulkRejectChunk,
  finalizeBulkReject
} = require('../checker/websocketBulkOperations');

// In-memory storage for bulk operation sessions
const bulkOperationSessions = new Map();

/**
 * Process a chunk of requests for bulk approval
 * @param {Array} chunk - Array of request objects to approve
 * @param {string} userId - ID of the user making the approval
 * @param {number} chunkIndex - Index of the current chunk
 * @param {number} totalChunks - Total number of chunks
 * @returns {Object} Processing results for this chunk
 */
exports.processBulkApproveChunk = async (chunk, userId, chunkIndex, totalChunks) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          approved: [],
          failed: []
        },
        processingComplete: false
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Process each request in the chunk
    const processedRequests = [];
    
    for (const request of chunk) {
      try {
        // Store for later database operations
        processedRequests.push(request);
      } catch (error) {
        console.error('Error processing request:', error);
        session.results.failed.push({
          request_id: request.request_id,
          error: error.message
        });
      }
    }
    
    // Store processed requests for later database operations
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
 * Process a chunk of requests for bulk rejection
 * @param {Array} chunk - Array of request objects to reject
 * @param {string} userId - ID of the user making the rejection
 * @param {string} comments - Rejection comments
 * @param {number} chunkIndex - Index of the current chunk
 * @param {number} totalChunks - Total number of chunks
 * @returns {Object} Processing results for this chunk
 */
exports.processBulkRejectChunk = async (chunk, userId, comments, chunkIndex, totalChunks) => {
  try {
    // Initialize session if it doesn't exist
    if (!bulkOperationSessions.has(userId)) {
      bulkOperationSessions.set(userId, {
        results: {
          rejected: [],
          failed: []
        },
        processingComplete: false,
        comments
      });
    }

    const session = bulkOperationSessions.get(userId);
    
    // Process each request in the chunk
    const processedRequests = [];
    
    for (const request of chunk) {
      try {
        // Store for later database operations
        processedRequests.push(request);
      } catch (error) {
        console.error('Error processing request:', error);
        session.results.failed.push({
          request_id: request.request_id,
          error: error.message
        });
      }
    }
    
    // Store processed requests for later database operations
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
    
    await client_update.query('BEGIN');
    
    try {
      const totalRequests = session.processedRequests.length;
      
      // Send initial database processing status
      if (socket) {
        socket.emit('bulk-approve-processing', {
          status: 'processing_database',
          message: 'Processing approvals in database...',
          totalRequests,
          processedRequests: 0
        });
      }
      
      for (let i = 0; i < session.processedRequests.length; i++) {
        const request = session.processedRequests[i];
        
        try {
          // Get the row request details
          const getRequestQuery = `
            SELECT * FROM app.add_row_table 
            WHERE request_id = $1
          `;
          
          const requestResult = await client_update.query(getRequestQuery, [
            request.request_id
          ]);
          
          if (requestResult.rows.length === 0) {
            throw new Error('Request not found or already processed');
          }
          
          const rowRequest = requestResult.rows[0];
          
          // Insert the row data into the target table
          const tableName = rowRequest.table_name;
          const rowData = rowRequest.row_data;
          
          // Get column names and values
          const columnNames = Object.keys(rowData);
          const columnValues = Object.values(rowData);
          
          // Create placeholders for the SQL query
          const placeholders = columnNames.map((_, idx) => `$${idx + 1}`).join(', ');
          
          // Build the insert query
          const insertQuery = `
            INSERT INTO app.${tableName} (${columnNames.join(', ')})
            VALUES (${placeholders});
          `;
          
          await client_update.query(insertQuery, columnValues);
          
          // Update the add_row_table status
          const updateStatusQuery = `
            UPDATE app.add_row_table
            SET status = 'approve',
                admin = $1,
                updated_at = NOW()
            WHERE request_id = $2
            RETURNING *;
          `;
          
          await client_update.query(updateStatusQuery, [userId, rowRequest.request_id]);
          
          session.results.approved.push({
            request_id: rowRequest.request_id
          });
        } catch (error) {
          console.error('Error approving request:', error);
          session.results.failed.push({
            request_id: request.request_id,
            error: error.message
          });
        }
        
        // Send progress updates every 10 requests or at specific percentage milestones
        if (socket && (i % 10 === 0 || i === totalRequests - 1 || i === Math.floor(totalRequests / 4) || i === Math.floor(totalRequests / 2) || i === Math.floor(3 * totalRequests / 4))) {
          socket.emit('bulk-approve-processing', {
            status: 'processing_database',
            message: 'Processing approvals in database...',
            totalRequests,
            processedRequests: i + 1,
            approved: session.results.approved.length,
            failed: session.results.failed.length
          });
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
        total: session.processedRequests.length,
        approved: session.results.approved.length,
        failed: session.results.failed.length
      };
      
      // Clean up session after successful processing
      bulkOperationSessions.delete(userId);
      
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
    console.error('Error finalizing bulk approve:', error);
    throw error;
  }
};

/**
 * Finalize the bulk rejection operation by processing all requests in the database
 * @param {string} userId - ID of the user making the rejection
 * @param {Object} socket - Socket.IO socket for sending progress updates
 * @returns {Object} Final results of the operation
 */
exports.finalizeBulkReject = async (userId, socket) => {
  try {
    // Get session
    const session = bulkOperationSessions.get(userId);
    if (!session) {
      throw new Error('No active bulk operation session found');
    }
    
    await client_update.query('BEGIN');
    
    try {
      const totalRequests = session.processedRequests.length;
      const comments = session.comments;
      
      // Send initial database processing status
      if (socket) {
        socket.emit('bulk-reject-processing', {
          status: 'processing_database',
          message: 'Processing rejections in database...',
          totalRequests,
          processedRequests: 0
        });
      }
      
      for (let i = 0; i < session.processedRequests.length; i++) {
        const request = session.processedRequests[i];
        
        try {
          // Update the add_row_table status
          const updateStatusQuery = `
            UPDATE app.add_row_table
            SET status = 'rejected',
                admin = $1,
                comments = $2,
                updated_at = NOW()
            WHERE request_id = $3
            RETURNING *;
          `;
          
          const result = await client_update.query(updateStatusQuery, [
            userId, 
            comments, 
            request.request_id
          ]);
          
          if (result.rows.length === 0) {
            throw new Error('Request not found or already processed');
          }
          
          session.results.rejected.push({
            request_id: request.request_id
          });
        } catch (error) {
          console.error('Error rejecting request:', error);
          session.results.failed.push({
            request_id: request.request_id,
            error: error.message
          });
        }
        
        // Send progress updates every 10 requests or at specific percentage milestones
        if (socket && (i % 10 === 0 || i === totalRequests - 1 || i === Math.floor(totalRequests / 4) || i === Math.floor(totalRequests / 2) || i === Math.floor(3 * totalRequests / 4))) {
          socket.emit('bulk-reject-processing', {
            status: 'processing_database',
            message: 'Processing rejections in database...',
            totalRequests,
            processedRequests: i + 1,
            rejected: session.results.rejected.length,
            failed: session.results.failed.length
          });
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
        total: session.processedRequests.length,
        rejected: session.results.rejected.length,
        failed: session.results.failed.length
      };
      
      // Clean up session after successful processing
      bulkOperationSessions.delete(userId);
      
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

// WebSocket handler for bulk operations
exports.setupBulkOperationsWebsocket = (io) => {
  // Create a namespace for bulk operations
  const bulkOperationsNamespace = io.of('/bulk-operations');

  bulkOperationsNamespace.on('connection', (socket) => {
    console.log('Client connected to bulk operations namespace:', socket.id);
    
    // Store user ID from handshake auth
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      console.log('No user ID provided, disconnecting');
      socket.disconnect(true);
      return;
    }
    
    // Handle bulk approve start
    socket.on('bulk-approve-start', async (data) => {
      try {
        console.log('Bulk approve start:', data);
        
        // Extract data
        const { tableName, selectAllPages, excludedItems } = data;
        
        // Send acknowledgement
        socket.emit('bulk-approve-started', {
          status: 'started',
          message: 'Bulk approve operation started',
          selectAllPages,
          tableName
        });
      } catch (error) {
        console.error('Error starting bulk approve:', error);
        socket.emit('bulk-approve-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle bulk approve chunk
    socket.on('bulk-approve-chunk', async (data) => {
      try {
        console.log('Processing bulk approve chunk:', data.chunkIndex + 1, 'of', data.totalChunks);
        
        // Extract data
        const { chunk, chunkIndex, totalChunks, tableName, selectAllPages } = data;
        
        // Process chunk
        const result = await processBulkApproveChunk(
          chunk, 
          userId, 
          chunkIndex, 
          totalChunks, 
          tableName,
          selectAllPages,
          data.excludedItems || []
        );
        
        // Send chunk processed acknowledgement
        socket.emit('bulk-approve-chunk-processed', {
          status: 'chunk_processed',
          chunkIndex,
          totalChunks,
          processed: result.processed,
          failed: result.failed,
          failureCount: result.failureCount
        });
      } catch (error) {
        console.error('Error processing bulk approve chunk:', error);
        socket.emit('bulk-approve-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle bulk approve complete
    socket.on('bulk-approve-complete', async (data) => {
      try {
        console.log('Finalizing bulk approve operation');
        
        // Finalize the operation
        const summary = await finalizeBulkApprove(userId, socket);
        
        // Send completion acknowledgement
        socket.emit('bulk-approve-completed', {
          status: 'completed',
          message: 'Bulk approve operation completed',
          summary
        });
      } catch (error) {
        console.error('Error completing bulk approve:', error);
        socket.emit('bulk-approve-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle bulk reject start
    socket.on('bulk-reject-start', async (data) => {
      try {
        console.log('Bulk reject start:', data);
        
        // Extract data
        const { comments, tableName, selectAllPages, excludedItems } = data;
        
        // Send acknowledgement
        socket.emit('bulk-reject-started', {
          status: 'started',
          message: 'Bulk reject operation started',
          selectAllPages,
          tableName
        });
      } catch (error) {
        console.error('Error starting bulk reject:', error);
        socket.emit('bulk-reject-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle bulk reject chunk
    socket.on('bulk-reject-chunk', async (data) => {
      try {
        console.log('Processing bulk reject chunk:', data.chunkIndex + 1, 'of', data.totalChunks);
        
        // Extract data
        const { chunk, chunkIndex, totalChunks, comments, tableName, selectAllPages } = data;
        
        // Process chunk
        const result = await processBulkRejectChunk(
          chunk, 
          userId, 
          comments, 
          chunkIndex, 
          totalChunks, 
          tableName,
          selectAllPages,
          data.excludedItems || []
        );
        
        // Send chunk processed acknowledgement
        socket.emit('bulk-reject-chunk-processed', {
          status: 'chunk_processed',
          chunkIndex,
          totalChunks,
          processed: result.processed,
          failed: result.failed,
          failureCount: result.failureCount
        });
      } catch (error) {
        console.error('Error processing bulk reject chunk:', error);
        socket.emit('bulk-reject-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle bulk reject complete
    socket.on('bulk-reject-complete', async (data) => {
      try {
        console.log('Finalizing bulk reject operation');
        
        // Finalize the operation
        const summary = await finalizeBulkReject(userId, socket);
        
        // Send completion acknowledgement
        socket.emit('bulk-reject-completed', {
          status: 'completed',
          message: 'Bulk reject operation completed',
          summary
        });
      } catch (error) {
        console.error('Error completing bulk reject:', error);
        socket.emit('bulk-reject-error', {
          status: 'error',
          message: error.message
        });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected from bulk operations namespace:', socket.id);
    });
  });
  
  return bulkOperationsNamespace;
}; 