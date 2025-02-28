import { useState, useEffect } from "react";
import { config } from "../config/env";

interface ColumnStatus {
  column_name: string;
  column_status: "editable" | "non-editable";
}

interface ColumnPermissions {
  [key: string]: boolean;
}

export const useColumnPermissions = (tableName: string) => {
  const [columnPermissions, setColumnPermissions] = useState<ColumnPermissions>(
    {}
  );
  const [columnStatuses, setColumnStatuses] = useState<ColumnStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchColumnPermissions = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("No authentication token found");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${config.apiBaseUrl}/fetchColumnStatus`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ table_name: tableName }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch column permissions");
        }

        const data = await response.json();

        if (data.success) {
          // Handle both array and empty object responses
          const permissions: ColumnPermissions = {};

          // If data.data is an array, process it
          if (Array.isArray(data.data)) {
            setColumnStatuses(data.data);
            data.data.forEach((column: ColumnStatus) => {
              permissions[column.column_name] =
                column.column_status === "editable";
            });
          }
          // If data.data is empty object or any other format, all columns will be non-editable
          setColumnPermissions(permissions);
        } else {
          setError(data.message || "Failed to fetch column permissions");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (tableName) {
      fetchColumnPermissions();
    }
  }, [tableName]);

  const isColumnEditable = (columnName: string): boolean => {
    // If the column is not in permissions, treat it as non-editable
    return columnPermissions[columnName] ?? false;
  };

  const getEditableColumns = (): string[] => {
    // Return only the column names that are editable
    return Object.entries(columnPermissions)
      .filter(([, isEditable]) => isEditable)
      .map(([columnName]) => columnName);
  };

  return {
    columnPermissions,
    columnStatuses,
    isLoading,
    error,
    isColumnEditable,
    getEditableColumns,
  };
};
