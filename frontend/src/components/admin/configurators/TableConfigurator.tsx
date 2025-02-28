import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/label";
import logo from "@/assets/images/select-table.svg";
import { EXCLUDED_TABLES } from "@/config/tableConfig";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface TableMetadata {
  id: string;
  original_table_name: string;
  display_name: string;
  description: string | null;
}

interface TableResponse {
  success: boolean;
  tables: { table_name: string }[];
}

const ITEMS_PER_PAGE = 5;

const TableConfigurator: React.FC = () => {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | null>(
    null
  );
  const [formData, setFormData] = useState({
    original_table_name: "",
    display_name: "",
    description: "",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    tableId: "",
    tableName: "",
  });

  const handleDelete = (table: TableMetadata) => {
    setConfirmDialog({
      isOpen: true,
      tableId: table.id,
      tableName: table.display_name
    });
  };

  const confirmDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:8080/delete-renamed-tables/${id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: `${confirmDialog.tableName} deleted successfully`,
        });
        fetchTables();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to delete table configuration",
        variant: "destructive",
      });
    }
  };

  const totalPages = Math.ceil(tables.length / ITEMS_PER_PAGE);
  const paginatedTables = tables.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    fetchTables();
    fetchAvailableTables();
  }, []);

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/get-renamed-tables", {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setTables(data.data);
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to fetch renamed tables",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableTables = async () => {
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
        const filteredTables = data.tables
          .map((t) => t.table_name)
          .filter((tableName) => !EXCLUDED_TABLES.includes(tableName));
        setAvailableTables(filteredTables);
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to fetch available tables",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = selectedTable
        ? `http://localhost:8080/update-renamed-tables/${selectedTable.id}`
        : "http://localhost:8080/rename-tables";
      const method = selectedTable ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: selectedTable
            ? "Table updated successfully"
            : "Table renamed successfully",
        });
        fetchTables();
        setIsDialogOpen(false);
        resetForm();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Operation failed",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      original_table_name: "",
      display_name: "",
      description: "",
    });
    setSelectedTable(null);
  };

  const handleEdit = (table: TableMetadata) => {
    setSelectedTable(table);
    setFormData({
      original_table_name: table.original_table_name,
      display_name: table.display_name,
      description: table.description || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6 bg-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#0F172A]">
          Table Configuration
        </h2>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Table
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0F172A] border-t-transparent" />
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-12">
          <img src={logo} alt="No tables" className="w-32 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Tables Configured
          </h3>
          <p className="text-gray-500">
            Start by adding a new table configuration
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedTables.map((table) => (
              <div
                key={table.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {table.display_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Original: {table.original_table_name}
                  </p>
                  {table.description && (
                    <p className="text-sm text-gray-600">{table.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(table)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(table)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, tableId: "", tableName: "" })}
        onConfirm={() => {
          confirmDelete(confirmDialog.tableId);
          setConfirmDialog({ isOpen: false, tableId: "", tableName: "" });
        }}
        title="Confirm Deletion"
        description="Are you sure you want to delete this table configuration? This action cannot be undone."
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-semibold text-[#0F172A]">
              {selectedTable ? "Edit Table" : "Add New Table"}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1.5">
              {selectedTable
                ? "Update the display name and description for this table"
                : "Configure a new table display name and description"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {!selectedTable && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Original Table Name
                </Label>
                <select
                  className="w-full rounded-md border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 bg-white text-sm"
                  value={formData.original_table_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      original_table_name: e.target.value,
                    })
                  }
                >
                  <option value="" className="text-gray-500">
                    Select a table
                  </option>
                  {availableTables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Display Name
              </Label>
              <Input
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="Enter display name"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Description
                <span className="text-gray-400 ml-1 font-normal">
                  (Optional)
                </span>
              </Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter description"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex gap-3 justify-end w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F172A]/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0F172A] hover:bg-[#0F172A]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F172A]"
                disabled={
                  !formData.display_name ||
                  (!selectedTable && !formData.original_table_name)
                }
              >
                {selectedTable ? "Update" : "Add"} Table
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableConfigurator;
