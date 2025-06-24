import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/config/constants";

interface UseCheckerProps {
  onActionComplete?: () => void;
}

interface ApproveRejectResponse {
  success: boolean;
  message: string;
  trackerData?: {
    table_name: string;
    status: string;
    updated_at: string;
    comments?: string;
  };
}

export const useChecker = ({ onActionComplete }: UseCheckerProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleApprove = useCallback(
    async (rowId: string, requestId: string, comments?: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/approve`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            row_id: rowId,
            request_id: requestId,
            comments,
          }),
        });

        const data: ApproveRejectResponse = await response.json();

        if (!data.success) {
          throw new Error(data.message);
        }

        toast({
          title: "Success",
          description: "Changes approved successfully",
        });
        onActionComplete?.();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to approve changes",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, onActionComplete]
  );

  const handleReject = useCallback(
    async (rowId: string, comments: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/reject`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ row_id: rowId, comments }),
        });

        const data: ApproveRejectResponse = await response.json();

        if (!data.success) {
          throw new Error(data.message);
        }

        toast({
          title: "Success",
          description: "Changes rejected successfully",
        });
        onActionComplete?.();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to reject changes",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, onActionComplete]
  );

  const handleBulkApprove = useCallback(
    async (rowIds: string[], comments?: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/allApprove`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ row_ids: rowIds, comments }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message);
        }

        toast({
          title: "Success",
          description: "All changes approved successfully",
        });
        onActionComplete?.();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to approve changes",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, onActionComplete]
  );

  const handleBulkReject = useCallback(
    async (rowIds: string[], comments: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/allReject`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ row_ids: rowIds, comments }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message);
        }

        toast({
          title: "Success",
          description: "All changes rejected successfully",
        });
        onActionComplete?.();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to reject changes",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, onActionComplete]
  );

  return {
    isLoading,
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
  };
};
