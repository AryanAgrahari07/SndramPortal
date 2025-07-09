import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileWarning
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL, ENDPOINTS } from "@/config/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/Pagination";
import { ChangesDialog } from "@/components/ChangesDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BulkOperationProgress } from "@/components/BulkOperationProgress";
import { io, Socket } from "socket.io-client";


interface ChangeRequest {
  request_id: string;
  table_name: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  status: "pending";
  maker: string;
  checker: string | null;
  created_at: string;
  updated_at: string;
  comments: string | null;
  table_id: string;
  row_id: string;
  maker_email?: string;
}

interface ApiResponse {
  success: boolean;
  data: ChangeRequest[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ColumnMapping {
  original_column_name: string;
  renamed_column_name: string;
}

export const TableRequests = () => {
  const { tableName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [requestToReject, setRequestToReject] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [renamedColumns, setRenamedColumns] = useState<ColumnMapping[]>([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    requestId: '',
    isBulk: false,
  });
  
  // New state for tracking if "Select All" across all pages is active
  const [isSelectAllPages, setIsSelectAllPages] = useState(false);
  // New state to track excluded items when "Select All" is active
  const [excludedItems, setExcludedItems] = useState<string[]>([]);
  
  // WebSocket state
  const socketRef = useRef<Socket | null>(null);
  const [bulkProgress, setBulkProgress] = useState({
    isOpen: false,
    operationType: "approve" as "approve" | "reject",
    totalRequests: 0,
    progress: 0,
    status: "processing" as "processing" | "success" | "error" | "finalizing",
    errorMessage: "",
    summary: {
      total: 0,
      approved: 0,
      rejected: 0,
      failed: 0
    }
  });

  

  const fetchUserEmails = async (userIds: string[]): Promise<Record<string, string>> => {
    if (userIds.length === 0) return {};
    try {
        const response = await fetch(`${API_URL}/users/emails`, {
            method: "POST",
            credentials: "include",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userIds }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to fetch user emails");
        }

        return data.emails || {};
    } catch (error) {
        console.error("Error fetching user emails:", error);
        return {};
    }
};

  const fetchRenamed = async () => {
    const response = await fetch(`${API_URL}/renamed/${tableName}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        }
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch renamed table data');
    }
    
    const data = await response.json();
    if (data.success) {
      // Set the renamed columns data
      setRenamedColumns(data.data);
    }
  };

  useEffect(() => {
    fetchRenamed();
  }, []); 

  const getDisplayName = (columnName: string) => {
    if (!renamedColumns || renamedColumns.length === 0) {
      return columnName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    const mapping = renamedColumns.find(m => m.original_column_name === columnName);
    return mapping?.renamed_column_name || columnName;
  };

  // Fetch requests with pagination
  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_REQUESTS}?page=${currentPage}&limit=${pageSize}&table_name=${tableName}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data: ApiResponse = await response.json();
      if (data.success) {
        // Update pagination state
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalItems(data.pagination.total);
        }

        // Since we're already filtering by table name in the API, we don't need to filter here
        const tableRequests = data.data;

        // Fetch emails for makers
        const makerIds = Array.from(new Set(tableRequests.map((req) => req.maker)));
        const emailMap = await fetchUserEmails(makerIds as string[]);

        // Add emails to requests
        const requestsWithEmails = tableRequests.map((request) => ({
            ...request,
            maker_email: emailMap[request.maker] || request.maker,
        }));

        setRequests(requestsWithEmails);
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to fetch requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [tableName, toast, currentPage, pageSize]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Setup WebSocket connection
  useEffect(() => {
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No token found for WebSocket connection');
      return;
    }
    
    // Connect to WebSocket server with auth token
    const socket = io(`${API_URL}`, {
      auth: {
        token
      }
    });
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Handle bulk approve progress updates
    socket.on('bulk-approve-processing', (data) => {
      console.log('Bulk approve processing update:', data);
      setBulkProgress(prev => ({
        ...prev,
        progress: data.processedRequests,
        totalRequests: data.totalRequests,
        status: data.status === 'finalizing' ? 'finalizing' : 'processing',
        summary: {
          total: data.totalRequests,
          approved: data.approved || 0,
          rejected: 0,
          failed: data.failed || 0
        }
      }));
    });
    
    // Handle bulk approve completion (for current page)
    socket.on('bulk-approve-complete', (data) => {
      console.log('Bulk approve complete:', data);
      setBulkProgress(prev => ({
        ...prev,
        status: 'success',
        summary: data.summary || {
          total: prev.totalRequests,
          approved: data.approved || prev.summary.approved,
          failed: data.failed || prev.summary.failed
        }
      }));
      
      // Refresh data after a short delay
      setTimeout(() => {
        fetchRequests();
      }, 1000);
    });
    
    // Handle bulk approve all pages completion
    socket.on('bulk-approve-all-pages-complete', (data) => {
      console.log('Bulk approve all pages complete:', data);
      setBulkProgress(prev => ({
        ...prev,
        status: 'success',
        summary: data.summary || {
          total: prev.totalRequests,
          approved: data.approved || prev.summary.approved,
          failed: data.failed || prev.summary.failed
        }
      }));
      
      // Show success toast
      toast({
        title: "Success",
        description: `Successfully processed ${data.summary?.approved || 0} requests across all pages`,
      });
      
      // Refresh data after a short delay
      setTimeout(() => {
        fetchRequests();
      }, 1000);
    });
    
    // Handle bulk approve error
    socket.on('bulk-approve-error', (data) => {
      console.error('Bulk approve error:', data);
      
      // Format error message for display
      let errorMessage = data.error || "Unknown error occurred";
      
      // Handle specific error cases
      if (errorMessage.includes('No active bulk operation session found')) {
        errorMessage = "Session expired or not found. Please try again.";
      }
      
      setBulkProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: errorMessage
      }));
      
      // Show toast for better visibility
      toast({
        title: "Approval Failed",
        description: errorMessage,
        variant: "destructive",
      });
    });
    
    // Handle bulk reject progress updates
    socket.on('bulk-reject-processing', (data) => {
      console.log('Bulk reject processing update:', data);
      setBulkProgress(prev => ({
        ...prev,
        progress: data.processedRequests,
        totalRequests: data.totalRequests,
        status: data.status === 'finalizing' ? 'finalizing' : 'processing',
        summary: {
          total: data.totalRequests,
          approved: 0,
          rejected: data.rejected || 0,
          failed: data.failed || 0
        }
      }));
    });
    
    // Handle bulk reject completion (for current page)
    socket.on('bulk-reject-complete', (data) => {
      console.log('Bulk reject complete:', data);
      setBulkProgress(prev => ({
        ...prev,
        status: 'success',
        summary: data.summary || {
          total: prev.totalRequests,
          rejected: data.rejected || prev.summary.rejected,
          failed: data.failed || prev.summary.failed
        }
      }));
      
      // Refresh data after a short delay
      setTimeout(() => {
        fetchRequests();
      }, 1000);
    });
    
    // Handle bulk reject all pages completion
    socket.on('bulk-reject-all-pages-complete', (data) => {
      console.log('Bulk reject all pages complete:', data);
      setBulkProgress(prev => ({
        ...prev,
        status: 'success',
        summary: data.summary || {
          total: prev.totalRequests,
          rejected: data.rejected || prev.summary.rejected,
          failed: data.failed || prev.summary.failed
        }
      }));
      
      // Show success toast
      toast({
        title: "Success",
        description: `Successfully processed ${data.summary?.rejected || 0} requests across all pages`,
      });
      
      // Refresh data after a short delay
      setTimeout(() => {
        fetchRequests();
      }, 1000);
    });
    
    // Handle bulk reject error
    socket.on('bulk-reject-error', (data) => {
      console.error('Bulk reject error:', data);
      
      // Format error message for display
      let errorMessage = data.error || "Unknown error occurred";
      
      // Handle specific error cases
      if (errorMessage.includes('No active bulk operation session found')) {
        errorMessage = "Session expired or not found. Please try again.";
      } else if (errorMessage.includes('Rejection comments are required')) {
        errorMessage = "Please provide rejection comments and try again.";
      }
      
      setBulkProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: errorMessage
      }));
      
      // Show toast for better visibility
      toast({
        title: "Rejection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    });
    
    // Store socket reference
    socketRef.current = socket;
    
    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, [fetchRequests, toast]);


  const handleApprove = async (requestId: string) => {
    setConfirmDialog({
      isOpen: true,
      requestId: requestId,
      isBulk: false,
    });
  };

  // Handle approve/reject actions
  const confirmApprove = async (rowId: string, requestId: string) => {
    try {
      const response = await fetch(`${API_URL}${ENDPOINTS.CHECKER.APPROVE}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          request_id: requestId,
          row_id: rowId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Request approved successfully",
        });
        fetchRequests();
      }
      else if(data.success === false){
        toast({
          title: "Invalid format",
          description: "Failed to approve request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!requestToReject || !rejectComment) return;

    const request = requests.find(req => req.row_id === requestToReject);
    if (!request) return;
    
    try {
      const response = await fetch(`${API_URL}${ENDPOINTS.CHECKER.REJECT}`, {
        method: "POST", 
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          row_id: requestToReject,
          request_id: request.request_id,
          comments: rejectComment,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Request rejected successfully",
        });
        setShowRejectDialog(false);
        setRejectComment("");
        setRequestToReject(null);
        fetchRequests();
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    }
  };

  const handleApproveAll = async () => {
    setConfirmDialog({
      isOpen: true,
      requestId: '',
      isBulk: true,
    });
  };

  // Determine if an item is selected based on select all state and exclusions
  const isItemSelected = useCallback((rowId: string) => {
    if (isSelectAllPages) {
      // If "Select All" is active, item is selected unless it's in excluded items
      return !excludedItems.includes(rowId);
    } else {
      // Otherwise, check if it's in the selectedRequests array
      return selectedRequests.includes(rowId);
    }
  }, [isSelectAllPages, excludedItems, selectedRequests]);

  // Handle individual item selection/deselection
  const handleItemSelectionChange = useCallback((rowId: string, checked: boolean) => {
    if (isSelectAllPages) {
      // When "Select All" is active, we manage exclusions
      if (checked) {
        // Remove from excluded items
        setExcludedItems(prev => prev.filter(id => id !== rowId));
      } else {
        // Add to excluded items
        setExcludedItems(prev => [...prev, rowId]);
      }
    } else {
      // Regular selection mode
      if (checked) {
        setSelectedRequests(prev => [...prev, rowId]);
      } else {
        setSelectedRequests(prev => prev.filter(id => id !== rowId));
      }
    }
  }, [isSelectAllPages]);

  // Handle "Select All" toggle
  const handleSelectAllToggle = useCallback(() => {
    if (isSelectAllPages) {
      // Turn off "Select All" mode
      setIsSelectAllPages(false);
      setSelectedRequests([]);
      setExcludedItems([]);
    } else {
      // Directly select all items across all pages
      setIsSelectAllPages(true);
      setSelectedRequests([]);
      setExcludedItems([]);
      
      // Show confirmation toast
      toast({
        title: "All Pages Selected",
        description: `Selected all ${totalItems} items across all pages`,
      });
    }
  }, [isSelectAllPages, totalItems, toast]);

  // Get the effective count of selected items
  const getSelectedCount = useCallback(() => {
    if (isSelectAllPages) {
      return totalItems - excludedItems.length;
    }
    return selectedRequests.length;
  }, [isSelectAllPages, totalItems, excludedItems.length, selectedRequests.length]);

  // Modified bulk operations to work with all pages selection
  const confirmApproveAll = async (rowIds?: string[]) => {
    try {
      if (!socketRef.current || !socketRef.current.connected) {
        throw new Error("WebSocket connection not available");
      }
      
      // Open progress modal with the total count of items to be processed
      const totalToProcess = isSelectAllPages ? totalItems - excludedItems.length : (rowIds?.length || 0);
      
      // Make sure there are actual items to process
      if (totalToProcess === 0) {
        toast({
          title: "No items to process",
          description: "Please select at least one item to approve",
          variant: "destructive",
        });
        return;
      }
      
      setBulkProgress({
        isOpen: true,
        operationType: "approve",
        totalRequests: totalToProcess,
        progress: 0,
        status: "processing",
        errorMessage: "",
        summary: {
          total: totalToProcess,
          approved: 0,
          rejected: 0,
          failed: 0
        }
      });
      
      // Start bulk approve operation
      socketRef.current.emit('bulk-approve-start', {
        tableName: tableName,
        selectAllPages: isSelectAllPages,
        excludedItems: isSelectAllPages ? excludedItems : []
      });
      
      const MAX_RETRIES = 2;
      
      if (!isSelectAllPages && rowIds && rowIds.length > 0) {
        // Process specific row IDs (current page selection)
        // Get the request IDs for selected rows
        const selectedRequestsData = requests
          .filter(req => rowIds.includes(req.row_id))
          .map(req => ({
            row_id: req.row_id,
            request_id: req.request_id
          }));
        
        // Prepare data chunks (10 requests per chunk)
        const chunkSize = 10;
        const chunks = [];
        for (let i = 0; i < selectedRequestsData.length; i += chunkSize) {
          chunks.push(selectedRequestsData.slice(i, i + chunkSize));
        }
        
        // Send chunks with retry mechanism
        for (let i = 0; i < chunks.length; i++) {
          let retries = 0;
          let success = false;
          
          while (retries <= MAX_RETRIES && !success) {
            try {
              // Send the chunk
              socketRef.current.emit('bulk-approve-chunk', {
                chunk: chunks[i],
                chunkIndex: i,
                totalChunks: chunks.length,
                tableName: tableName,
                selectAllPages: false
              });
              
              // Wait for the server to process the chunk before sending the next one
              await new Promise((resolve, reject) => {
                const onChunkProcessed = (data: any) => {
                  if (data.chunkIndex === i) {
                    socketRef.current?.off('bulk-approve-chunk-processed', onChunkProcessed);
                    socketRef.current?.off('bulk-approve-error', onError);
                    clearTimeout(timeoutId);
                    resolve(data);
                  }
                };
                
                const onError = (data: any) => {
                  if (data.chunkIndex === i) {
                    socketRef.current?.off('bulk-approve-chunk-processed', onChunkProcessed);
                    socketRef.current?.off('bulk-approve-error', onError);
                    clearTimeout(timeoutId);
                    reject(new Error(data.error || "Unknown error processing chunk"));
                  }
                };
                
                // Set a timeout to prevent hanging
                const timeoutId = setTimeout(() => {
                  socketRef.current?.off('bulk-approve-chunk-processed', onChunkProcessed);
                  socketRef.current?.off('bulk-approve-error', onError);
                  reject(new Error("Timeout waiting for chunk processing"));
                }, 10000); // Increased timeout to 10 seconds
                
                socketRef.current?.on('bulk-approve-chunk-processed', onChunkProcessed);
                socketRef.current?.on('bulk-approve-error', onError);
              });
              
              // If we get here, the chunk was processed successfully
              success = true;
              
              // Update UI with progress
              const processedSoFar = (i + 1) * chunkSize;
              setBulkProgress(prev => ({
                ...prev,
                progress: Math.min(processedSoFar, totalToProcess)
              }));
              
            } catch (error) {
              console.error(`Error processing chunk ${i}, attempt ${retries + 1}:`, error);
              retries++;
              
              if (retries > MAX_RETRIES) {
                console.error(`Failed to process chunk ${i} after ${MAX_RETRIES} retries`);
                // Continue with the next chunk instead of failing the entire operation
                break;
              }
              
              // Wait a bit before retrying
              await new Promise(r => setTimeout(r, 1000 * retries));
            }
          }
        }
      }
      
      // Complete the operation
      socketRef.current.emit('bulk-approve-complete', {
        tableName: tableName,
        selectAllPages: isSelectAllPages,
        excludedItems: isSelectAllPages ? excludedItems : []
      });
      
      // Reset selection state
      setIsSelectAllPages(false);
      setSelectedRequests([]);
      setExcludedItems([]);
      
    } catch (error) {
      console.error('Error in bulk approve operation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve requests",
        variant: "destructive",
      });
      
      setBulkProgress(prev => ({
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred"
      }));
    }
  };

  const handleRejectAll = async (rowIds?: string[]) => {
    if (!rejectComment) {
      setIsBulkReject(true);
      setShowRejectDialog(true);
      return;
    }

    try {
      if (!socketRef.current || !socketRef.current.connected) {
        throw new Error("WebSocket connection not available");
      }
      
      // Calculate total items to process
      const totalToProcess = isSelectAllPages ? totalItems - excludedItems.length : (rowIds?.length || 0);
      
      // Make sure there are actual items to process
      if (totalToProcess === 0) {
        toast({
          title: "No items to process",
          description: "Please select at least one item to reject",
          variant: "destructive",
        });
        return;
      }
      
      // Open progress modal
      setBulkProgress({
        isOpen: true,
        operationType: "reject",
        totalRequests: totalToProcess,
        progress: 0,
        status: "processing",
        errorMessage: "",
        summary: {
          total: totalToProcess,
          approved: 0,
          rejected: 0,
          failed: 0
        }
      });
      
      // Start bulk reject operation
      socketRef.current.emit('bulk-reject-start', {
        comments: rejectComment,
        tableName: tableName,
        selectAllPages: isSelectAllPages,
        excludedItems: isSelectAllPages ? excludedItems : []
      });
      
      const MAX_RETRIES = 2;
      
      if (!isSelectAllPages && rowIds && rowIds.length > 0) {
        // Process specific row IDs (current page selection)
        // Get the request IDs for selected rows
        const selectedRequestsData = requests
          .filter(req => rowIds.includes(req.row_id))
          .map(req => ({
            row_id: req.row_id,
            request_id: req.request_id
          }));
        
        // Prepare data chunks (10 requests per chunk)
        const chunkSize = 10;
        const chunks = [];
        for (let i = 0; i < selectedRequestsData.length; i += chunkSize) {
          chunks.push(selectedRequestsData.slice(i, i + chunkSize));
        }
        
        // Send chunks with retry mechanism
        for (let i = 0; i < chunks.length; i++) {
          let retries = 0;
          let success = false;
          
          while (retries <= MAX_RETRIES && !success) {
            try {
              // Send the chunk
              socketRef.current.emit('bulk-reject-chunk', {
                chunk: chunks[i],
                chunkIndex: i,
                totalChunks: chunks.length,
                comments: rejectComment,
                tableName: tableName,
                selectAllPages: false
              });
              
              // Wait for the server to process the chunk before sending the next one
              await new Promise((resolve, reject) => {
                const onChunkProcessed = (data: any) => {
                  if (data.chunkIndex === i) {
                    socketRef.current?.off('bulk-reject-chunk-processed', onChunkProcessed);
                    socketRef.current?.off('bulk-reject-error', onError);
                    clearTimeout(timeoutId);
                    resolve(data);
                  }
                };
                
                const onError = (data: any) => {
                  if (data.chunkIndex === i) {
                    socketRef.current?.off('bulk-reject-chunk-processed', onChunkProcessed);
                    socketRef.current?.off('bulk-reject-error', onError);
                    clearTimeout(timeoutId);
                    reject(new Error(data.error || "Unknown error processing chunk"));
                  }
                };
                
                // Set a timeout to prevent hanging
                const timeoutId = setTimeout(() => {
                  socketRef.current?.off('bulk-reject-chunk-processed', onChunkProcessed);
                  socketRef.current?.off('bulk-reject-error', onError);
                  reject(new Error("Timeout waiting for chunk processing"));
                }, 10000); // Increased timeout to 10 seconds
                
                socketRef.current?.on('bulk-reject-chunk-processed', onChunkProcessed);
                socketRef.current?.on('bulk-reject-error', onError);
              });
              
              // If we get here, the chunk was processed successfully
              success = true;
              
              // Update UI with progress
              const processedSoFar = (i + 1) * chunkSize;
              setBulkProgress(prev => ({
                ...prev,
                progress: Math.min(processedSoFar, totalToProcess)
              }));
              
            } catch (error) {
              console.error(`Error processing chunk ${i}, attempt ${retries + 1}:`, error);
              retries++;
              
              if (retries > MAX_RETRIES) {
                console.error(`Failed to process chunk ${i} after ${MAX_RETRIES} retries`);
                // Continue with the next chunk instead of failing the entire operation
                break;
              }
              
              // Wait a bit before retrying
              await new Promise(r => setTimeout(r, 1000 * retries));
            }
          }
        }
      }
      
      // Complete the operation
      socketRef.current.emit('bulk-reject-complete', {
        tableName: tableName,
        selectAllPages: isSelectAllPages,
        excludedItems: isSelectAllPages ? excludedItems : [],
        comments: rejectComment // Make sure to include comments here as well
      });
      
      // Reset selection state
      setIsSelectAllPages(false);
      setSelectedRequests([]);
      setExcludedItems([]);
      setShowRejectDialog(false);
      setRejectComment("");
      setIsBulkReject(false);
      
    } catch (error) {
      console.error('Error in bulk reject operation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject requests",
        variant: "destructive",
      });
      
      setBulkProgress(prev => ({
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred"
      }));
    }
  };

  // Add this helper function at the top of the component
  const getRelevantColumns = (requests: ChangeRequest[]) => {
    const columns = new Set<string>();
    requests.forEach((request) => {
      Object.keys(request.new_data).forEach((key) => {
        if (
          ![
            "row_id",
            "created_by",
            "modified_by",
            "created_on",
            "modified_on",
            "table_id",
            "checker",
            "status",
            "table_name",
          ].includes(key)
        ) {
          columns.add(key);
        }
      });
    });
    return Array.from(columns);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-full h-16 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 border-b pb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-[#1A237E] hover:text-[#1A237E]/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-gray-500">Overview</span>
          <span className="text-gray-400">/</span>
          <h2 className="text-[#1A237E] font-medium capitalize">
            {tableName?.toLowerCase().replace(/_/g, " ")}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 py-12 px-4">
          <FileWarning className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No pending changes
          </h3>
          <p className="text-gray-500">
            There are no changes to review for this table
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="text-[#1A237E] hover:text-[#1A237E]/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-gray-500">Overview</span>
          <span className="text-gray-400">/</span>
          <h2 className="text-[#1A237E] font-medium capitalize">
            {tableName?.toLowerCase().replace(/_/g, " ")}
            {totalItems > 0 && (
              <span className="ml-2 text-sm text-[#FF5722]">
                ({totalItems} {totalItems === 1 ? "request" : "requests"})
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={handleSelectAllToggle}
          >
            <Checkbox 
              checked={isSelectAllPages} 
              className={isSelectAllPages ? "bg-blue-500 text-white" : ""}
            />
            {isSelectAllPages 
              ? `All Pages Selected (${getSelectedCount()})`
              : "Select All Pages"
            }
          </Button>

          {(selectedRequests.length > 0 || isSelectAllPages) && (
            <>
              <Button
                variant="ghost"
                className="text-[#00BFA5] hover:bg-[#00BFA5]/10"
                onClick={() => handleApproveAll()}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Selected {getSelectedCount() > 0 && `(${getSelectedCount()})`}
              </Button>
              <Button
                variant="ghost"
                className="text-[#FF5722] hover:bg-[#FF5722]/10"
                onClick={() => isSelectAllPages ? handleRejectAll() : handleRejectAll(selectedRequests)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Selected {getSelectedCount() > 0 && `(${getSelectedCount()})`}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[80px] font-medium">Select</TableHead>
              <TableHead className="w-[80px] font-medium">Action</TableHead>
              <TableHead className="w-[60px] font-medium">No</TableHead>
              <TableHead className="font-medium">User</TableHead>
              <TableHead className="font-medium">Date & Time</TableHead>
              {getRelevantColumns(requests).map((column) => (
                <TableHead key={column} className="font-medium capitalize">
                  {getDisplayName(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request, index) => (
              <TableRow
                key={request.request_id}
                className="hover:bg-gray-50/50"
              >
                <TableCell className="text-center">
                  <Checkbox
                    checked={isItemSelected(request.row_id)}
                    onCheckedChange={(checked) => {
                      handleItemSelectionChange(request.row_id, !!checked);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() =>
                        handleApprove(request.request_id)
                      }
                      className="p-1.5 rounded-full text-[#00BFA5] hover:bg-[#00BFA5]/10"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setRequestToReject(request.row_id);
                        setShowRejectDialog(true);
                      }}
                      className="p-1.5 rounded-full text-[#FF5722] hover:bg-[#FF5722]/10"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    {/* <button
                      onClick={() => {
                        setSelectedChange(request);
                        setShowChangesDialog(true);
                      }}
                      className="p-1.5 rounded-full text-blue-500 hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button> */}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {/* Calculate the correct row number based on current page and page size */}
                  {(currentPage - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {request.maker_email}
                </TableCell>
                <TableCell>
                  {format(
                    // Parse the UTC date string and convert to local timezone
                    new Date(request.created_at),
                    // Format with full year and time
                    "dd MMM yyyy HH:mm:ss"
                  )}
                </TableCell>

                {/* Add dynamic columns */}
                {getRelevantColumns(requests).map((column) => {
                  const oldValue = request.old_data[column];
                  const newValue = request.new_data[column];

                  const hasChanged = (oldValue !== newValue) && 
                                    !(oldValue === null && newValue === null) && 
                                    !(oldValue === "" && newValue === "") && 
                                    !(oldValue === "" && newValue === null) && 
                                    !(oldValue === null && newValue === "" ) && 
                                    !(oldValue === undefined && newValue === undefined);

                  return (
                    <TableCell key={column}>
                      {hasChanged ? (
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500">
                               {oldValue?.toString() || "null"}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600">
                               {newValue?.toString() || "null"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-600">
                               {newValue?.toString() || "null"}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, requestId: '', isBulk: false })}
        onConfirm={() => {
          if (confirmDialog.isBulk) {
            if (isSelectAllPages) {
              confirmApproveAll();
            } else {
              confirmApproveAll(selectedRequests);
            }
          } else {
            const request = requests.find(r => r.request_id === confirmDialog.requestId);
            if (request) {
              confirmApprove(request.row_id, request.request_id);
            }
          }
          setConfirmDialog({ isOpen: false, requestId: '', isBulk: false });
        }}
        title={`Confirm ${confirmDialog.isBulk ? 'Bulk ' : ''}Approval`}
        description={
          confirmDialog.isBulk
            ? isSelectAllPages
              ? `Are you sure you want to approve ${getSelectedCount()} requests across all pages?`
              : `Are you sure you want to approve ${selectedRequests.length} selected requests?`
            : "Are you sure you want to approve this request?"
        }
        variant="success"
      />

      {/* Confirm dialog for selecting all pages */}
      <ConfirmDialog
        isOpen={false} // This dialog is no longer needed as "Select All" is handled by handleSelectAllToggle
        onClose={() => {}}
        onConfirm={() => {}}
        title="Select All Pages"
        description={`Are you sure you want to select all ${totalItems} requests across all pages? This might affect performance for very large datasets.`}
        variant="warning"
      />

      <div className="border-t pt-4 mt-auto">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="min-w-[450px] p-4">
          <DialogHeader>
            <DialogTitle>Reject Change Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Please provide a reason for rejection
              </label>
              <Textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Enter rejection reason..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectComment("");
                setRequestToReject(null);
                setIsBulkReject(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (isBulkReject) {
                  if (isSelectAllPages) {
                    handleRejectAll();
                  } else {
                    handleRejectAll(selectedRequests);
                  }
                } else {
                  handleReject();
                }
              }}
              disabled={!rejectComment}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedChange && (
        <ChangesDialog
          isOpen={showChangesDialog}
          onClose={() => {
            setShowChangesDialog(false);
            setSelectedChange(null);
          }}
          changes={{
            old_data: selectedChange.old_data,
            new_data: selectedChange.new_data,
          }}
          tableName={tableName || ""}
        />
      )}
      
      <BulkOperationProgress
        isOpen={bulkProgress.isOpen}
        onClose={() => setBulkProgress(prev => ({ ...prev, isOpen: false }))}
        operationType={bulkProgress.operationType}
        totalRequests={bulkProgress.totalRequests}
        progress={bulkProgress.progress}
        status={bulkProgress.status}
        errorMessage={bulkProgress.errorMessage}
        summary={bulkProgress.summary}
      />
    </div>
  );
};
