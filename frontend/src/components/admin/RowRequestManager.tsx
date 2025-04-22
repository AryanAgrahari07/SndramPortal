import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  X,
  Eye,
  ChevronUp,
  ChevronDown,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { ConfirmDialog } from "../ConfirmDialog";

interface RowData {
  [key: string]: string | number | boolean | null | undefined;
}

interface RowRequest {
  request_id: string;
  table_name: string;
  row_data: RowData;
  status: "pending" | "approved" | "rejected";
  maker: string;
  created_at: string;
  comments?: string;
  maker_email: string;
}

interface ColumnMapping {
  original_column_name: string;
  renamed_column_name: string;
}

interface RowDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: RowData;
  title?: string;
  tableName: string;
}

const RowDataDialog: React.FC<RowDataDialogProps> = ({
  isOpen,
  onClose,
  data,
  title = "Row Data",
  tableName,
}) => {
  // Filter out empty strings and null/undefined values
  const filteredData = Object.entries(data || {}).reduce(
    (acc, [key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    },
    {} as RowData
  );

  const [renamedColumns, setRenamedColumns] = useState<ColumnMapping[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  const fetchRenamed = async (tableName: string) => {
    try {
      setIsLoadingColumns(true);
      const response = await fetch(`http://localhost:8080/renamed/${tableName}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch renamed table data');
      }
      
      const data = await response.json();
      if (data.success) {
        setRenamedColumns(data.data);
      }
    } catch (error) {
      console.error('Error fetching renamed columns:', error);
    } finally {
      setIsLoadingColumns(false);
    }
  };

  useEffect(() => {
    if (isOpen && tableName) {
      fetchRenamed(tableName);
    }
  }, [isOpen, tableName]);

  // Add this function to get display name
  const getDisplayName = (columnName: string) => {
    if (isLoadingColumns) {
      return "Loading...";
    }

    if (!renamedColumns || renamedColumns.length === 0) {
      return columnName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    const mapping = renamedColumns.find(m => m.original_column_name === columnName);
    return mapping?.renamed_column_name || columnName;
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <div className="rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Field
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(filteredData).map(([key, value]) => (
                  <tr key={key}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {getDisplayName(key)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface RowRequestManagerProps {
  selectTable?: string | null;
}

export default function RowRequestManager({
  selectTable,
}: RowRequestManagerProps) {
  const [requests, setRequests] = useState<RowRequest[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [viewingData, setViewingData] = useState<RowData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    requestId: "",
    isBulk: false,
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: "maker_email" | "table_name" | "created_at";
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedMaker, setSelectedMaker] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isDateFilterDialogOpen, setIsDateFilterDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  // function to filter by date range
  const filterByDateRange = (requests: any[]) => {
    if (!dateRange) return requests;

    return requests.filter((request) => {
      const requestDate = new Date(request.created_at);

      // If only start date is selected
      if (dateRange.start && !dateRange.end) {
        const startDate = new Date(dateRange.start);
        return requestDate >= startDate;
      }

      // If only end date is selected
      if (!dateRange.start && dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return requestDate <= endDate;
      }

      // If both dates are selected
      if (dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return requestDate >= startDate && requestDate <= endDate;
      }

      return true;
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange]);

  // Get unique makers for the selected table
  const getMakersForSelectedTable = () => {
    if (!selectedTable) return [];
    return Array.from(
      new Set(
        requests
          .filter((req) => req.table_name === selectedTable)
          .map((req) => req.maker_email)
      )
    ).sort();
  };

  // Get unique table names from requests
  const uniqueTableNames = Array.from(
    new Set(requests.map((req) => req.table_name))
  ).sort();

  // Sort and filter requests
  const getSortedAndFilteredRequests = () => {
    let result = [...requests];

    // Apply maker filter
    if (selectedMaker) {
      result = result.filter((req) => req.maker_email === selectedMaker);
    }

    // Apply table filter
    if (selectedTable) {
      result = result.filter((req) => req.table_name === selectedTable);
    }

    // Apply date range filter
    result = filterByDateRange(result);

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === "created_at") {
          const dateA = new Date(a[sortConfig.key]).getTime();
          const dateB = new Date(b[sortConfig.key]).getTime();
          return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
        }

        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  };

  const handleSort = (key: "maker_email" | "table_name" | "created_at") => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === "asc") {
          return { key, direction: "desc" };
        } else if (current.direction === "desc") {
          return null; // Reset to no sorting
        }
      }
      return { key, direction: "asc" };
    });
  };

  useEffect(() => {
    if (selectTable) {
      setSelectedTable(selectTable);
    }
  }, [selectTable]);

  useEffect(() => {
    fetchRequests();
  }, []);

  // Set initial selected table when requests are loaded
  useEffect(() => {
    if (requests.length > 0 && !selectedTable) {
      setSelectedTable(uniqueTableNames[0]);
    }
  }, [requests]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/fetchrowrequest", {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setRequests(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch requests");
      }
    } catch (error: unknown) {
      console.error("Failed to fetch requests:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setConfirmDialog({
      isOpen: true,
      requestId,
      isBulk: false,
    });
  };

  const handleConfirmAccept = async (requestId: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/acceptrow", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Request approved successfully",
        });
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to approve request");
      }
    } catch (error: unknown) {
      console.error("Failed to approve request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (requestId: string, comments: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/rejectrow", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: requestId, comments }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Request rejected successfully",
        });
        setRejectDialogOpen(false);
        setRejectingRequestId(null);
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to reject request");
      }
    } catch (error: unknown) {
      console.error("Failed to reject request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const handleBulkAccept = () => {
    setConfirmDialog({
      isOpen: true,
      requestId: "",
      isBulk: true,
    });
  };

  // Add bulk operations
  const handleBulkAcceptConfirm = async () => {
    if (selectedRequests.length === 0) return;
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/acceptallrow", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_ids: selectedRequests }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Requests approved successfully",
        });
        setSelectedRequests([]);
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to approve requests");
      }
    } catch (error: unknown) {
      console.error("Failed to approve requests:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to approve requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReject = async (comments: string) => {
    if (selectedRequests.length === 0) return;
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/rejectallrow", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_ids: selectedRequests, comments }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Requests rejected successfully",
        });
        setSelectedRequests([]);
        setRejectDialogOpen(false);
        await fetchRequests();
      } else {
        throw new Error(data.message || "Failed to reject requests");
      }
    } catch (error: unknown) {
      console.error("Failed to reject requests:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reject requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update filteredRequests to use the new function
  const filteredRequests = getSortedAndFilteredRequests();

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [selectedTable, selectedMaker, sortConfig]);

  const getPaginatedData = () => {
    if (filteredRequests.length === 0) return [];

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRequests.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  return (
    <div className="space-y-4">
      {/* Table Tabs */}
      <div className="flex gap-2">
        {uniqueTableNames.map((tableName) => (
          <button
            key={tableName}
            onClick={() => {
              setSelectedTable(tableName);
              setSelectedMaker(null);
            }}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${
                selectedTable === tableName
                  ? "bg-[#0F172A] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }
            `}
          >
            {tableName
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedRequests.length === filteredRequests.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRequests(
                      filteredRequests.map((req) => req.request_id)
                    );
                  } else {
                    setSelectedRequests([]);
                  }
                }}
                aria-label="Select all"
                disabled={isLoading}
              />
            </TableHead>
            <TableHead className="w-[100px]">Action</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("table_name")}
            >
              <div className="flex items-center gap-1">
                Table
                <div className="flex flex-col items-center">
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                    ${
                      sortConfig?.key === "table_name" &&
                      sortConfig.direction === "asc"
                        ? "bg-[#00bfa5] p-0.5"
                        : ""
                    }`}
                  >
                    <ChevronUp
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "table_name" &&
                        sortConfig.direction === "asc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                    ${
                      sortConfig?.key === "table_name" &&
                      sortConfig.direction === "desc"
                        ? "bg-[#00bfa5] p-0.5"
                        : ""
                    }`}
                  >
                    <ChevronDown
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "table_name" &&
                        sortConfig.direction === "desc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </TableHead>

            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("maker_email")}
            >
              <div className="flex items-center gap-1">
                Maker
                <div className="flex flex-col items-center">
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                      ${
                        sortConfig?.key === "maker_email" &&
                        sortConfig.direction === "asc"
                          ? "bg-[#00bfa5] p-0.5"
                          : ""
                      }`}
                  >
                    <ChevronUp
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "maker_email" &&
                        sortConfig.direction === "asc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                      ${
                        sortConfig?.key === "maker_email" &&
                        sortConfig.direction === "desc"
                          ? "bg-[#00bfa5] p-0.5"
                          : ""
                      }`}
                  >
                    <ChevronDown
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "maker_email" &&
                        sortConfig.direction === "desc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDialogOpen(true);
                  }}
                  className={`ml-1 p-1 rounded transition-colors duration-200 ${
                    selectedMaker
                      ? "bg-[#00bfa5]/10 text-[#00bfa5] hover:bg-[#00bfa5]/20"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </TableHead>

            {/* Filter Dialog */}
            <Dialog
              open={isFilterDialogOpen}
              onOpenChange={setIsFilterDialogOpen}
            >
              <DialogContent className="sm:max-w-[425px] p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Filter by Maker
                  </DialogTitle>
                </DialogHeader>

                <div className="p-6">
                  <div className="space-y-4">
                    <div className="relative">
                      <label
                        htmlFor="maker-filter"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Select Maker
                      </label>
                      <select
                        id="maker-filter"
                        value={selectedMaker || ""}
                        onChange={(e) => {
                          setSelectedMaker(e.target.value || null);
                          setIsFilterDialogOpen(false);
                        }}
                        className="w-full appearance-none bg-white pl-3 pr-10 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00bfa5] focus:border-[#00bfa5] transition-colors duration-200"
                      >
                        <option value="">All Makers</option>
                        {getMakersForSelectedTable().map((maker) => (
                          <option key={maker} value={maker}>
                            {maker}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                    {selectedMaker && (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            Selected:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedMaker}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedMaker(null);
                            setIsFilterDialogOpen(false);
                          }}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg flex justify-end gap-3">
                  <button
                    onClick={() => setIsFilterDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00bfa5]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsFilterDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#00bfa5] rounded-md hover:bg-[#00bfa5]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00bfa5]"
                  >
                    Apply
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            <TableHead>Status</TableHead>

            <TableHead
              className="cursor-pointer"
              onClick={() => handleSort("created_at")}
            >
              <div className="flex items-center gap-1">
                Created At
                <div className="flex flex-col items-center">
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                    ${
                      sortConfig?.key === "created_at" &&
                      sortConfig.direction === "asc"
                        ? "bg-[#00bfa5] p-0.5"
                        : ""
                    }`}
                  >
                    <ChevronUp
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "created_at" &&
                        sortConfig.direction === "asc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                  <div
                    className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                    ${
                      sortConfig?.key === "created_at" &&
                      sortConfig.direction === "desc"
                        ? "bg-[#00bfa5] p-0.5"
                        : ""
                    }`}
                  >
                    <ChevronDown
                      className={`h-2.5 w-2.5 ${
                        sortConfig?.key === "created_at" &&
                        sortConfig.direction === "desc"
                          ? "text-white stroke-[2.5]"
                          : sortConfig?.direction === null
                          ? "text-gray-400 group-hover:text-[#00bfa5]"
                          : "text-gray-400 group-hover:text-[#00bfa5]/70"
                      }`}
                    />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDateFilterDialogOpen(true);
                  }}
                  className={`ml-1 p-1 rounded transition-colors duration-200 ${
                    dateRange
                      ? "bg-[#00bfa5]/10 text-[#00bfa5] hover:bg-[#00bfa5]/20"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </TableHead>

            <Dialog
              open={isDateFilterDialogOpen}
              onOpenChange={setIsDateFilterDialogOpen}
            >
              <DialogContent className="sm:max-w-[425px] p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Filter by Date Range
                  </DialogTitle>
                </DialogHeader>

                <div className="p-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="start-date"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          id="start-date"
                          value={dateRange?.start || ""}
                          onChange={(e) => {
                            setDateRange((prev) => ({
                              ...(prev || { end: "" }),
                              start: e.target.value,
                            }));
                          }}
                          className="w-full appearance-none bg-white px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00bfa5] focus:border-[#00bfa5] transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="end-date"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          id="end-date"
                          value={dateRange?.end || ""}
                          onChange={(e) => {
                            setDateRange((prev) => ({
                              ...(prev || { start: "" }),
                              end: e.target.value,
                            }));
                          }}
                          className="w-full appearance-none bg-white px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00bfa5] focus:border-[#00bfa5] transition-colors duration-200"
                        />
                      </div>
                    </div>

                    {dateRange && (dateRange.start || dateRange.end) && (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            Selected Range:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {dateRange.start &&
                              new Date(
                                dateRange.start
                              ).toLocaleDateString()}{" "}
                            -
                            {dateRange.end &&
                              new Date(dateRange.end).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setDateRange(null);
                            setIsDateFilterDialogOpen(false);
                          }}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg flex justify-end gap-3">
                  <button
                    onClick={() => setIsDateFilterDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00bfa5]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsDateFilterDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#00bfa5] rounded-md hover:bg-[#00bfa5]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00bfa5]"
                  >
                    Apply
                  </button>
                </div>
              </DialogContent>
            </Dialog>

            <TableHead>View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-4">
                Loading...
              </TableCell>
            </TableRow>
          ) : filteredRequests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-4">
                No requests found
              </TableCell>
            </TableRow>
          ) : (
            getPaginatedData().map((request) => (
              // filteredRequests.map((request) => (
              <TableRow key={request.request_id}>
                <TableCell>
                  <Checkbox
                    checked={selectedRequests.includes(request.request_id)}
                    onCheckedChange={(checked) =>
                      setSelectedRequests(
                        checked
                          ? [...selectedRequests, request.request_id]
                          : selectedRequests.filter(
                              (id) => id !== request.request_id
                            )
                      )
                    }
                    aria-label={`Select row ${request.request_id}`}
                    disabled={isLoading}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {/* Updated Accept button with confirmation dialog */}
                    <button
                      className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                      onClick={() => handleAccept(request.request_id)}
                      disabled={isLoading}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      onClick={() => {
                        setRejectingRequestId(request.request_id);
                        setRejectDialogOpen(true);
                      }}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>{request.table_name}</TableCell>
                <TableCell>{request.maker_email}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      request.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : request.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {request.status}
                  </span>
                </TableCell>
                <TableCell>{formatDate(request.created_at)}</TableCell>
                <TableCell>
                  <button
                    className="p-1 rounded-full hover:bg-gray-100"
                    onClick={() => setViewingData(request.row_data)}
                    disabled={isLoading}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 0 && (
        <div className="border-t border-[#e3f2fd] bg-white py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#1a237e] font-medium">
                Rows per page:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1); // Reset to first page when changing page size
                }}
                className="h-8 px-2 rounded-lg border border-[#e3f2fd] text-sm text-[#1a237e] focus:outline-none focus:border-[#00bfa5]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-md text-sm ${
                        currentPage === page
                          ? "bg-[#00bfa5] text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedRequests.length > 0 && (
        <div className="mb-4 flex justify-end space-x-2">
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            onClick={() => {
              setRejectingRequestId(null);
              setRejectDialogOpen(true);
            }}
            disabled={isLoading}
          >
            Reject Selected ({selectedRequests.length})
          </button>
          {/* Updated Bulk Accept button with confirmation dialog */}
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            onClick={handleBulkAccept}
            disabled={isLoading}
          >
            Accept Selected ({selectedRequests.length})
          </button>
        </div>
      )}

      {/* View Data Dialog */}
      {viewingData && (
        <RowDataDialog
          isOpen={true}
          onClose={() => setViewingData(null)}
          data={viewingData}
          title="Row Data Details"
          tableName={selectedTable|| ""}
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-[400px] sm:max-w-[400px] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              {rejectingRequestId
                ? "Reject Request"
                : "Reject Selected Requests"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const comments = formData.get("comments") as string;
                if (comments) {
                  if (rejectingRequestId) {
                    handleReject(rejectingRequestId, comments);
                  } else {
                    handleBulkReject(comments);
                  }
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="comments"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Rejection Comments
                  </label>
                  <textarea
                    id="comments"
                    name="comments"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                    rows={3}
                    placeholder="Enter reason for rejection..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setRejectDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog - New Addition */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog({ isOpen: false, requestId: "", isBulk: false })
        }
        onConfirm={() => {
          if (confirmDialog.isBulk) {
            handleBulkAcceptConfirm();
          } else {
            handleConfirmAccept(confirmDialog.requestId);
          }
          setConfirmDialog({ isOpen: false, requestId: "", isBulk: false });
        }}
        title={`Confirm ${confirmDialog.isBulk ? "Bulk " : ""}Approval`}
        description={
          confirmDialog.isBulk
            ? `Are you sure you want to approve ${selectedRequests.length} selected requests?`
            : "Are you sure you want to approve this request?"
        }
        variant="success"
      />
    </div>
  );
}
