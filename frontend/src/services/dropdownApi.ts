import axios from "axios";
import { API_URL, ENDPOINTS } from "../config/constants";

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

interface DropdownOption {
  value: string;
  label: string;
}

export const fetchDropdownOptions = async (
  tableName: string,
  columnName: string
): Promise<DropdownOption[]> => {
  try {
    const response = await axios.post<ApiResponse<string[]>>(
      `${API_URL}${ENDPOINTS.TABLE.FETCH_DROPDOWN_OPTIONS}`,
      {
        table_name: tableName,
        column_name: columnName,
      },
      {
        headers: getAuthHeaders(),
        withCredentials: true,
      }
    );

    if (!response.data.success) {
      throw new Error(
        response.data.message || "Failed to fetch dropdown options"
      );
    }

    return (response.data.data || []).map((option) => ({
      value: option,
      label: option,
    }));
  } catch (error) {
    console.error("Error fetching dropdown options:", error);
    throw error;
  }
};
