import axios, { AxiosError } from "axios";

interface ErrorResponse {
  message?: string;
}

// interface UserActiveResponse {
//   user_id: string;
//   active: boolean;
//   updated_at: string;
// }

interface CellHighlight {
  row_id: string;
  changed_fields: string[];
}

interface HighlightResponse {
  success: boolean;
  data: CellHighlight[];
  message?: string;
  error?: string;
}

const API_BASE_URL = "http://localhost:8080";

export type UserRole = "maker" | "checker" | "admin";

export interface User {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: UserRole;
  isDisabled?: boolean;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export const createUser = async (userData: User) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/signup`,
      {
        email: userData.email,
        // password: userData.password,
        role: userData.role,
        first_name: userData.firstName,
        last_name: userData.lastName,
      },
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to create user"
    );
  }
};

export const getAllUsers = async (searchQuery: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders(),
      params: { searchQuery },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch users"
    );
  }
};

export const updateUser = async (userId: string, userData: Partial<User>) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/users/${userId}`,
      {
        email: userData.email,
        role: userData.role,
        first_name: userData.firstName,
        last_name: userData.lastName,
        password: userData.password,
      },
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to update user"
    );
  }
};

export const toggleUserActive = async (email: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/isactive`,
      { email },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to toggle user status"
    );
  }
};

export const getHighlightedCells = async (
  tableName: string
): Promise<HighlightResponse> => {
  try {
    const response = await axios.post<HighlightResponse>(
      `${API_BASE_URL}/highlight-cells`,
      { tableName },
      {
        headers: getAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error in getHighlightedCells:", error);
    throw error;
  }
};
