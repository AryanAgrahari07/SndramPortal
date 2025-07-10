const express = require("express");
const app = express();
require("dotenv").config();
const os = require("os");
const hostname = os.hostname();
const { sanitizeInput } = require("./src/middleware/security");
const cors = require("cors");
const PORT = process.env.PORT || 4444;
const cookieParser = require('cookie-parser');
const databaseSecurityMiddleware = require("./src/middleware/databaseSecurity");
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Import WebSocket handlers
const bulkUploadHandler = require('./src/controllers/bulkupload/websocketBulkupload');
const bulkOperationsHandler = require('./src/controllers/checker/websocketBulkOperations');
const adminBulkOperationsHandler = require('./src/controllers/admin/websocketBulkOperations');

if (!process.env.FRONTEND) {
  throw new Error("FRONTEND URL not defined in environment variables");
}

app.use(
  cors({
    origin: process.env.FRONTEND,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Increase JSON payload limit to 100MB
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());


//Middleware
app.use(sanitizeInput);              // sanitization middleware
app.use(databaseSecurityMiddleware); // database security middleware


const routesPath = require("./src/routes/routes.js");
app.use("/", routesPath);

const {
  databaseUpdateConnection,
} = require("./src/configuration/database/databaseUpdate.js");
databaseUpdateConnection();

app.get("/", (req, res) => {
  console.log("welcome in docker");
  res.status(200).json({
    success: true,
    message: "done",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: process.env.FRONTEND,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Extract user information from the auth token
  const token = socket.handshake.auth.token;
  let userId = null;
  
  if (token) {
    try {
      // Get user ID from token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.user_id;
      
      console.log(`Authenticated user connected: ${userId}`);
      
      // Store user ID in socket for later use
      socket.user = {
        user_id: userId
      };
    } catch (error) {
      console.error('Invalid token in WebSocket connection:', error);
      socket.disconnect(true);
      return;
    }
  } else {
    console.error('No authentication token provided');
    socket.disconnect(true);
    return;
  }
  
  // Handle CSV upload via WebSocket
  socket.on('csv-upload-start', (data) => {
    console.log(`CSV upload started for table: ${data.tableName}`);
    // Store socket ID for this upload session
    socket.uploadSession = {
      tableName: data.tableName,
      userId: socket.user.user_id // Use authenticated user ID
    };
  });
  
  // Handle CSV data chunks
  socket.on('csv-data-chunk', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      // Process the chunk and send progress updates
      const result = await bulkUploadHandler.processChunk(
        data.chunk, 
        data.tableName, 
        socket.user.user_id, // Use authenticated user ID
        data.chunkIndex,
        data.totalChunks
      );
      
      // Send progress update
      socket.emit('csv-chunk-processed', {
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        processed: result.processed,
        errors: result.errors || [], // Send actual errors
        errorCount: result.errorCount || 0
      });
    } catch (error) {
      console.error('Error processing CSV chunk:', error);
      socket.emit('csv-upload-error', { 
        error: error.message,
        chunkIndex: data.chunkIndex
      });
    }
  });
  
  // Handle upload completion
  socket.on('csv-upload-complete', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      const result = await bulkUploadHandler.finalizeUpload(
        data.tableName,
        socket.user.user_id, // Use authenticated user ID
        socket // Pass the socket object
      );
      
      socket.emit('csv-upload-finalized', {
        success: true,
        summary: result.summary
      });
    } catch (error) {
      socket.emit('csv-upload-error', { 
        error: error.message,
        stage: 'finalization'
      });
    }
  });


  // Handle bulk reject start
  socket.on('bulk-reject-start', async (data) => {
    try {
      console.log(`Bulk reject operation started by user: ${socket.user.user_id}`);
      
      // Extract data
      const { comments, tableName, selectAllPages, excludedItems } = data;
      
      // Store session data
      socket.rejectSession = {
        comments,
        tableName,
        userId: socket.user.user_id,
        selectAllPages,
        excludedItems
      };
      
      // Initialize the session in the bulk operations handler
      await bulkOperationsHandler.initializeRejectSession(
        socket.user.user_id,
        tableName,
        comments,
        selectAllPages,
        excludedItems || []
      );
      
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
  
  // Handle bulk approve start
  socket.on('bulk-approve-start', async (data) => {
    try {
      console.log(`Bulk approve operation started by user: ${socket.user.user_id}`);
      
      // Extract data
      const { tableName, selectAllPages, excludedItems } = data;
      
      // Store session data
      socket.approveSession = {
        tableName,
        userId: socket.user.user_id,
        selectAllPages,
        excludedItems
      };
      
      // Initialize the session in the bulk operations handler
      await bulkOperationsHandler.initializeApproveSession(
        socket.user.user_id,
        tableName,
        selectAllPages,
        excludedItems || []
      );
      
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
  
  // Handle bulk reject chunks
  socket.on('bulk-reject-chunk', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      console.log('Processing bulk reject chunk:', data.chunkIndex + 1, 'of', data.totalChunks);
      
      // Extract data
      const { chunk, chunkIndex, totalChunks, comments, tableName, selectAllPages } = data;
      
      // Process chunk
      const result = await bulkOperationsHandler.processBulkRejectChunk(
        chunk,
        socket.user.user_id,
        socket.rejectSession?.comments || comments,
        chunkIndex,
        totalChunks,
        tableName || socket.rejectSession?.tableName,
        selectAllPages || socket.rejectSession?.selectAllPages,
        data.excludedItems || socket.rejectSession?.excludedItems || []
      );
      
      // Send progress update
      socket.emit('bulk-reject-chunk-processed', {
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        processed: result.processed,
        failed: result.failed || [],
        failureCount: result.failureCount || 0
      });
    } catch (error) {
      console.error('Error processing bulk reject chunk:', error);
      socket.emit('bulk-reject-error', { 
        error: error.message,
        chunkIndex: data.chunkIndex
      });
    }
  });
  
  // Handle bulk approve chunks
  socket.on('bulk-approve-chunk', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      console.log('Processing bulk approve chunk:', data.chunkIndex + 1, 'of', data.totalChunks);
      
      // Extract data
      const { chunk, chunkIndex, totalChunks, tableName, selectAllPages } = data;
      
      // Process chunk
      const result = await bulkOperationsHandler.processBulkApproveChunk(
        chunk,
        socket.user.user_id,
        chunkIndex,
        totalChunks,
        tableName || socket.approveSession?.tableName,
        selectAllPages || socket.approveSession?.selectAllPages,
        data.excludedItems || socket.approveSession?.excludedItems || []
      );
      
      // Send progress update
      socket.emit('bulk-approve-chunk-processed', {
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        processed: result.processed,
        failed: result.failed || [],
        failureCount: result.failureCount || 0
      });
    } catch (error) {
      console.error('Error processing bulk approve chunk:', error);
      socket.emit('bulk-approve-error', { 
        error: error.message,
        chunkIndex: data.chunkIndex
      });
    }
  });
  
  // Handle bulk reject completion
  socket.on('bulk-reject-complete', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      console.log('Finalizing bulk reject operation');
      
      // Make sure we have comments
      const comments = data?.comments || socket.rejectSession?.comments;
      if (!comments) {
        throw new Error('Rejection comments are required');
      }
      
      // Finalize the operation
      const summary = await bulkOperationsHandler.finalizeBulkReject(
        socket.user.user_id,
        socket,
        comments
      );
      
      // Send completion acknowledgement
      if (data && data.selectAllPages) {
        // Use specific event for all pages operation
        socket.emit('bulk-reject-all-pages-complete', {
          status: 'completed',
          message: 'Bulk reject operation completed for all pages',
          summary
        });
      } else {
        // Regular completion event
        socket.emit('bulk-reject-complete', {
          status: 'completed',
          message: 'Bulk reject operation completed',
          summary
        });
      }
      
      // Clean up session data
      delete socket.rejectSession;
    } catch (error) {
      console.error('Error completing bulk reject:', error);
      socket.emit('bulk-reject-error', { 
        error: error.message,
        stage: 'finalization'
      });
    }
  });
  
  // Handle bulk approve completion
  socket.on('bulk-approve-complete', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      console.log('Finalizing bulk approve operation');
      
      // Finalize the operation
      const summary = await bulkOperationsHandler.finalizeBulkApprove(
        socket.user.user_id,
        socket
      );
      
      // Send completion acknowledgement
      if (data && data.selectAllPages) {
        // Use specific event for all pages operation
        socket.emit('bulk-approve-all-pages-complete', {
          status: 'completed',
          message: 'Bulk approve operation completed for all pages',
          summary
        });
      } else {
        // Regular completion event
        socket.emit('bulk-approve-complete', {
          status: 'completed',
          message: 'Bulk approve operation completed',
          summary
        });
      }
      
      // Clean up session data
      delete socket.approveSession;
    } catch (error) {
      console.error('Error completing bulk approve:', error);
      socket.emit('bulk-approve-error', { 
        error: error.message,
        stage: 'finalization'
      });
    }
  });
  
  // Handle admin bulk operations (unchanged)
  socket.on('admin-bulk-approve-start', (data) => {
    console.log(`Admin bulk approve operation started by user: ${socket.user.user_id}`);
  });
  
  socket.on('admin-bulk-approve-chunk', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      // Process the chunk and send progress updates
      const result = await adminBulkOperationsHandler.processBulkApproveChunk(
        data.chunk,
        socket.user.user_id,
        data.chunkIndex,
        data.totalChunks
      );
      
      // Send progress update
      socket.emit('admin-bulk-approve-chunk-processed', {
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        processed: result.processed,
        failed: result.failed || [],
        failureCount: result.failureCount || 0
      });
    } catch (error) {
      console.error('Error processing admin bulk approve chunk:', error);
      socket.emit('admin-bulk-approve-error', { 
        error: error.message,
        chunkIndex: data.chunkIndex
      });
    }
  });
  
  socket.on('admin-bulk-approve-complete', async () => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      const result = await adminBulkOperationsHandler.finalizeBulkApprove(
        socket.user.user_id,
        socket
      );
      
      socket.emit('admin-bulk-approve-finalized', {
        success: true,
        summary: result.summary
      });
    } catch (error) {
      socket.emit('admin-bulk-approve-error', { 
        error: error.message,
        stage: 'finalization'
      });
    }
  });

  socket.on('admin-bulk-reject-start', (data) => {
    console.log(`Admin bulk reject operation started by user: ${socket.user.user_id}`);
    socket.adminRejectSession = {
      comments: data.comments,
      userId: socket.user.user_id
    };
  });
  
  socket.on('admin-bulk-reject-chunk', async (data) => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      // Process the chunk and send progress updates
      const result = await adminBulkOperationsHandler.processBulkRejectChunk(
        data.chunk,
        socket.user.user_id,
        socket.adminRejectSession?.comments || data.comments,
        data.chunkIndex,
        data.totalChunks
      );
      
      // Send progress update
      socket.emit('admin-bulk-reject-chunk-processed', {
        chunkIndex: data.chunkIndex,
        totalChunks: data.totalChunks,
        processed: result.processed,
        failed: result.failed || [],
        failureCount: result.failureCount || 0
      });
    } catch (error) {
      console.error('Error processing admin bulk reject chunk:', error);
      socket.emit('admin-bulk-reject-error', { 
        error: error.message,
        chunkIndex: data.chunkIndex
      });
    }
  });
  
  socket.on('admin-bulk-reject-complete', async () => {
    try {
      if (!socket.user) {
        throw new Error('Unauthorized: No authenticated user');
      }
      
      const result = await adminBulkOperationsHandler.finalizeBulkReject(
        socket.user.user_id,
        socket
      );
      
      socket.emit('admin-bulk-reject-finalized', {
        success: true,
        summary: result.summary
      });
    } catch (error) {
      socket.emit('admin-bulk-reject-error', { 
        error: error.message,
        stage: 'finalization'
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up any resources if needed
  });
});

// Use server.listen instead of app.listen
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT} and hostname ${hostname}`);
  console.log(`WebSocket server is also running on the same port`);
});
