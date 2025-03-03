import { API_URL, ENDPOINTS } from "../config/constants";
import axios from "axios";

// API Response Types
export interface PaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Adding a simple cache
const cache = new Map<
  string,
  {
    data: TableDataResponse;
    timestamp: number;
  }
>();

const CACHE_DURATION = 30000;

export interface FilteredTableDataParams extends FetchTableDataParams {
  searchQuery?: string;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  filters?: Record<string, { operator: string; value: string }>;
}

export interface TableDataResponse {
  success: boolean;
  data: Record<string, unknown>[];
  columns: string[];
  dataTypes: Record<string, string>;
  message?: string;
  pagination: PaginationData;
}

export interface EditRowRequest {
  table_name: string;
  row_id: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  table_id: string;
}

export interface EditRowResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface FetchTableDataParams {
  page: number;
  pageSize: number;
}

export interface DropdownConfig {
  columnName: string;
  options: string[];
}

export interface DropdownResponse {
  success: boolean;
  data: DropdownConfig[];
  message?: string;
}

const DEFAULT_PAGINATION: PaginationData = {
  total: 0,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10,
};

const API_BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface RowData {
  [key: string]: unknown;
}

export const fetchTableData = async (
  tableName: string,
  params: FilteredTableDataParams
): Promise<TableDataResponse> => {
  const token = localStorage.getItem("token");

  if (!token) {
    return {
      success: false,
      data: [],
      columns: [],
      dataTypes: {},
      message: "No authentication token found",
      pagination: DEFAULT_PAGINATION,
    };
  }

  // cache key from tableName and params
  const cacheKey = `${tableName}-${JSON.stringify(params)}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const queryParams = new URLSearchParams({
      page: params.page.toString(),
      pageSize: params.pageSize.toString(),
    });

    // Add optional filter parameters
    if (params.searchQuery) {
      queryParams.append("searchQuery", params.searchQuery);
    }
    if (params.sortColumn) {
      queryParams.append("sortColumn", params.sortColumn);
      queryParams.append("sortDirection", params.sortDirection || "asc");
    }
    if (params.filters && Object.keys(params.filters).length > 0) {
      queryParams.append("filters", JSON.stringify(params.filters));
    }

    const response = await fetch(
      `${API_URL}/api/tableData/${tableName}?${queryParams.toString()}`,
      {
        credentials: "include",
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();

    // Cache the result
    cache.set(cacheKey, {
      data: {
        success: true,
        data: data.data,
        columns: data.columns,
        dataTypes: data.dataTypes,
        pagination: data.pagination,
      },
      timestamp: Date.now(),
    });

    if (!response.ok) {
      return {
        success: false,
        data: [],
        columns: [],
        dataTypes: {},
        message: data.message || `Failed to fetch data for table ${tableName}`,
        pagination: DEFAULT_PAGINATION,
      };
    }

    // Transform and validate the response data
    return {
      success: true,
      data: Array.isArray(data.data) ? data.data : [],
      dataTypes: data.dataTypes,
      columns: Array.isArray(data.columns)
        ? data.columns
        : Array.isArray(data.data) && data.data.length > 0
        ? Object.keys(data.data[0])
        : [],
      message: data.message,
      pagination: {
        total: data.pagination?.total ?? 0,
        totalPages:
          data.pagination?.totalPages ??
          Math.ceil((data.pagination?.total ?? 0) / params.pageSize),
        currentPage: data.pagination?.currentPage ?? params.page,
        pageSize: data.pagination?.pageSize ?? params.pageSize,
      },
    };
  } catch (error) {
    console.error("Error fetching table data:", error);
    return {
      success: false,
      data: [],
      columns: [],
      dataTypes: {},
      message:
        error instanceof Error ? error.message : "Failed to fetch table data",
      pagination: DEFAULT_PAGINATION,
    };
  }
};

export const requestRowEdit = async (
  editData: EditRowRequest
): Promise<EditRowResponse> => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No authentication token found");
  }

  try {
    const response = await fetch(`${API_URL}${ENDPOINTS.TABLE.REQUEST_DATA}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to submit edit request");
    }

    return data;
  } catch (error) {
    console.error("Error submitting edit request:", error);
    throw error;
  }
};

export const addTableRow = async (
  tableName: string,
  rowData: RowData
): Promise<ApiResponse<void>> => {
  try {
    const response = await axios.post<ApiResponse<void>>(
      `${API_BASE_URL}/addrow`,
      {
        table_name: tableName,
        row_data: rowData,
      },

      {
        headers: getAuthHeaders(),
        withCredentials: true,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to add row");
    }

    return response.data;
  } catch (error: unknown) {
    console.error("Error adding row:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || "Failed to add row");
    }
    throw new Error("Failed to add row");
  }
};

export const fetchDropdownOptions = async (
  tableName: string
): Promise<DropdownConfig[]> => {
  try {
    const response = await fetch(
      `${API_URL}${ENDPOINTS.TABLE.FETCH_DROPDOWN_OPTIONS}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ table_name: tableName }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch dropdown options");
    }

    if (!data.success || !data.data) {
      return [];
    }

    console.log("Fetched dropdown options:", data.data); // Debug log
    return data.data || [];
  } catch (error) {
    console.error("Error fetching dropdown options:", error);
    throw error;
  }
};
