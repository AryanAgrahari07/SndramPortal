import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Table, Database, List } from "lucide-react";
import logo from "@/assets/images/select-table.svg";
import { EXCLUDED_TABLES } from "@/config/tableConfig";

interface DropdownOption {
  value: string;
}

interface ColumnDropdownOption {
  columnName: string;
  options: string[];
}

interface DropdownManagerProps {
  tables: string[];
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

interface ColumnMapping {
  original_column_name: string;
  renamed_column_name: string;
}

const DropdownManager: React.FC<DropdownManagerProps> = ({
  tables: initialTables,
}) => {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [newOption, setNewOption] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<string[]>(initialTables);
  const [renamedColumns, setRenamedColumns] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns();
      setSelectedColumn("");
      setOptions([]);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable && selectedColumn) {
      fetchExistingOptions();
    }
  }, [selectedTable, selectedColumn]);

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
        const filteredTables = data.tables
        .map((t: { table_name: string }) => t.table_name)
        .filter((tableName: string) => !EXCLUDED_TABLES.includes(tableName));
      setTables(filteredTables);
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

  const fetchColumns = async () => {
    if (!selectedTable) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/fetchcolumn", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ table_name: selectedTable }),
      });

      const data = (await response.json()) as ColumnResponse;
      if (data.success && data.columns) {
        setColumns(data.columns);
      } else {
        throw new Error(data.message || "Failed to fetch columns");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch columns",
        variant: "destructive",
      });
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingOptions = async () => {
    if (!selectedTable || !selectedColumn) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:8080/fetchColumnDropDown",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            table_name: selectedTable,
            columnName: selectedColumn,
          }),
        }
      );

      const data = await response.json();
      if (data.success && data.data) {
        const existingOptions = data.data.map((opt: string) => ({
          value: opt,
        }));
        setOptions(existingOptions);
        if (existingOptions.length > 0) {
          toast({
            title: "Success",
            description: `Loaded ${existingOptions.length} existing options`,
          });
        }
      } else {
        setOptions([]);
        if (data.message) {
          toast({
            title: "Info",
            description: data.message,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching options:", error);
      toast({
        title: "Error",
        description: "Failed to fetch existing options",
        variant: "destructive",
      });
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOption = () => {
    const trimmedOption = newOption.trim();
    
    // Check if option is empty
    if (!trimmedOption) {
      toast({
        title: "Error",
        description: "Option cannot be empty",
        variant: "destructive",
      });
      return;
    }
  
    // Validate option format using regex
    const validFormat = /^[A-Za-z\s_-]+$/;
    if (!validFormat.test(trimmedOption)) {
      toast({
        title: "Error",
        description: "Option can only contain letters, spaces, underscores, and hyphens",
        variant: "destructive",
      });
      return;
    }
  
    // Check for duplicates
    if (options.some((opt) => opt.value.toLowerCase() === trimmedOption.toLowerCase())) {
      toast({
        title: "Error",
        description: "Option already exists",
        variant: "destructive",
      });
      return;
    }
  
    setOptions([...options, { value: trimmedOption }]);
    setNewOption("");
  };

  const handleRemoveOption = (optionToRemove: string) => {
    setOptions(options.filter((opt) => opt.value !== optionToRemove));
  };

  const handleSaveOptions = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // First, fetch existing options
      const existingOptionsResponse = await fetch(
        "http://localhost:8080/fetchColumnDropDown",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            table_name: selectedTable,
            columnName: selectedColumn,
          }),
        }
      );

      const existingData = await existingOptionsResponse.json();
      let existingTableOptions: ColumnDropdownOption[] = [];

      if (existingData.success && existingData.data) {
        existingTableOptions = existingData.dropdown_options || [];
      }

      // Remove existing options for the current column
      existingTableOptions = existingTableOptions.filter(
        (option) => option.columnName !== selectedColumn
      );

      // Add new options for the current column
      const newColumnOption: ColumnDropdownOption = {
        columnName: selectedColumn,
        options: options.map((opt) => opt.value),
      };

      // Combine existing and new options
      const allOptions = [...existingTableOptions, newColumnOption];

      // Save all options
      const response = await fetch(
        "http://localhost:8080/updateColumnDropDown",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            table_name: selectedTable,
            dropdown_options: allOptions,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Options saved successfully",
        });
        fetchExistingOptions();
      } else {
        throw new Error(data.message || "Failed to save options");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save options",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  
  const fetchRenamed = async (tableName: string) => {
    try {
      const response = await fetch(`http://localhost:8080/renamed/${tableName}`, {
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
    }
  };

  useEffect(() => {
    if (selectedTable) {
      fetchRenamed(selectedTable); // Add this line
    } else {
      setColumns([]);
    }
  }, [selectedTable]);

  const getDisplayName = (columnName: string) => {
    if (!renamedColumns || renamedColumns.length === 0) {
      return columnName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    const mapping = renamedColumns.find(m => m.original_column_name === columnName);
    return mapping?.renamed_column_name || columnName;
  };


  return (
    <div className="space-y-6 p-6 bg-[#F8FAFC]">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center space-x-4 text-[#0F172A] mb-8">
          <Database className="h-6 w-6" />
          <h2 className="text-2xl font-semibold">Dropdown Configuration</h2>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Table Selection Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <Table className="h-5 w-5 text-[#0F172A]" />
              <h3 className="text-lg font-medium text-[#0F172A]">
                Select Table
              </h3>
            </div>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="border-gray-200 bg-white text-[#0F172A] hover:bg-gray-50">
                <SelectValue placeholder="Choose a table" />
              </SelectTrigger>
              <SelectContent
                className="bg-white border-gray-200 max-h-[200px]"
                position="popper"
                sideOffset={4}
              >
                <div className="overflow-y-auto max-h-[200px] custom-scrollbar">
                  {tables.map((table) => (
                    <SelectItem
                      key={table}
                      value={table}
                      className="hover:bg-gray-50"
                    >
                      {table}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <List className="h-5 w-5 text-[#0F172A]" />
              <h3 className="text-lg font-medium text-[#0F172A]">
                Select Column
              </h3>
            </div>
            <Select
              value={selectedColumn}
              onValueChange={setSelectedColumn}
              disabled={!selectedTable || columns.length === 0}
            >
              <SelectTrigger className="border-gray-200 bg-white text-[#0F172A] hover:bg-gray-50">
                <SelectValue placeholder="Choose a column" />
              </SelectTrigger>
              <SelectContent
                className="bg-white border-gray-200 max-h-[200px]"
                position="popper"
                sideOffset={4}
              >
                <div className="overflow-y-auto max-h-[200px] custom-scrollbar">
                  {columns.map((column) => (
                    <SelectItem
                      key={column}
                      value={column}
                      className="hover:bg-gray-50"
                    >
                      {getDisplayName(column)}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Options Management Section */}
        {selectedColumn && !isLoading && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="space-y-6">
              {/* Add Option Input */}
              <div className="flex gap-3">
                <Input
                  placeholder="Add new option"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddOption();
                    }
                  }}
                  className="flex-1 border-gray-200 focus:ring-[#0F172A] focus:border-[#0F172A]"
                />
                <Button
                  onClick={handleAddOption}
                  className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>

              {/* Options Count */}
              {options.length > 0 && (
                <div className="text-sm text-gray-600 font-medium">
                  {options.length} option{options.length !== 1 ? "s" : ""}{" "}
                  available
                </div>
              )}

              {/* Options List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 group"
                  >
                    <span className="text-[#0F172A] font-medium">
                      {option.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOption(option.value)}
                      className="text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  onClick={handleSaveOptions}
                  disabled={isLoading}
                  className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white min-w-[120px]"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedTable && !isLoading && (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <img
              src={logo}
              alt="Select table"
              className="w-32 h-32 mx-auto opacity-50 mb-6"
            />
            <h3 className="text-xl font-medium text-[#0F172A] mb-2">
              No Table Selected
            </h3>
            <p className="text-gray-600">
              Select a table and column to manage dropdown options
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0F172A] border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add styles for custom scrollbar at the end of the file
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
`;

// Add the style tag to the document head
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = scrollbarStyles;
  document.head.appendChild(style);
}

export default DropdownManager;
