import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { useTableData } from "../hooks/useTableData";
import { useColumnPermissions } from "../hooks/useColumnPermissions";
import { EditRowDrawer } from "./EditRowDrawer";
import {
  requestRowEdit,
  fetchDropdownOptions,
  DropdownConfig,
} from "../services/tableDataService";
import { Pagination } from "./Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  fetchHighlightedCells,
  CellHighlight,
} from "@/services/highlightService";
import HighlightedCell from "./ui/HighlightedCell";
import { Upload, AlertCircle, Download } from "lucide-react";
import Papa from "papaparse";
import { validateCSVData } from "../utils/csvValidation";
import { API_URL } from "@/config/constants";
import { sanitizeInput } from "@/utils/security";
import { preventXSS } from "@/utils/security";
import CSVUploadProgress from "./CSVUploadProgress";
import { io, Socket } from "socket.io-client";

interface CSVValidationError {
  row: number;
  column: string;
  message: string;
  originalLineNumber?: number; // Add original line number tracking
}

interface ColumnStatus {
  column_name: string;
  column_status: "editable" | "non-editable";
}

interface DynamicTableProps {
  tableName: string;
  pageSize: number;
  onPageSizeChange: (newPageSize: number) => void;
  userRole: "maker" | "checker";
}

interface FilterOption {
  value: string;
  label: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "isEmpty";
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
  tableName,
  pageSize,
  onPageSizeChange,
}) => {
  const filterOptions: FilterOption[] = [
    { value: "equals", label: "Equals", operator: "equals" },
    { value: "contains", label: "Contains", operator: "contains" },
    { value: "startsWith", label: "Starts with", operator: "startsWith" },
    { value: "endsWith", label: "Ends with", operator: "endsWith" },
    { value: "isEmpty", label: "Is empty", operator: "isEmpty" },
  ];

  // states for server-side filtering
  const [filterParams, setFilterParams] = useState({
    searchQuery: "",
    sortColumn: null as string | null,
    sortDirection: "asc" as "asc" | "desc",
    filters: {} as Record<string, { operator: string; value: string }>,
    currentPage: 1,
  });

  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null
  );
  const [selectedRow, setSelectedRow] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownColumns, setDropdownColumns] = useState<DropdownConfig[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
  const { toast } = useToast();
  const [highlightedCells, setHighlightedCells] = useState<CellHighlight[]>([]);
  const [showErrors, setShowErrors] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [csvErrors, setCSVErrors] = useState<CSVValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  // Add ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [tempFilters, setTempFilters] = useState<
    Record<string, { operator: string; value: string }>
  >({});

  const {
    data: processedData,
    columns,
    renamedColumns,
    dataTypes,
    isLoading: isDataLoading,
    error: dataError,
    refresh: refreshData,
    pagination,
    setCurrentPage,
  } = useTableData({ tableName, pageSize, filterParams });

  const {
    isColumnEditable,
    columnStatuses,
    isLoading: isPermissionsLoading,
    error: permissionsError,
  } = useColumnPermissions(tableName);

  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  // Update the uploadProgress state interface to include database processing fields
  const [uploadProgress, setUploadProgress] = useState({
    status: 'idle' as 'idle' | 'validating' | 'uploading' | 'processing_database' | 'finalizing' | 'completed' | 'failed',
    totalRows: 0,
    processedRows: 0,
    currentChunk: 0,
    totalChunks: 0,
    dbProcessedRows: 0,
    dbTotalRows: 0,
    errors: [] as CSVValidationError[]
  });

  console.log(uploadProgress);
  // Check for ongoing uploads on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('csvUploadState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.tableName === tableName) {
          setShowUploadProgress(true);
        }
      } catch (error) {
        console.error('Error parsing saved upload state:', error);
      }
    }
  }, [tableName]);

  // Initialize socket connection when component mounts
  useEffect(() => {
    // Only create socket when needed
    return () => {
      // Clean up socket connection on unmount if it exists
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [socketInstance]);

  // Fetching dropdown columns when table name changes
  useEffect(() => {
    fetchDropdownData();
  }, [tableName]);

  useEffect(() => {
    if (tableName) {
      fetchHighlightedCells(tableName)
        .then((highlights) => setHighlightedCells(highlights))
        .catch(console.error);
    }
  }, [tableName]);

  useEffect(() => {
    console.log("FilterParams updated:", filterParams);
  }, [filterParams]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const getDisplayName = (columnName: string) => {
    if (!renamedColumns) return columnName;
    const mapping = renamedColumns.find(m => m.originalName === columnName);
    return mapping?.displayName || columnName;
  };

  // search button handler
  const handleSearchClick = () => {
    setFilterParams((prev) => ({
      ...prev,
      searchQuery: searchInput,
      currentPage: 1,
    }));
  };

  // clear search handler
  const handleClearSearch = () => {
    setSearchInput("");
    setFilterParams((prev) => ({
      ...prev,
      searchQuery: "",
      currentPage: 1,
    }));
  };

  // Check if a column has active filters
  const hasActiveFilter = (column: string) => {
    return (
      filterParams.filters[column] && filterParams.filters[column].value !== ""
    );
  };

  const applyFilter = (column: string, operator: string, value: string) => {
    setTempFilters((prev) => ({
      ...prev,
      [column]: { operator, value },
    }));
  };

  // Add apply filter handler
  const handleApplyFilter = (column: string) => {
    setFilterParams((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [column]: tempFilters[column],
      },
      currentPage: 1,
    }));
    setActiveFilterColumn(null);
  };

  // sort handling
  const handleSort = useCallback((column: string) => {
    setFilterParams((prev) => {
      // If clicking a different column, start with ascending sort
      if (prev.sortColumn !== column) {
        return {
          ...prev,
          sortColumn: column,
          sortDirection: "asc",
          currentPage: 1,
        };
      }

      // If clicking the same column, cycle through: asc -> desc -> none -> asc
      if (prev.sortDirection === "asc") {
        return {
          ...prev,
          sortDirection: "desc",
          currentPage: 1,
        };
      } else {
        return {
          ...prev,
          sortColumn: null,
          sortDirection: "asc", // Reset to default
          currentPage: 1,
        };
      }
    });
  }, []);

  // filter click handler
  const handleFilterClick = useCallback(
    (column: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveFilterColumn(activeFilterColumn === column ? null : column);
    },
    [activeFilterColumn]
  );

  const clearFilter = useCallback((column: string) => {
    setFilterParams((prev) => {
      const newFilters = { ...prev.filters };
      delete newFilters[column];
      return {
        ...prev,
        filters: newFilters,
        currentPage: 1,
      };
    });
    setActiveFilterColumn(null);
  }, []);

  // page change handler
  const handlePageChange = useCallback(
    (page: number) => {
      setFilterParams((prev) => ({
        ...prev,
        currentPage: page,
      }));
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  // page size change handler
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      onPageSizeChange(newSize);
      setFilterParams((prev) => ({
        ...prev,
        currentPage: 1,
      }));
    },
    [onPageSizeChange]
  );

  const fetchDropdownData = async () => {
    try {
      setIsLoadingDropdowns(true);
      const dropdowns = await fetchDropdownOptions(tableName);
      setDropdownColumns(dropdowns.filter((item) => item.options.length > 0));
    } catch (error) {
      console.error("Error fetching dropdown options:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown options",
      });
    } finally {
      setIsLoadingDropdowns(false);
    }
  };

  const handleEditClick = (row: Record<string, unknown>) => {
    setSelectedRow(row);
    setIsAddMode(false);
    setIsDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedRow({});
    setIsAddMode(true);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setSelectedRow(null);
    setIsAddMode(false);
    setIsDrawerOpen(false);
    setError(null);
  };

  const handleRowSave = async (updatedRow: Record<string, unknown>) => {
    try {
      setError(null);

      if (!selectedRow) {
        throw new Error("No row selected for editing");
      }

      const editData = {
        table_name: tableName,
        row_id: String(
          selectedRow.id ||
            selectedRow[`${tableName}_sk`] ||
            selectedRow[`${tableName}_id`]
        ),
        old_values: selectedRow,
        new_values: updatedRow,
        table_id: tableName,
      };

      const response = await requestRowEdit(editData);

      if (response.success) {
        handleDrawerClose();
        refreshData();
        toast({
          title: "Success",
          description: isAddMode
            ? "Row added successfully"
            : "Changes requested successfully",
        });

        // Refresh highlighted cells after edit
        const highlights = await fetchHighlightedCells(tableName);
        setHighlightedCells(highlights);
      } else {
        setError(response.message || "Failed to submit edit request");
      }
    } catch (err) {
      console.error("Error saving row:", err);
      setError(err instanceof Error ? err.message : "Failed to save changes");
      toast({
        title: "Error",
        description: "Failed to save changes",
      });
    }
  };

  // Function to determine column background color
  const getColumnStyle = (column: string) => {
    if (
      !columnStatuses.some(
        (status: ColumnStatus) => status.column_name === column
      )
    ) {
      return "bg-[#e3f2fd]"; // Light blue for columns not in API response
    }
    if (!isColumnEditable(column)) {
      return "bg-[#e8eaf6]"; // Indigo 50 for non-editable columns
    }
    return "bg-white"; // Default background for editable columns
  };

  const renderCell = (
    value: unknown,
    row: Record<string, unknown>,
    columnName: string
  ) => {
    const rowId = String(
      row.id || row[`${tableName}_sk`] || row[`${tableName}_id`] || "undefined"
    );

    const isHighlighted = highlightedCells.some(
      (highlight) =>
        highlight.row_id === rowId &&
        highlight.changed_fields.includes(columnName)
    );

    return (
      <HighlightedCell
        value={String(value ?? "")}
        isHighlighted={isHighlighted}
      />
    );
  };

  // Function to update upload progress state
  const updateUploadProgress = (updates: Partial<any>) => {
    const currentState = localStorage.getItem('csvUploadState');
    let state = currentState ? JSON.parse(currentState) : null;
    
    const newState = {
      ...(state || {}),
      ...updates,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem('csvUploadState', JSON.stringify(newState));
    
    // Dispatch a custom event to notify other tabs
    const event = new StorageEvent('storage', {
      key: 'csvUploadState',
      newValue: JSON.stringify(newState)
    });
    window.dispatchEvent(event);
  };

  // Modified CSV upload handler with WebSocket processing
  const handleCSVUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setCSVErrors([]);
    setShowErrors(true);
    setShowUploadProgress(true);

    try {
      // Validate file type and size
      if (!file.type && !file.name.endsWith(".csv")) {
        throw new Error("Please upload a valid CSV file");
      }

      // Show file size info
      const fileSizeMB = file.size / (1024 * 1024);
      toast({
        title: "Processing File",
        description: `File size: ${fileSizeMB.toFixed(2)} MB`,
      });

      // Parse CSV file
      const results = await new Promise<Papa.ParseResult<Record<string, any>>>(
        (resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
            transformHeader: (header) => header.trim(),
          });
        }
      );

      // Initialize upload progress
      setUploadProgress({
        status: 'validating',
        totalRows: results.data.length,
        processedRows: 0,
        currentChunk: 0,
        totalChunks: 0,
        dbProcessedRows: 0,
        dbTotalRows: 0,
        errors: []
      });

      // Update local storage for cross-tab state
      updateUploadProgress({
        tableName,
        fileName: file.name,
        totalRows: results.data.length,
        processedRows: 0,
        currentChunk: 0,
        totalChunks: 0,
        status: 'validating',
        errors: [],
        startTime: Date.now(),
        lastUpdated: Date.now()
      });

      // Validate headers match table columns
      const csvHeaders = Object.keys(results.data[0] || {}).map((header) =>
        header.trim()
      );
      const invalidHeaders = csvHeaders.filter(
        (header) => !columns.includes(header)
      );

      if (invalidHeaders.length > 0) {
        throw new Error(`Invalid columns found: ${invalidHeaders.join(", ")}`);
      }

      // Using existing dataTypes for validation
      const columnTypes = columns.map((column) => ({
        column_name: column,
        data_type: dataTypes[column] || "text",
        character_maximum_length: null,
      }));

      // Perform initial client-side validation on a sample of the data
      const SAMPLE_SIZE = Math.min(100, results.data.length);
      const sampleData = results.data.slice(0, SAMPLE_SIZE);
      const sampleErrors = await validateCSVData(sampleData, columnTypes, tableName, 0, SAMPLE_SIZE);

      if (sampleErrors.length > 0) {
        setCSVErrors(sampleErrors);
        setUploadProgress(prev => ({
          ...prev,
          status: 'failed',
          errors: sampleErrors
        }));
        updateUploadProgress({
          status: 'failed',
          errors: sampleErrors
        });
        toast({
          title: "Validation Failed",
          description: `Found ${sampleErrors.length} errors in the first ${SAMPLE_SIZE} rows. Please fix them and try again.`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Initialize Socket.IO connection for large file processing
      const socket = io(API_URL, {
        path: '/socket.io/',
        withCredentials: true,
        transports: ['websocket'],
        auth: {
          token: localStorage.getItem("token")
        }
      });
      
      setSocketInstance(socket);

      // Set up socket event handlers
      socket.on('connect', () => {
        console.log('Socket connected for CSV upload');
        
        // Process data in chunks to avoid memory issues
        const CHUNK_SIZE = 1000;
        const totalChunks = Math.ceil(results.data.length / CHUNK_SIZE);
        
        // Update progress state
        setUploadProgress(prev => ({
          ...prev,
          status: 'uploading',
          totalChunks
        }));
        
        updateUploadProgress({
          status: 'uploading',
          totalChunks
        });
        
        // Start upload process
        socket.emit('csv-upload-start', {
          tableName,
          totalRows: results.data.length,
          totalChunks
        });
        
        // Send chunks sequentially
        const sendChunk = (chunkIndex: number) => {
          if (chunkIndex >= totalChunks) {
            // All chunks sent, finalize the upload
            socket.emit('csv-upload-complete', {
              tableName
            });
            return;
          }
          
          const startIdx = chunkIndex * CHUNK_SIZE;
          const endIdx = Math.min((chunkIndex + 1) * CHUNK_SIZE, results.data.length);
          const chunk = results.data.slice(startIdx, endIdx);
          
          // Sanitize data before sending
          const sanitizedChunk = chunk.map((row) => {
            const sanitizedRow: Record<string, any> = {};
            Object.entries(row).forEach(([key, value]) => {
              if (value !== null && value !== undefined && value !== "") {
                sanitizedRow[key] = preventXSS(sanitizeInput(String(value)));
              }
            });
            return sanitizedRow;
          });
          
          // Send chunk to server
          socket.emit('csv-data-chunk', {
            chunk: sanitizedChunk,
            tableName,
            chunkIndex,
            totalChunks
          });
        };
        
        // Start with the first chunk
        sendChunk(0);
        
        // Update the csv-chunk-processed event handler to properly handle errors
        socket.on('csv-chunk-processed', (data: {
          chunkIndex: number;
          totalChunks: number;
          processed: number;
          errors: Array<{
            data?: Record<string, any>;
            errors?: Record<string, string>;
          }>;
          errorCount: number;
        }) => {
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            currentChunk: data.chunkIndex + 1,
            processedRows: prev.processedRows + data.processed,
            errors: [...prev.errors, ...(Array.isArray(data.errors) ? data.errors.map(error => {
              // Handle both error formats
              if (error.errors && typeof error.errors === 'object') {
                const errorKey = Object.keys(error.errors)[0] || '';
                const errorMessage = Object.values(error.errors)[0] || 'Validation error';
                return {
                  row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
                  column: errorKey,
                  message: errorMessage
                };
              } else {
                return {
                  row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
                  column: '',
                  message: 'Validation error'
                };
              }
            }) : [])]
          }));
          
          updateUploadProgress({
            currentChunk: data.chunkIndex + 1,
            processedRows: (data.chunkIndex * CHUNK_SIZE) + data.processed,
            errorCount: data.errorCount || 0,
            errors: Array.isArray(data.errors) ? data.errors.slice(0, 10).map(error => {
              // Handle both error formats
              if (error.errors && typeof error.errors === 'object') {
                const errorKey = Object.keys(error.errors)[0] || '';
                const errorMessage = Object.values(error.errors)[0] || 'Validation error';
                return {
                  row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
                  column: errorKey,
                  message: errorMessage
                };
              } else {
                return {
                  row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
                  column: '',
                  message: 'Validation error'
                };
              }
            }) : []
          });
          
          // Always send next chunk to collect all errors
          sendChunk(data.chunkIndex + 1);
        });
        
        // Handle upload finalization
        socket.on('csv-upload-finalized', (data) => {
          setUploadProgress(prev => ({
            ...prev,
            status: 'completed'
          }));
          
          updateUploadProgress({
            status: 'completed'
          });
          
          toast({
            title: "Success",
            description: `Processed ${data.summary.updates} updates and ${data.summary.inserts} new entries`,
          });
          
          // Refresh table data
          refreshData();
          
          // Clean up socket connection
          socket.disconnect();
          setSocketInstance(null);
          setIsUploading(false);
        });
        
        // Handle errors
        socket.on('csv-upload-error', (error) => {
          console.error('CSV upload error:', error);
          
          setUploadProgress(prev => ({
            ...prev,
            status: 'failed',
            errors: [...prev.errors, { 
              row: 0, 
              column: '', 
              message: error.error || "Unknown error occurred" 
            }]
          }));
          
          updateUploadProgress({
            status: 'failed',
            errors: [{ 
              row: 0, 
              column: '', 
              message: error.error || "Unknown error occurred" 
            }]
          });
          
          toast({
            title: "Error",
            description: error.error || "Failed to process CSV file",
            variant: "destructive",
          });
          
          // Clean up socket connection
          socket.disconnect();
          setSocketInstance(null);
          setIsUploading(false);
        });

      });
      
      // Handle connection errors
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to establish WebSocket connection. Please try again.",
          variant: "destructive",
        });
        
        setUploadProgress(prev => ({
          ...prev,
          status: 'failed',
          errors: [...prev.errors, { 
            row: 0, 
            column: '', 
            message: "Connection error: " + error.message 
          }]
        }));
        
        updateUploadProgress({
          status: 'failed',
          errors: [{ 
            row: 0, 
            column: '', 
            message: "Connection error: " + error.message 
          }]
        });
        
        socket.disconnect();
        setSocketInstance(null);
        setIsUploading(false);
      });

      // Add the handler for database processing updates in the socket connection section
      socket.on('csv-db-processing', (data) => {
        console.log('Database processing update:', data);
        
        setUploadProgress(prev => ({
          ...prev,
          status: data.status,
          dbProcessedRows: data.processedRows,
          dbTotalRows: data.totalRows
        }));
        
        updateUploadProgress({
          status: data.status,
          dbProcessedRows: data.processedRows,
          dbTotalRows: data.totalRows,
          message: data.message
        });
      });

      // Add handler for validation failures
      socket.on('csv-validation-failed', (data: {
        status: string;
        message: string;
        totalErrors: number;
        errors: Array<{
          data?: Record<string, any>;
          errors?: Record<string, string>;
        }>;
      }) => {
        console.log('CSV validation failed:', data);
        
        // Extract validation errors
        const validationErrors = data.errors.map(error => {
          // Handle both error formats
          if (error.errors && typeof error.errors === 'object') {
            const errorKey = Object.keys(error.errors)[0] || '';
            const errorMessage = Object.values(error.errors)[0] || 'Validation error';
            return {
              row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
              column: errorKey,
              message: errorMessage
            };
          } else {
            return {
              row: error.data ? (error.data[Object.keys(error.data)[0]] || 0) : 0,
              column: '',
              message: 'Validation error'
            };
          }
        });
        
        setCSVErrors(validationErrors);
        
        setUploadProgress(prev => ({
          ...prev,
          status: 'failed',
          errors: validationErrors
        }));
        
        updateUploadProgress({
          status: 'failed',
          errors: validationErrors.slice(0, 100)
        });
        
        toast({
          title: "Validation Failed",
          description: `Found ${data.totalErrors} errors in the CSV file. Please fix them and try again.`,
          variant: "destructive",
        });
        
        // Clean up socket connection
        socket.disconnect();
        setSocketInstance(null);
        setIsUploading(false);
      });

    } catch (error) {
      console.error("CSV upload error:", error);
      updateUploadProgress({
        status: 'failed',
        errors: [{
          row: 0,
          column: '',
          message: error instanceof Error ? error.message : "Failed to process CSV file"
        }]
      });
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process CSV file",
        variant: "destructive",
      });
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExportTemplate = () => {
    if (!columns.length) return;
    
    // Create CSV content with headers only
    const csvContent = columns.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tableName || 'table'}_template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (isDataLoading || isPermissionsLoading || isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00bfa5]"></div>
      </div>
    );
  }

  if (dataError || permissionsError) {
    return (
      <div className="text-red-600 p-4 text-center bg-red-50 rounded-lg">
        {dataError || permissionsError}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      {error && (
        <div className="m-4 p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>
      )}
      <div className="flex flex-col flex-1 bg-white rounded-lg border border-[#e3f2fd] overflow-hidden">
        {/* Search and Filter Controls */}
        <div className="px-6 py-4 border-b border-[#e3f2fd] bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Search Box Container */}
            <div className="flex-1 max-w-8xl relative">
              <div className="relative flex items-center w-full shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search in all columns..."
                  value={searchInput}
                  onChange={handleSearch}
                  className="w-full pl-11 pr-28 h-11 bg-white border border-[#e3f2fd] rounded-lg 
                focus:outline-none focus:border-[#00bfa5] focus:ring-[1px] focus:ring-[#00bfa5]/20 
                text-sm transition-all duration-200"
                />
                {/* Search Controls Overlay */}
                <div className="absolute right-0 inset-y-0 flex items-center">
                  {searchInput && (
                    <button
                      onClick={handleClearSearch}
                      className="h-full px-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="h-[calc(100%-8px)] w-[1px] bg-[#e3f2fd] mx-1" />
                  <button
                    onClick={handleSearchClick}
                    disabled={!searchInput.trim()}
                    className={`
                  h-9 px-4 mr-1 rounded-md text-sm font-medium 
                  transition-all duration-200 flex items-center gap-2
                  ${
                    searchInput.trim()
                      ? "bg-[#00bfa5] text-white hover:bg-[#00bfa5]/90 shadow-sm"
                      : "bg-gray-50 text-gray-400 cursor-not-allowed"
                  }
                `}
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportTemplate}
              disabled={!columns.length}
              className={`
                inline-flex items-center gap-2 px-4 h-11 rounded-lg 
                border border-[#e3f2fd] shadow-sm
                ${!columns.length
                  ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                  : "bg-[#00bfa5]/10 border-[#00bfa5]/20 hover:bg-[#00bfa5]/20 cursor-pointer"
                }
                transition-all duration-200 group whitespace-nowrap
              `}
            >
              <Download
                className={`h-4 w-4 
                  ${!columns.length
                    ? "text-gray-400"
                    : "text-[#00bfa5] group-hover:scale-110 transition-transform"
                  }`}
              />
              <span
                className={`text-sm font-medium 
                  ${!columns.length
                    ? "text-gray-400"
                    : "text-gray-600 group-hover:text-gray-800"
                  }
                `}
              >
                Download Template
              </span>
            </button>

            {/* CSV Upload Button */}
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              ref={fileInputRef}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className={`
            inline-flex items-center gap-2 px-4 h-11 rounded-lg 
            border border-[#e3f2fd] shadow-sm
            ${
              isUploading
                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                : "bg-[#00bfa5]/10 border-[#00bfa5]/20 hover:bg-[#00bfa5]/20 cursor-pointer"
            }
            border shadow-sm
            transition-all duration-200 group whitespace-nowrap
          `}
            >
              <Upload
                className={`h-4 w-4 
              ${
                isUploading
                  ? "text-gray-400"
                  : "text-[#00bfa5] group-hover:scale-110 transition-transform"
              }`}
              />
              <span
                className={`text-sm font-medium 
            ${
              isUploading
                ? "text-gray-400"
                : "text-gray-600 group-hover:text-gray-800"
            }
          `}
              >
                {isUploading ? "Uploading..." : "Upload CSV"}
              </span>
            </label>
          </div>
        </div>

        {/* Rest of the content */}

        <div className="space-y-4">
          {csvErrors.length > 0 && showErrors && (
            <div className="mx-4 mb-4 p-4 border border-red-200 rounded-lg bg-red-50/80 backdrop-blur-sm shadow-sm relative">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <h3 className="font-medium">CSV Validation Errors</h3>
                </div>
                <button
                  onClick={() => setShowErrors(false)}
                  className="p-1 hover:bg-red-100 rounded-full transition-colors"
                  aria-label="Close error messages"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
              <div className="max-h-40 overflow-auto scrollbar-thin scrollbar-thumb-red-200 scrollbar-track-transparent pr-2">
                <ul className="space-y-1.5">
                  {csvErrors.map((error, index) => (
                    <li
                      key={index}
                      className="text-sm text-red-600 flex items-start gap-2"
                    >
                      <span className="min-w-[6rem] font-medium">
                        {error.originalLineNumber ? `Line ${error.originalLineNumber}:` : `Row ${error.row}:`}
                      </span>
                      <span className="font-medium">{error.column}</span>
                      <span className="text-red-500">- {error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-[#e3f2fd] scrollbar-track-transparent min-h-[300px]">
          <table className="w-full border-collapse min-w-max">
            {/* Fixed header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#f8fafc] border-b border-[#e3f2fd]">
                <th className="sticky left-0 z-20 bg-[#f8fafc] px-4 py-3 text-left text-sm font-medium text-[#1a237e] w-[80px]">
                  Action
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className={`px-6 py-3 text-left text-sm font-medium text-[#1a237e] ${getColumnStyle(
                      column
                    )}`}
                  >
                    <div className="flex items-center gap-2 cursor-pointer group whitespace-nowrap relative">
                      <div
                        className="flex items-center gap-2 cursor-pointer group whitespace-nowrap"
                        onClick={() => handleSort(column)}
                      >
                        {getDisplayName(column)}

                        <div
                          className={` flex flex-col gap-0 ml-1.5 
                            ${
                              filterParams.sortColumn === column ||
                              filterParams.sortDirection === null
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            } transition-opacity
                          `}
                        >
                          <div
                            className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                              ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "asc"
                                  ? "bg-[#00bfa5] p-0.5" // Active ascending background
                                  : ""
                              }`}
                          >
                            <ChevronUp
                              className={`h-2.5 w-2.5 ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "asc"
                                  ? "text-white stroke-[2.5]" // Active ascending icon
                                  : filterParams.sortDirection === null
                                  ? "text-gray-400 group-hover:text-[#00bfa5]"
                                  : "text-gray-400 group-hover:text-[#00bfa5]/70"
                              }`}
                            />
                          </div>

                          <div
                            className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                              ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "desc"
                                  ? "bg-[#00bfa5] p-0.5" // Active descending background
                                  : ""
                              }`}
                          >
                            <ChevronDown
                              className={`h-2.5 w-2.5 ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "desc"
                                  ? "text-white stroke-[2.5]" // Active descending icon
                                  : filterParams.sortDirection === null
                                  ? "text-gray-400 group-hover:text-[#00bfa5]"
                                  : "text-gray-400 group-hover:text-[#00bfa5]/70"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Filter icon */}
                      <button
                        className={`filter-icon p-1.5 rounded transition-colors flex items-center justify-center
                        ${
                          hasActiveFilter(column)
                            ? "bg-[#00bfa5] text-white hover:bg-[#00bfa5]/90"
                            : "text-gray-400 hover:bg-[#e3f2fd] hover:text-[#00bfa5]"
                        }
                        ${
                          activeFilterColumn === column
                            ? "bg-[#00bfa5] text-white"
                            : ""
                        }`}
                        onClick={(e) => handleFilterClick(column, e)}
                      >
                        <Filter className="w-4 h-4" />
                      </button>

                      {/* Filter dropdown */}
                      {activeFilterColumn === column && (
                        <div className="filter-dropdown absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-[#e3f2fd] z-50">
                          <div className="p-4">
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter Type
                              </label>
                              <select
                                className="w-full p-2 border border-[#e3f2fd] rounded-md shadow-sm focus:border-[#00bfa5] focus:ring-1 focus:ring-[#00bfa5] focus:outline-none"
                                value={
                                  tempFilters[column]?.operator || "contains"
                                }
                                onChange={(e) => {
                                  const newOperator = e.target.value;
                                  setTempFilters((prev) => ({
                                    ...prev,
                                    [column]: {
                                      operator: newOperator,
                                      value:
                                        newOperator === "isEmpty"
                                          ? ""
                                          : prev[column]?.value || "",
                                    },
                                  }));
                                }}
                              >
                                {filterOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {(!tempFilters[column]?.operator ||
                              tempFilters[column]?.operator !== "isEmpty") && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Filter Value
                                </label>
                                <input
                                  type="text"
                                  className="w-full p-2 border border-[#e3f2fd] rounded-md shadow-sm focus:border-[#00bfa5] focus:ring-1 focus:ring-[#00bfa5] focus:outline-none"
                                  placeholder="Enter value..."
                                  value={tempFilters[column]?.value || ""}
                                  onChange={(e) => {
                                    applyFilter(
                                      column,
                                      tempFilters[column]?.operator ||
                                        "contains",
                                      e.target.value
                                    );
                                  }}
                                />
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#e3f2fd]">
                              <button
                                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                onClick={() => {
                                  clearFilter(column);
                                  setTempFilters((prev) => {
                                    const newFilters = { ...prev };
                                    delete newFilters[column];
                                    return newFilters;
                                  });
                                }}
                              >
                                Clear
                              </button>
                              <button
                                className="px-4 py-2 text-sm font-medium text-white bg-[#00bfa5] hover:bg-[#00bfa5]/90 rounded-md transition-colors"
                                onClick={() => handleApplyFilter(column)}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="divide-y divide-[#e3f2fd]">
              {processedData.length > 0 ? (
                processedData.map((row, index) => (
                  <tr
                    key={index}
                    className="hover:bg-[#f8fafc] transition-colors even:bg-gray-50"
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 w-[80px]">
                      <button
                        className="p-1.5 hover:bg-[#e3f2fd] rounded-lg transition-colors"
                        onClick={() => handleEditClick(row)}
                      >
                        <svg
                          className="w-5 h-5 text-[#00bfa5]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={`${row.id}_${column}`}
                        className={`px-4 py-2 ${getColumnStyle(column)}`}
                      >
                        {renderCell(row[column], row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="h-[200px]">
                  <td colSpan={columns.length + 1} className="align-top pt-10">
                    <div className="flex flex-col items-start ml-[35vw] text-gray-500">
                      <p
                        className="text-lg font-medium"
                        style={{ color: "black" }}
                      >
                        No matching records found
                      </p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination and Page Size Selector - Bottom */}
        {pagination.totalPages > 0 && (
          <div className="border-t border-[#e3f2fd] bg-white py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#1a237e] font-medium">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-[#e3f2fd] text-sm text-[#1a237e] focus:outline-none focus:border-[#00bfa5]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <Pagination
                currentPage={filterParams.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Row Button */}
      {
        <button
          onClick={handleAddClick}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[#00bfa5] text-white rounded-full shadow-lg hover:bg-[#00bfa5]/90 transition-colors flex items-center justify-center z-30"
          aria-label="Add new row"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      }

      {/* Edit Drawer */}
      <EditRowDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        row={selectedRow}
        columns={columns}
        renamedColumns={renamedColumns}
        onSave={handleRowSave}
        mode={isAddMode ? "add" : "edit"}
        isColumnEditable={isColumnEditable}
        tableName={tableName}
        dropdownColumns={dropdownColumns}
        dataTypes={dataTypes}
      />

      {/* CSV Upload Progress */}
      {showUploadProgress && (
        <CSVUploadProgress 
          onClose={() => setShowUploadProgress(false)}
        />
      )}
    </div>
  );
};
