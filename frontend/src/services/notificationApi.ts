import axios from "axios";
import { getAuthHeaders } from "@/utils/authHeaders";
import { API_URL } from "@/config/constants";

const API_BASE_URL = API_URL;

interface NotificationResponse {
  success: boolean;
  notifications?: Notification[];
  data?: AdminNotificationData[];
  message?: string;
}

interface Notification {
  type: "change" | "add_row";
  table_name: string;
  status: string;
  updated_at: string;
  data?: Record<string, unknown>;
  comments: string | null;
  request_id: string;
  maker?: string;
  pending_count?: number;
}

interface AdminNotificationData {
  table_name: string;
  maker: string;
  created_at: string;
  pending_count: number;
}

export const fetchNotifications = async (
  role: "checker" | "maker" | "admin"
): Promise<NotificationResponse> => {
  try {
    let endpoint;
    switch (role) {
      case "admin":
        endpoint = "/admin-notification";
        break;
      case "maker":
        endpoint = "/maker-notification";
        break;
      case "checker":
        endpoint = "/checker-notification";
        break;
      default:
        throw new Error("Invalid role");
    }

    const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
      headers: getAuthHeaders(),
    });

    if (response.data.success) {
      if (role === "admin" && response.data.data) {
        const transformedNotifications = response.data.data.map(
          (item: AdminNotificationData) => ({
            type: "change" as const,
            table_name: item.table_name,
            status: "pending",
            updated_at: item.created_at,
            comments: `${item.pending_count} pending changes`,
            request_id: `${item.table_name}-${item.maker}`,
            maker: item.maker,
            pending_count: item.pending_count,
          })
        );
        return {
          success: true,
          notifications: transformedNotifications,
        };
      }
      return response.data;
    }

    throw new Error(response.data.message || "Failed to fetch notifications");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
};
