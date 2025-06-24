import axios from "axios";
import { RequestDataPayload, RequestDataResponse } from "../types/requestData";
import { API_URL } from "@/config/constants";

const API_BASE_URL = `${API_URL}`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    withCredentials: true, 
  };
};

export const submitRequestData = async (
  payload: RequestDataPayload
): Promise<RequestDataResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/requestdata`, payload, {
      headers: getAuthHeaders(),
      withCredentials: true, 
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const fetchGroupList = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/getgrouplist`, {
      headers: getAuthHeaders(),
      withCredentials: true,
    });

    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || "Failed to fetch group list");
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
  throw error;
};



import { enhancedFetch } from "@/utils/apiInterceptors";

export const api = {
    get: async (url: string) => {
        const response = await enhancedFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
        });
        return response.json();
    },

    post: async (url: string, data: any) => {
        const response = await enhancedFetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    // Add other methods as needed...
};