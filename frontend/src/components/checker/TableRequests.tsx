import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileWarning,
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
  const itemsPerPage = 10;
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(
    null
  );
  

  const fetchUserEmails = async (userIds: string[]): Promise<Record<string, string>> => {
    if (userIds.length === 0) return {};
    try {
        const response = await fetch(`${API_URL}/users/emails`, {
            method: "POST",
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

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_REQUESTS}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data: ApiResponse = await response.json();
      if (data.success) {
        // Filter requests for current table
        const tableRequests = data.data.filter(
            (req) => req.table_name === tableName && req.status === "pending"
        );

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
  }, [tableName, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle approve/reject actions
  const handleApprove = async (rowId: string, requestId: string) => {
    try {
      const response = await fetch(`${API_URL}${ENDPOINTS.CHECKER.APPROVE}`, {
        method: "POST",
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

    try {
      const response = await fetch(`${API_URL}${ENDPOINTS.CHECKER.REJECT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          row_id: requestToReject,
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

  const handleApproveAll = async (rowIds: string[]) => {
    try {
      const response = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.APPROVE_ALL}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            row_ids: rowIds,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "All selected requests approved successfully",
        });
        setSelectedRequests([]);
        fetchRequests();
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to approve requests",
        variant: "destructive",
      });
    }
  };

  const handleRejectAll = async (rowIds: string[]) => {
    if (!rejectComment) {
      setIsBulkReject(true);
      setShowRejectDialog(true);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.REJECT_ALL}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            row_ids: rowIds,
            comments: rejectComment,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "All selected requests rejected successfully",
        });
        setSelectedRequests([]);
        setShowRejectDialog(false);
        setRejectComment("");
        setIsBulkReject(false);
        fetchRequests();
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to reject requests",
        variant: "destructive",
      });
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
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <FileWarning className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No pending changes
        </h3>
        <p className="text-gray-500">
          There are no changes to review for this table
        </p>
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
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => {
              if (selectedRequests.length === requests.length) {
                setSelectedRequests([]);
              } else {
                setSelectedRequests(requests.map((r) => r.row_id));
              }
            }}
          >
            <Checkbox checked={selectedRequests.length === requests.length} />
            Select All
          </Button>

          {selectedRequests.length > 0 && (
            <>
              <Button
                variant="ghost"
                className="text-[#00BFA5] hover:bg-[#00BFA5]/10"
                onClick={() => handleApproveAll(selectedRequests)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Selected
              </Button>
              <Button
                variant="ghost"
                className="text-[#FF5722] hover:bg-[#FF5722]/10"
                onClick={() => handleRejectAll(selectedRequests)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Selected
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
                  {column.replace(/_/g, " ")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests
              .slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage
              )
              .map((request, index) => (
                <TableRow
                  key={request.request_id}
                  className="hover:bg-gray-50/50"
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedRequests.includes(request.row_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRequests([
                            ...selectedRequests,
                            request.row_id,
                          ]);
                        } else {
                          setSelectedRequests(
                            selectedRequests.filter(
                              (id) => id !== request.row_id
                            )
                          );
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() =>
                          handleApprove(request.row_id, request.request_id)
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
                  <TableCell className="text-center">{index + 1}</TableCell>
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

                    console.log(`Comparing column: ${column}`);
                    console.log(`Old Value: ${oldValue}, New Value: ${newValue}`);

                    
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

      <div className="border-t pt-4 mt-auto">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(requests.length / itemsPerPage)}
          onPageChange={setCurrentPage}
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
                  handleRejectAll(selectedRequests);
                } else {
                  handleReject();
                }
              }}
              disabled={!rejectComment}
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
    </div>
  );
};