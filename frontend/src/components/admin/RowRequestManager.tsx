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
import { Check, X, Eye } from "lucide-react";
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

interface RowDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: RowData;
  title?: string;
}

const RowDataDialog: React.FC<RowDataDialogProps> = ({
  isOpen,
  onClose,
  data,
  title = "Row Data",
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
                      {key}
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

export default function RowRequestManager({ selectTable }: RowRequestManagerProps) {
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
    requestId: '',
    isBulk: false,
  });

  
  useEffect(() => {
    if (selectTable) {
      setSelectedTable(selectTable);
    }
  }, [selectTable]);


  // Get unique table names from requests
  const uniqueTableNames = Array.from(
    new Set(requests.map((req) => req.table_name))
  ).sort();

  // Filter requests based on selected table
  const filteredRequests = selectedTable
    ? requests.filter((req) => req.table_name === selectedTable)
    : requests;

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
      requestId: '',
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

  return (
    <div className="space-y-4">
      {/* Table Tabs */}
      <div className="flex gap-2">
        {uniqueTableNames.map((tableName) => (
          <button
            key={tableName}
            onClick={() => setSelectedTable(tableName)}
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
            <TableHead>Table</TableHead>
            <TableHead>Maker</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
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
            filteredRequests.map((request) => (
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
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0">
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
        onClose={() => setConfirmDialog({ isOpen: false, requestId: '', isBulk: false })}
        onConfirm={() => {
          if (confirmDialog.isBulk) {
            handleBulkAcceptConfirm();
          } else {
            handleConfirmAccept(confirmDialog.requestId);
          }
          setConfirmDialog({ isOpen: false, requestId: '', isBulk: false });
        }}
        title={`Confirm ${confirmDialog.isBulk ? 'Bulk ' : ''}Approval`}
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