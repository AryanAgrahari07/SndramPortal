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
}

interface GroupedCheckerResponse {
  success: boolean;
  message: string;
  data: GroupedTables;
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

      // Fetch ungrouped tables
      const ungroupedResponse = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_REQUESTS}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Fetch grouped tables
      const groupedResponse = await fetch(
        `${API_URL}${ENDPOINTS.CHECKER.GET_GROUP_REQUESTS}`,
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
        // Set ungrouped tables
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

        // Set grouped tables
        setGroupedTables(groupedData.data);

        // Fix: Calculate total pending by counting actual requests
        const totalPendingCount = ungroupedData.data.length; // Count actual pending requests

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
  }, [toast]);

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
             Ungroup
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
              Group
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
