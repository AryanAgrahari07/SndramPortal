import { API_URL, ENDPOINTS } from "../config/constants";

export interface Notification {
  id?: string;
  request_id: string;
  type: "change" | "add_row";
  table_name: string;
  status: string;
  approver: string;
  updated_at: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  data?: Record<string, unknown>;
  comments?: string;
  isAdminNotification?: boolean;
  maker?: string;
  pending_count?: number;
  maker_email?: string;
  approver_email?: string;
  makerseen?: boolean;
  checkerseen?: boolean;
}

interface AdminNotification {
  table_name: string;
  maker: string;
  created_at: string;
  pending_count: number;
}

interface CheckerNotification {
  request_id: string;
  table_name: string;
  maker: string;
  created_at: string;
  pending_count: number;
  checkerseen: boolean;
  status: string;
}

interface NotificationResponse {
  success: boolean;
  notifications?: Notification[];
  data?: CheckerNotification[] | AdminNotification[];
  message?: string;
}

const NOTIFICATION_ENDPOINTS = {
  ADMIN: "/admin-notification",
  MAKER: "/maker-notification",
  CHECKER: "/checker-notification",
} as const;

export const notificationService = {
  async markNotificationsAsSeen(
    role: "maker" | "checker" | "admin",
    requestIds: string[]
  ): Promise<boolean> {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No authentication token found");
      return false;
    }

    try {
      // console.log(requestIds);
      // console.log(role);

      const response = await fetch(`${API_URL}/mark-notifications-seen`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role, requestIds }),
      });

      if (!response.ok) throw new Error("Failed to mark notifications as seen");

      return true;
    } catch (error) {
      console.error("Error marking notifications as seen:", error);
      return false;
    }
  },

  async markAllAsRead(role: "maker" | "checker"): Promise<boolean> {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No authentication token found");
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/mark-notifications-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) throw new Error("Failed to mark notifications as read");

      return true;
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return false;
    }
  },

  async getUserEmails(userIds: string[]): Promise<Record<string, string>> {
    const token = localStorage.getItem("token");
    if (!token || !userIds.length) return {};

    try {
      const response = await fetch(`${API_URL}/users/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds: [...new Set(userIds)] }), // Remove duplicates
      });

      if (!response.ok) throw new Error("Failed to fetch user emails");
      const data = await response.json();
      return data.emails || {};
    } catch (error) {
      console.error("Error fetching user emails:", error);
      return {};
    }
  },

  async fetchNotifications(
    role: "maker" | "checker" | "admin"
  ): Promise<Notification[]> {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No authentication token found");
      return [];
    }

    try {
      const endpoint =
        NOTIFICATION_ENDPOINTS[
          role.toUpperCase() as keyof typeof NOTIFICATION_ENDPOINTS
        ];

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const responseData: NotificationResponse = await response.json();

      // console.log(responseData);
      if (!responseData.success) {
        throw new Error(
          responseData.message || "Failed to fetch notifications"
        );
      }

      // Transform checker notifications
      if (
        role === "checker" &&
        (responseData.notifications || responseData.data)
      ) {
        const checkerData = (responseData.notifications ||
          responseData.data) as CheckerNotification[];

        const userIds = checkerData.map((n) => n.maker).filter(Boolean);
        const emailMap = await this.getUserEmails(userIds);

        return checkerData.map((checkerNotif) => ({
          request_id: checkerNotif.request_id,
          type: "change",
          table_name: checkerNotif.table_name,
          status: "pending",
          maker: checkerNotif.maker,
          maker_email: emailMap[checkerNotif.maker],
          updated_at: checkerNotif.created_at,
          created_at: checkerNotif.created_at,
          pending_count: 1,
          approver: "",
          checkerseen: checkerNotif.checkerseen || false,
        }));
      }

      // Handle admin notifications
      if (role === "admin" && responseData.data) {
        const adminData = responseData.data as AdminNotification[];
        const userIds = adminData.map((n) => n.maker).filter(Boolean);
        const emailMap = await this.getUserEmails(userIds);

        // Transform admin notifications to match the expected format
        return responseData.data.map((adminNotif) => ({
          id: `${adminNotif.table_name}-${adminNotif.maker}`,
          request_id: `${adminNotif.table_name}-${adminNotif.maker}`,
          type: "change",
          table_name: adminNotif.table_name,
          status: "pending",
          approver: "",
          updated_at: adminNotif.created_at,
          comments: `${adminNotif.pending_count} pending changes`,
          isAdminNotification: true,
          maker: adminNotif.maker,
          maker_email: emailMap[adminNotif.maker],
          pending_count: adminNotif.pending_count,
        }));
      }

      // Handle maker notifications
      if (responseData.notifications) {
        const notifications = responseData.notifications;
        const userIds = [
          ...new Set(
            notifications.flatMap((n) => [n.maker, n.approver]).filter(Boolean)
          ),
        ] as string[];

        const emailMap = await this.getUserEmails(userIds);

        return notifications.map((notif) => ({
          ...notif,
          checkerseen: notif.checkerseen,
          makerseen: notif.makerseen,
          maker_email: notif.maker ? emailMap[notif.maker] : undefined,
          approver_email: notif.approver ? emailMap[notif.approver] : undefined,
        }));
      }

      return responseData.notifications || [];
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No authentication token found");
      return false;
    }

    try {
      // Skip if it's an admin notification (these don't need to be marked as read)
      if (notificationId.includes("-")) {
        return true;
      }

      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  },
};

export const fetchCheckerNotifications = async (): Promise<Notification[]> => {
  const response = await fetch(ENDPOINTS.NOTIFICATIONS.CHECKER, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch notifications");
  }

  return data.data;
};
