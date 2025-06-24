import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/Badge";
import { CheckerNotificationDrawer } from "./CheckerNotificationDrawer";
import {toast} from "../hooks/use-toast";
import { API_URL } from "@/config/constants";

interface CheckerNotification {
  table_name: string;
  maker: string;
  created_at: string;
  pending_count: number;
}

interface NotificationResponse {
  success: boolean;
  data: CheckerNotification[];
  message?: string;
}

export function CheckerNotificationIcon() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_URL}/checker-notification`, {
          credentials: "include",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          toast({
            title: "Error",
            description: "Failed to fetch notifications",
            className: "bg-[#003B95] text-white border-none",
          });
          throw new Error('Failed to fetch notifications');
        }

        const result = await response.json() as NotificationResponse;
        if (result.success) {
          const total = result.data.reduce((sum, notification) => sum + notification.pending_count, 0);
          setTotalPending(total);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative hover:bg-gray-100"
        onClick={() => setIsDrawerOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {totalPending > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {totalPending}
          </Badge>
        )}
      </Button>
      <CheckerNotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
