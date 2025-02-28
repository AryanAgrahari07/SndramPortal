import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import logo from "@/assets/images/select-table.svg";

interface ColumnConfig {
  column_name: string;
  column_status: "editable" | "non-editable";
  data_type: string;
}

interface TableResponse {
  success: boolean;
  message?: string;
  tables: {
    table_name: string;
  }[];
}

interface ColumnResponse {
  success: boolean;
  message?: string;
  columns: string[];
}

interface ColumnPermissionResponse {
  success: boolean;
  message?: string;
  column_list: {
    column_name: string;
    column_status: "editable" | "non-editable";
  }[];
}

interface ColumnConfiguratorProps {
  tables: string[];
}

const ITEMS_PER_PAGE = 8;

const ColumnConfigurator: React.FC<ColumnConfiguratorProps> = ({
  tables: initialTables,
}) => {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<string[]>(initialTables);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(columns.length / ITEMS_PER_PAGE);

  const getCurrentPageColumns = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return columns.slice(startIndex, endIndex);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadColumnConfig();
      setCurrentPage(1);
    } else {
      setColumns([]);
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/table", {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as TableResponse;
      if (data.success) {
        const tableNames = data.tables.map((table) => table.table_name);
        setTables(tableNames);
      } else {
        throw new Error(data.message || "Failed to fetch tables");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch tables",
        variant: "destructive",
      });
    }
  };

  const loadColumnConfig = async () => {
    if (!selectedTable) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");

      const columnResponse = await fetch("http://localhost:8080/fetchcolumn", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ table_name: selectedTable }),
      });

      const columnData = (await columnResponse.json()) as ColumnResponse;
      if (!columnData.success || !columnData.columns) {
        throw new Error(columnData.message || "Failed to load columns");
      }

      const allColumns = columnData.columns.map((columnName) => ({
        column_name: columnName,
        data_type: "string",
        column_status: "non-editable" as "editable" | "non-editable",
      }));

      const permissionResponse = await fetch(
        "http://localhost:8080/ColumnPermission",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            table_name: selectedTable,
            action: "get",
          }),
        }
      );

      const permissionData =
        (await permissionResponse.json()) as ColumnPermissionResponse;

      if (permissionData.success && permissionData.column_list) {
        const existingStatuses = new Map(
          permissionData.column_list.map((col) => [
            col.column_name,
            col.column_status,
          ])
        );

        allColumns.forEach((col) => {
          const status = existingStatuses.get(col.column_name);
          if (status) {
            col.column_status = status;
          }
        });
      }

      setColumns(allColumns);
    } catch (error) {
      console.error("Error loading column config:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load column configuration",
        variant: "destructive",
      });
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnStatusChange = async (
    columnName: string,
    newStatus: "editable" | "non-editable"
  ) => {
    try {
      const token = localStorage.getItem("token");

      const updatedColumns = columns.map((col) =>
        col.column_name === columnName
          ? { ...col, column_status: newStatus }
          : col
      );

      const response = await fetch("http://localhost:8080/ColumnPermission", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          table_name: selectedTable,
          column_list: updatedColumns.map((col) => ({
            column_name: col.column_name,
            column_status: col.column_status,
          })),
          action: "update",
        }),
      });

      const data = await response.json();
      if (data.success) {
        setColumns(updatedColumns);
        toast({
          title: "Success",
          description: "Column status updated successfully",
        });
      } else {
        throw new Error(data.message || "Failed to update column status");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update column status",
        variant: "destructive",
      });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleReset = () => {
    const resetColumns = columns.map((col) => ({
      ...col,
      column_status: "non-editable" as const,
    }));
    setColumns(resetColumns);
  };

  return (
    <div className="space-y-6 p-6 bg-white">
      <div className="space-y-6">
        <Select value={selectedTable} onValueChange={setSelectedTable}>
          <SelectTrigger className="text-lg font-medium text-gray-900 border-0 p-0 h-auto hover:no-underline focus:ring-0">
            <SelectValue placeholder="Select Table" />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            align="start"
            className="bg-white w-[400px] max-h-[300px] overflow-y-auto"
          >
            {tables.map((table) => (
              <SelectItem key={table} value={table}>
                {table}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTable && !isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getCurrentPageColumns().map((column) => (
                <div
                  key={column.column_name}
                  className="flex items-center justify-between p-4 rounded-lg border border-[#e3f2fd] bg-white"
                >
                  <span className="text-gray-900">{column.column_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {column.column_status === "editable"
                        ? "Editable"
                        : "Non-editable"}
                    </span>
                    <Switch
                      checked={column.column_status === "editable"}
                      onCheckedChange={(checked) =>
                        handleColumnStatusChange(
                          column.column_name,
                          checked ? "editable" : "non-editable"
                        )
                      }
                      className="data-[state=checked]:bg-[#00bfa5]"
                      aria-label={`Toggle edit permission for ${column.column_name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
            <div className="flex justify-end gap-4 mt-6">
              <Button
                variant="outline"
                className="border-[#1a237e] text-[#1a237e] hover:bg-[#1a237e] hover:text-white"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                className="bg-[#1a237e] text-white hover:bg-[#1a237e]/90"
                onClick={() => {
                  const columnsToUpdate = columns.map((col) => ({
                    column_name: col.column_name,
                    column_status: col.column_status,
                  }));
                  handleColumnStatusChange(
                    columnsToUpdate[0].column_name,
                    columnsToUpdate[0].column_status
                  );
                }}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {!selectedTable && !isLoading && (
          <div className="mt-20 text-center space-y-4">
            <img
              src={logo}
              alt="Select table"
              className="w-48 h-48 mx-auto opacity-50"
            />
            <p className="text-gray-500">
              Select the table to toggle between editable and non-editable
              modes.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1a237e] mx-auto"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColumnConfigurator;
