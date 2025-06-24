import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  notificationService,
  type Notification,
} from "@/services/notificationService";
import { Badge } from "./ui/Badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_URL } from "@/config/constants";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  role: "maker" | "checker" | "admin";
}

interface ColumnMapping {
  original_column_name: string;
  renamed_column_name: string;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  role,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedNotifications, setExpandedNotifications] = useState<
    Record<string, boolean>
  >({});
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "rejected">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const userRole = role;
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [renamedColumns, setRenamedColumns] = useState<ColumnMapping[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);


  const handleClose = async () => {
    if (userRole === "admin") {
      return;
    }

    // Gathering unread notification IDs
    const unreadIds = notifications
      .filter((n) => (role === "maker" ? !n.makerseen : !n.checkerseen))
      .map((n) => n.request_id);

    // Marking unread notifications as seen
    if (unreadIds.length > 0) {
      const success = await notificationService.markNotificationsAsSeen(
        userRole,
        unreadIds
      );
      if (!success) {
        toast({
          title: "Error",
          description: "Failed to mark notifications as seen",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      handleClose();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.fetchNotifications(userRole);
      setNotifications(data);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const fetchRenamed = async (tableName: string) => {
    try {
      setIsLoadingColumns(true);
      const response = await fetch(`${API_URL}/renamed/${tableName}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch renamed table data');
      }
      
      const data = await response.json();
      if (data.success) {
        setRenamedColumns(data.data);
      }
    } catch (error) {
      console.error('Error fetching renamed columns:', error);
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const getDisplayName = (columnName: string) => {
    if (isLoadingColumns) {
      return "Loading...";
    }
    
    if (!renamedColumns || renamedColumns.length === 0) {
      return columnName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    const mapping = renamedColumns.find(m => m.original_column_name === columnName);
    return mapping?.renamed_column_name || columnName;
  };


  const handleNotificationClick = (notification: Notification) => {
    if (userRole === "checker") {
      navigate(`/checker/table/${notification.table_name}`);
    } else if (userRole === "maker") {
      if (notification.old_data && notification.new_data) {
        // setSelectedNotification(notification);
        // setShowChangesDialog(true);
      }
    } else if (userRole === "admin") {
      navigate(`/admin?tab=rowRequests&table=${notification.table_name}`);
    }
    onClose();
  };

  const filteredNotifications = React.useMemo(() => {
    let filtered = notifications;

    // Apply date filtering only for approved and rejected tabs
    if (
      (activeTab === "approved" || activeTab === "rejected") &&
      (startDate || endDate)
    ) {
      filtered = filtered.filter((notification) => {
        const notificationDate = new Date(notification.updated_at);

        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          return notificationDate >= start && notificationDate <= end;
        }

        if (startDate) {
          const start = new Date(startDate);
          return notificationDate >= start;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return notificationDate <= end;
        }

        return true;
      });
    }

    if (userRole === "checker") {
      // For checker role, filtering to show only unread notifications
      return filtered.filter(
        (n) => n.status.toLowerCase() === "pending" && !n.checkerseen
      );
    } else if (activeTab === "all") {
      return filtered.filter((n) =>
        userRole === "maker" ? !n.makerseen : true
      );
    }
    return filtered.filter((n) => n.status.toLowerCase() === activeTab);
  }, [notifications, activeTab, userRole, startDate, endDate]);

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const getNotificationCounts = () => {
    if (userRole === "admin") {
      // For admin, just return the total count of notifications
      return {
        all: 0, // no count of notifications for admin
        approved: 0, // Admin doesn't need approved/rejected counts
        rejected: 0,
      };
    }

    const approved = notifications.filter(
      (n) => n.status.toLowerCase() === "approved"
    ).length;
    const rejected = notifications.filter(
      (n) => n.status.toLowerCase() === "rejected"
    ).length;
    const unread = notifications.filter((n) =>
      userRole === "maker" ? !n.makerseen : !n.checkerseen
    ).length;

    return {
      all: unread,
      approved,
      rejected,
    };
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        icon: <CheckCircle2 className="w-3 h-3" />,
        className: "bg-green-100 text-green-800",
      },
      rejected: {
        icon: <XCircle className="w-3 h-3" />,
        className: "bg-red-100 text-red-800",
      },
      pending: {
        icon: <Clock className="w-3 h-3" />,
        className: "bg-amber-100 text-amber-800",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge
        variant="notification"
        className={`${config.className} flex items-center gap-1`}
      >
        {config.icon}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const renderChanges = (
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    type: "change" | "add_row"
  ) => {
    if (type === "add_row") {
      return (
        <div className="mt-3 border-t pt-2">
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">Row Data</h4>
            {Object.entries(newData).map(([key, value]) => (
              <div key={key} className="mb-2">
                <span className="text-xs text-gray-600 block">{getDisplayName(key)}:</span>
                <span className="text-sm text-gray-900">
                  {value === null || value === undefined ? "-" : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Getting only the changed fields
    const changedFields = Object.keys(newData).filter((key) => {
      // Skip if both values are empty/null/undefined
      if (
        (oldData[key] === null ||
          oldData[key] === undefined ||
          oldData[key] === "") &&
        (newData[key] === null ||
          newData[key] === undefined ||
          newData[key] === "")
      ) {
        return false;
      }

      // Skip if values are the same
      if (JSON.stringify(oldData[key]) === JSON.stringify(newData[key])) {
        return false;
      }

      return true;
    });

    if (changedFields.length === 0) return null;

    return (
      <div className="mt-3 border-t pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">
              Previous Value
            </h4>
            {changedFields.map((key) => (
              <div key={key} className="mb-2">
                <span className="text-xs text-gray-600 block">{getDisplayName(key)}:</span>
                <span className="text-sm text-gray-900">
                  {oldData[key] === null || oldData[key] === undefined
                    ? "-"
                    : String(oldData[key])}
                </span>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">
              New Value
            </h4>
            {changedFields.map((key) => (
              <div key={key} className="mb-2">
                <span className="text-xs text-gray-600 block">{getDisplayName(key)}:</span>
                <span className="text-sm text-gray-900">
                  {newData[key] === null || newData[key] === undefined
                    ? "-"
                    : String(newData[key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };


  useEffect(() => {
    if (notifications[0]?.table_name) {
      fetchRenamed(notifications[0].table_name);
    } else {
      setRenamedColumns([]);
    }
  }, [notifications]); 

  const toggleChanges = async (notificationId: string) => {

    const notification = notifications.find(n => n.request_id === notificationId);
    if (notification) {
      // Fetch renamed columns for this notification's table
      await fetchRenamed(notification.table_name);
    }

    setExpandedNotifications((prev) => ({
      ...prev,
      [notificationId]: !prev[notificationId],
    }));
  };

  const renderMakerNotification = (notification: Notification) => {
    const status = notification.status.toLowerCase();
    const showChanges = expandedNotifications[notification.request_id];

    return (
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              {getStatusBadge(notification.status)}
              <p className="text-[#6B7280] text-xs mt-1">
                {new Date(notification.updated_at).toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-[#111827] text-sm font-medium">
              Update in{" "}
              {notification.table_name.toLowerCase().replace(/_/g, " ")}
            </h3>
            <p className="text-[#6B7280] text-xs mt-0.5">
              {status === "rejected" ? "Rejector" : "Approver"}:{" "}
              {notification.approver_email}
            </p>
          </div>

          {/* Add Comment Section */}
          {status === "rejected" && notification.comments && (
            <div className="mt-3 border-l border-red-200 bg-gray-50/80 pl-3 pr-2 py-2 rounded-sm">
              <div className="flex items-start gap-2.5">
                <XCircle className="h-3.5 w-3.5 text-red-400/80 mt-1 flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      Rejection Comment
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(notification.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    {notification.comments}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleChanges(notification.request_id);
              }}
              className="text-[#2563EB] hover:text-blue-700 text-sm font-medium"
            >
              {showChanges ? "Hide Changes" : "View Changes"}
            </button>
          </div>

          {showChanges &&
            notification.type && // Make sure type exists
            ((notification.type === "add_row" && notification.data) || // For add_row
              (notification.type === "change" &&
                notification.old_data &&
                notification.new_data)) && // For change_tracker
            renderChanges(
              notification.old_data || {},
              notification.type === "add_row"
                ? notification.data!
                : notification.new_data!,
              notification.type
            )}
        </div>
      </div>
    );
  };

  const renderCheckerOrAdminNotification = (notification: Notification) => {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900 capitalize">
                {notification.table_name.toLowerCase().replace(/_/g, " ")}
              </h3>
              <Badge
                variant="notification"
                className="bg-amber-100 text-amber-800"
              >
                {notification.pending_count} Pending
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-600">Maker:</span>
              <span className="text-xs font-medium text-gray-800">
                {notification.maker_email}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {new Date(notification.updated_at).toLocaleString()}
              </span>
              {role === "checker" && (
                <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Review Changes →
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationContent = (notification: Notification) => {
    return role === "maker"
      ? renderMakerNotification(notification)
      : renderCheckerOrAdminNotification(notification);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-md bg-white">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Notifications</SheetTitle>
            {role === "maker" && (
              <div className="space-y-4">
                <Tabs
                  defaultValue="all"
                  value={activeTab}
                  onValueChange={(value) => {
                    setActiveTab(value as typeof activeTab);
                    if (value === "all") {
                      clearDateFilters();
                    }
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3 p-1 bg-gray-100 rounded-lg">
                    <TabsTrigger
                      value="all"
                      className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Unread ({getNotificationCounts().all})
                    </TabsTrigger>
                    <TabsTrigger
                      value="approved"
                      className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Approved ({getNotificationCounts().approved})
                    </TabsTrigger>
                    <TabsTrigger
                      value="rejected"
                      className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Rejected ({getNotificationCounts().rejected})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Date filters for approved and rejected tabs */}
                {(activeTab === "approved" || activeTab === "rejected") && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1">
                        <label className="block text-gray-600 text-xs mb-1">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-2 py-1 border rounded-md text-sm"
                          max={endDate || undefined}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-gray-600 text-xs mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-2 py-1 border rounded-md text-sm"
                          min={startDate || undefined}
                        />
                      </div>
                      {(startDate || endDate) && (
                        <button
                        onClick={clearDateFilters}
                        className="flex items-center px-2.5 py-1.5 mt-6 text-xs font-medium rounded-md 
                          bg-blue-50 text-blue-600 hover:bg-blue-100 
                          transition-colors duration-200 border border-blue-200"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> 
                        Clear 
                      </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SheetHeader>

          <div className="mt-4">
            <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1A237E]" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No notifications available
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((notification, index) => (
                    <div
                      key={notification.request_id || index}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {renderNotificationContent(notification)}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
