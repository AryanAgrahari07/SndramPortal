import axios, { AxiosError } from 'axios';
import { config } from "../config/env";

export interface ColumnStatus {
  column_name: string;
  column_status: 'editable' | 'non-editable' | 'readonly';
}

export interface ColumnResponse {
  success: boolean;
  columns?: string[];
  message?: string;
}

export interface StatusResponse {
  success: boolean;
  column_list?: ColumnStatus[];
  message?: string;
}

export interface TableResponse {
  success: boolean;
  tables: { table_name: string }[];
  message?: string;
}

export class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new ApiError('No authentication token found');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new ApiError(
      axiosError.response?.data?.message || axiosError.message,
      axiosError.response?.status
    );
  }
  throw error;
};

export const columnConfigService = {
  async fetchTables(): Promise<TableResponse> {
    try {
      const response = await axios.get<TableResponse>(
        `${config.apiBaseUrl}/table`,
        { headers: getAuthHeaders(), withCredentials: true }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async fetchColumns(tableName: string): Promise<ColumnResponse> {
    try {
      const response = await axios.post<ColumnResponse>(
        `${config.apiBaseUrl}/fetchcolumn`,
        { table_name: tableName },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async getColumnStatus(tableName: string): Promise<StatusResponse> {
    try {
      const response = await axios.post<StatusResponse>(
        `${config.apiBaseUrl}/ColumnPermission`,
        {
          table_name: tableName,
          action: 'get',
        },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async updateColumnStatus(
    tableName: string,
    columns: ColumnStatus[]
  ): Promise<StatusResponse> {
    try {
      const response = await axios.post<StatusResponse>(
        `${config.apiBaseUrl}/ColumnPermission`,
        {
          table_name: tableName,
          column_list: columns,
          action: 'update',
        },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
