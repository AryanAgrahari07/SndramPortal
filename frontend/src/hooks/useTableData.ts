import { useState, useEffect, useCallback } from "react";
import {
  fetchTableData,
  PaginationData,
  FilteredTableDataParams,
} from "../services/tableDataService";

interface UseTableDataProps {
  tableName: string;
  pageSize: number;
  filterParams: {
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: "asc" | "desc";
    filters: Record<string, { operator: string; value: string }>;
    currentPage: number;
  };
}

interface renamedColumns {
  originalName: string;
  displayName: string;
}

export interface UseTableDataReturn {
  data: Record<string, unknown>[];
  columns: string[];
  originalColumns: string[];
  renamedColumns: renamedColumns[];
  dataTypes: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pagination: PaginationData;
  setCurrentPage: (page: number) => void;
}

export const useTableData = ({
  tableName,
  pageSize,
  filterParams,
}: UseTableDataProps): UseTableDataReturn => {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [originalColumns, setOriginalColumns] = useState<string[]>([]);
  const [renamedColumns, setRenamedColumns] = useState<renamedColumns[]>([]);
  const [dataTypes, setDataTypes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize,
  });

  const fetchDataFromApi = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: FilteredTableDataParams = {
        page: pagination.currentPage,
        pageSize,
        ...(filterParams && {
          searchQuery: filterParams.searchQuery,
          sortColumn: filterParams.sortColumn,
          sortDirection: filterParams.sortDirection,
          filters: filterParams.filters,
        }),
      };

      const response = await fetchTableData(tableName, params);

      if (response.success) {
        setData(response.data);
        setColumns(response.columns);
        setOriginalColumns(response.originalColumns);
        setRenamedColumns(response.renamedColumns);
        setDataTypes(response.dataTypes);
        setPagination(response.pagination);
      } else {
        setError(response.message || "Failed to fetch table data");
        // Reset data but keep current pagination settings
        setData([]);
        setColumns([]);
        setOriginalColumns([]);
        setRenamedColumns([]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      // Reset data but keep current pagination settings
      setData([]);
      setColumns([]);
      setOriginalColumns([]);
      setRenamedColumns([]);
    } finally {
      setIsLoading(false);
    }
  }, [tableName, pagination.currentPage, pageSize, filterParams]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchDataFromApi();
  }, [fetchDataFromApi]);

  // Handle page changes
  const setCurrentPage = useCallback((page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages)),
    }));
  }, []);

  // Reset to first page when table name or page size changes
  useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      pageSize,
    }));
  }, [tableName, pageSize]);

  return {
    data,
    columns,
    originalColumns,
    renamedColumns,
    dataTypes,
    isLoading,
    error,
    refresh: fetchDataFromApi,
    pagination,
    setCurrentPage,
  };
};
