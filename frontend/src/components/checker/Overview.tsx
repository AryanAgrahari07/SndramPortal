import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { API_URL, ENDPOINTS } from "@/config/constants";
import { UngroupedView } from "./UngroupedView";
import { GroupedView } from "./GroupedView";

interface TableRequest {
  table_name: string;
  request_id: string;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
  status: string;
  maker: string;
  created_at: string;
  updated_at: string;
  comments?: string;
  row_id: string;
  group_name?: string;
}

interface TableSummary {
  table_name: string;
  pending_count: number;
}

interface CheckerResponse {
  success: boolean;
  message: string;
  data: TableRequest[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GroupedCheckerResponse {
  success: boolean;
  message: string;
  data: GroupedTables;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type GroupedTables = Record<string, TableSummary[]>;

export const Overview = () => {
  const [selectedView, setSelectedView] = useState<"ungroup" | "group">(
    "ungroup"
  );
  const [ungroupedTables, setUngroupedTables] = useState<TableSummary[]>([]);
  const [groupedTables, setGroupedTables] = useState<GroupedTables>({});
  const [isLoading, setIsLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const { toast } = useToast();

  const fetchTableRequests = useCallback(async () => {
    try {
      setIsLoading(true);

      // For the overview page, we only need summary data (counts per table)
      // Instead of fetching all records, we'll use a special endpoint or parameter
      // that returns just the counts
      const ungroupedResponse = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_REQUESTS}?summary=true`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Fetch grouped tables summary
      const groupedResponse = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_GROUP_REQUESTS}?summary=true`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const [ungroupedData, groupedData] = await Promise.all([
        ungroupedResponse.json() as Promise<CheckerResponse>,
        groupedResponse.json() as Promise<GroupedCheckerResponse>,
      ]);

      if (ungroupedData.success && groupedData.success) {
        // For ungrouped tables, the summary data should already be in the format we need
        // If the backend provides the counts directly, use them
        if (Array.isArray(ungroupedData.data) && ungroupedData.data.length > 0 && 'table_name' in ungroupedData.data[0] && 'pending_count' in ungroupedData.data[0]) {
          // If the backend already returns summary data in the right format
          setUngroupedTables(ungroupedData.data as unknown as TableSummary[]);
        } else {
          // Otherwise, calculate the counts from the full data
          // This is less efficient but works as a fallback
          const tableRequests = ungroupedData.data.reduce<TableSummary[]>(
            (acc, request) => {
              const existing = acc.find(
                (t) => t.table_name === request.table_name
              );
              if (existing) {
                existing.pending_count++;
              } else {
                acc.push({
                  table_name: request.table_name,
                  pending_count: 1,
                });
              }
              return acc;
            },
            []
          );
          setUngroupedTables(tableRequests);
        }

        // Set grouped tables
        setGroupedTables(groupedData.data);

        // Get total pending count from pagination metadata if available
        let totalPendingCount = 0;
        
        if (ungroupedData.pagination) {
          totalPendingCount = ungroupedData.pagination.total;
        } else {
          // Calculate total from the table summaries
          totalPendingCount = ungroupedTables.reduce(
            (sum, table) => sum + table.pending_count, 
            0
          );
          
          // If that's still 0, try to count from the raw data
          if (totalPendingCount === 0 && Array.isArray(ungroupedData.data)) {
            totalPendingCount = ungroupedData.data.length;
          }
        }

        setTotalPending(totalPendingCount);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, ungroupedTables.length]);

  useEffect(() => {
    fetchTableRequests();
  }, [fetchTableRequests]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
            <Button
                variant={selectedView === "ungroup" ? "default" : "outline"}
                onClick={() => setSelectedView("ungroup")}
                className={`transition-colors duration-200 ${
                  selectedView === "ungroup"
                    ? "bg-[#1A237E] hover:bg-[#283593] text-white"
                    : "text-[#1A237E] border-[#1A237E] hover:bg-[#E8EAF6]"
                }`}
                >
             All
            </Button>
            <Button
                variant={selectedView === "group" ? "default" : "outline"}
                onClick={() => setSelectedView("group")}
                className={`transition-colors duration-200 ${
                  selectedView === "group"
                    ? "bg-[#1A237E] hover:bg-[#283593] text-white"
                    : "text-[#1A237E] border-[#1A237E] hover:bg-[#E8EAF6]"
                }`}
                >
              Grouped
           </Button>
        </div>
        <div className="text-sm">
          Pending reviews :{" "}
          <span className="text-[#FF5722]">{totalPending}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : selectedView === "ungroup" ? (
        <UngroupedView tables={ungroupedTables} />
      ) : (
        <GroupedView groups={groupedTables} />
      )}
    </div>
  );
};
