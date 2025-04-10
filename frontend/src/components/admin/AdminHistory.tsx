import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  FileWarning,
  
  Eye,
  X,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Pagination } from "@/components/Pagination";
import { Input } from "@/components/ui/input";

interface HistoryRecord {
  id: string;
  table_name: string;
  request_id: string;
  row_id: string;
  maker: string;
  checker: string;
  status: string;
  created_at: string;
  comments?: string;
  type: 'change' | 'add';
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  row_data?: Record<string, unknown>;
  maker_email: string;
  checker_email: string;
}

type FilterStatus = "all" | "approved" | "rejected";
type DateFilter = "all" | "today" | "last7days" | "last30days" | "last90days" | "custom";

export const AdminHistory = () => {
  const [requests, setRequests] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<HistoryRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState({
    from: "",
    to: "",
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchText, setSearchText] = useState("");

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response =  await fetch(`http://localhost:8080/history?page=${currentPage}&limit=${itemsPerPage}&status=${filterStatus}&search=${searchQuery}&from=${customDateRange.from}&to=${customDateRange.to}`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setRequests(data.data);
        setTotal(data.total);
        setTotalPages(Math.ceil(data.total / itemsPerPage));
      } else {
        toast({
          variant: "destructive",
          description: "Failed to fetch history",
        });
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        variant: "destructive",
        description: "An error occurred while fetching history",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterStatus, searchQuery, dateFilter, customDateRange,itemsPerPage, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSearch = () => {
    setSearchQuery(searchText);
    setCurrentPage(1);
    loadRequests();
  };

  const handleDateChange = (type: "from" | "to", value: string) => {
    setCustomDateRange((prev) => ({
      ...prev,
      [type]: value,
    }));
    setDateFilter("custom");
  };

  const renderChanges = (request: HistoryRecord) => {
    if (request.type === 'change' && request.old_data && request.new_data) {
      const changes: string[] = [];
      Object.keys(request.new_data || {}).forEach((key) => {
        if (request.old_data?.[key] !== request.new_data?.[key]) {
          changes.push(
            `${key}: ${request.old_data?.[key] || "null"} → ${request.new_data?.[key] || "null"}`
          );
        }
      });
      return changes;
    } else if (request.type === 'add' && request.row_data) {
      return Object.entries(request.row_data).map(([key, value]) => 
        `${key}: ${value || "null"}`
      );
    }
    return [];
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setCustomDateRange({ from: "", to: "" });
    setCurrentPage(1);
    loadRequests();
    setSearchText("");
  };

  const handleFilterChange = (status: FilterStatus) => {
    setIsLoading(true);
    setFilterStatus(status);
    setSearchText("");
    setSearchQuery("");
    setCustomDateRange({ from: "", to: "" });
    setCurrentPage(1);
    setRequests([]);
    loadRequests();
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

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => handleFilterChange("all")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === "all"
              ? "bg-[#1A237E] text-white"
              : "border border-gray-200 hover:border-[#1A237E] text-gray-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange("approved")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === "approved"
              ? "bg-green-600 text-white"
              : "border border-gray-200 hover:border-green-600 text-gray-700"
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => handleFilterChange("rejected")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === "rejected"
              ? "bg-red-600 text-white"
              : "border border-gray-200 hover:border-red-600 text-gray-700"
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Search and Date Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search table, maker or comments..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 w-full sm:w-[300px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customDateRange.from}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="w-[150px]"
            max={customDateRange.to || undefined}
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={customDateRange.to}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="w-[150px]"
            min={customDateRange.from || undefined}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-400 transition-colors"
          >
            Clear Filters
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-colors ml-2"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileWarning className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No results found
          </h3>
          <p className="text-gray-500">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Maker</TableHead>
                <TableHead>Checker</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Comments</TableHead>               
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.request_id}>
                  <TableCell className="font-medium">
                    {request.table_name}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      request.type === 'change' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {request.type.charAt(0).toUpperCase() + request.type.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {request.status === "approved" ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-[#00bfa5]" />
                          <span className="text-[#00bfa5]">Approved</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-[#FF5722]" />
                          <span className="text-[#FF5722]">Rejected</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{request.maker_email}</TableCell>
                  <TableCell>{request.checker_email}</TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>{request.comments || "-"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
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
                  setCurrentPage(1);
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
              <span className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} requests
              </span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      )}


      {/* Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <DialogTitle className="text-2xl font-semibold">
              Request Details
            </DialogTitle>
            <button
              onClick={() => setSelectedRequest(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {selectedRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-12">
                <div>
                  <h4 className="text-gray-500 font-medium mb-2">Table</h4>
                  <p className="text-lg capitalize text-gray-900">
                    {selectedRequest.table_name.toLowerCase().replace(/_/g, " ")}
                  </p>
                </div>
                <div>
                  <h4 className="text-gray-500 font-medium mb-2">Status</h4>
                  <div className="flex items-center gap-2">
                    {selectedRequest.status === "approved" ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-[#00bfa5]" />
                        <span className="text-lg text-[#00bfa5]">Approved</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-[#FF5722]" />
                        <span className="text-lg text-[#FF5722]">Rejected</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-gray-500 font-medium mb-3">Changes</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {selectedRequest.type === 'change' ? (
                    renderChanges(selectedRequest)
                  ) : (
                    renderNewRow(selectedRequest.row_data)
                  )}
                </div>
              </div>

              {selectedRequest.comments && (
                <div>
                  <h4 className="text-gray-500 font-medium mb-2">Comments</h4>
                  <p className="text-gray-700">{selectedRequest.comments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper function to render new row data
const renderNewRow = (rowData: Record<string, unknown> | undefined) => {
  if (!rowData) return null;
  return Object.entries(rowData).map(([key, value], i) => (
    <div key={i} className="text-gray-700">
      <span className="text-gray-600">{key}:</span>{" "}
      <span className="text-[#1A237E] font-medium">{String(value)}</span>
    </div>
  ));
};