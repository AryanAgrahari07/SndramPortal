import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/Badge";
import { format } from "date-fns";
import { Card, CardContent } from "../components/ui/Card";
import { toast } from "../hooks/use-toast"; // Import toast
import { API_URL } from "@/config/constants";

interface CheckerNotification {
  table_name: string;
  maker: string;
  created_at: string;
  pending_count: number;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationResponse {
  success: boolean;
  data: CheckerNotification[];
  message?: string;
}

export function CheckerNotificationDrawer({
  isOpen,
  onClose,
}: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<CheckerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isOpen) return;

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(
          `${API_URL}/checker-notification`,
          {
            credentials: "include",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          toast({
            title: "Error",
            description: "Failed to fetch notifications",
            className: "bg-[#003B95] text-white border-none",
          });
          throw new Error("Failed to fetch notifications");
        }

        const result = (await response.json()) as NotificationResponse;
        if (result.success) {
          setNotifications(result.data || []);
        } else {
          toast({
            title: "Error",
            description: result.message || "Failed to fetch notifications",
            className: "bg-[#003B95] text-white border-none",
          });
          setError(result.message || "Failed to fetch notifications");
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const renderNotificationContent = (notification: CheckerNotification) => {
    const formattedDate = format(
      new Date(notification.created_at),
      "MMM d, yyyy h:mm a"
    );

    return (
      <Card
        key={`${notification.table_name}-${notification.maker}`}
        className="mb-4 font-poppins border-gray-200"
      >
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-semibold capitalize">
                {notification.table_name.replace(/_/g, " ")}
              </h4>
              <p className="text-sm text-gray-500">{formattedDate}</p>
            </div>
            <Badge
              variant="notification"
              className="bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              {notification.pending_count} pending
            </Badge>
          </div>

          <div className="text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Maker:</span> {notification.maker}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-40 font-poppins">
          <div className="text-gray-500">Loading notifications...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-40 font-poppins">
          <div className="text-red-500">{error}</div>
        </div>
      );
    }

    if (!notifications.length) {
      return (
        <div className="flex items-center justify-center h-40 font-poppins">
          <div className="text-gray-500">No pending changes found</div>
        </div>
      );
    }

    return notifications.map(renderNotificationContent);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="w-[400px] sm:w-[540px] font-poppins bg-white"
        side="right"
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Pending Changes</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {renderContent()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
