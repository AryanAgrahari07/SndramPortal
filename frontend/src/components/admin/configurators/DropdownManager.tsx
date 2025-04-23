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
import { Plus, X, Table, Database, List, Link2 } from "lucide-react";
import logo from "@/assets/images/select-table.svg";
import { EXCLUDED_TABLES } from "@/config/tableConfig";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/label";

interface DropdownOption {
  value: string;
  parent?: string | null;
}

interface ParentChildRelationship {
  parentColumn: string;
  childColumn: string;
}

interface ColumnDropdownOption {
  columnName: string;
  options: string[] | Array<{ value: string; parent?: string | null }>;
  parentColumn?: string;
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
  const [isDependentDropdown, setIsDependentDropdown] =
    useState<boolean>(false);
  const [parentColumn, setParentColumn] = useState<string>("");
  const [parentOptions, setParentOptions] = useState<string[]>([]);
  const [selectedParentOption, setSelectedParentOption] = useState<string>("");
  const [relationships, setRelationships] = useState<ParentChildRelationship[]>(
    []
  );

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns();
      fetchRelationships();
      setSelectedColumn("");
      setOptions([]);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable && selectedColumn) {
      fetchExistingOptions();
    }
  }, [selectedTable, selectedColumn]);

  useEffect(() => {
    if (selectedTable && selectedColumn && isDependentDropdown) {
      const relationship = relationships.find(
        (r) => r.childColumn === selectedColumn
      );
      if (relationship) {
        setParentColumn(relationship.parentColumn);
        fetchParentOptions(relationship.parentColumn);
      }
    }
  }, [selectedColumn, isDependentDropdown, relationships]);

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
      if (data.success) {
        // Check if this is a dependent dropdown
        const columnConfig = data.dropdown_options?.find(
          (config: any) => config.columnName === selectedColumn
        );

        if (columnConfig && columnConfig.parentColumn) {
          setIsDependentDropdown(true);
          setParentColumn(columnConfig.parentColumn);
          fetchParentOptions(columnConfig.parentColumn);

          // For dependent dropdowns, create complex options with parent values
          const complexOptions: DropdownOption[] = [];

          if (Array.isArray(columnConfig.options)) {
            columnConfig.options.forEach((opt: any) => {
              if (typeof opt === "object") {
                // Handle both options with parent values and shared options (without parent)
                complexOptions.push({
                  value: opt.value,
                  parent: opt.parent, // This will be undefined for shared options
                });
              }
            });
          }

          setOptions(complexOptions);

          // Find all unique parent values in the options
          if (complexOptions.length > 0 && parentOptions.length > 0) {
            const uniqueParents = [
              ...new Set(
                complexOptions
                  .filter((opt) => opt.parent) // Only consider options with parents
                  .map((opt) => opt.parent)
              ),
            ];

            if (uniqueParents.length > 0) {
              setSelectedParentOption(uniqueParents[0] || "");
            }
          }
        } else {
          // Regular dropdown - ensure we handle both string array and object array formats
          const existingOptions = Array.isArray(data.data) 
            ? data.data.map((opt: string | { value: string }) => ({
                value: typeof opt === 'string' ? opt : opt.value,
                parent: null // Explicitly set parent as null for non-dependent dropdowns
              }))
            : [];
          setOptions(existingOptions);
        }

        if (data.data && data.data.length > 0) {
          toast({
            title: "Success",
            description: `Loaded ${data.data.length} existing options`,
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

  const fetchRelationships = async () => {
    if (!selectedTable) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:8080/api/dropdowns/${selectedTable}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        // Extract parent-child relationships from the data
        const rels: ParentChildRelationship[] = [];
        data.dropdownOptions.forEach((option: ColumnDropdownOption) => {
          if (option.parentColumn) {
            rels.push({
              parentColumn: option.parentColumn,
              childColumn: option.columnName,
            });
          }
        });
        setRelationships(rels);
      }
    } catch (error) {
      console.error("Error fetching relationships:", error);
    }
  };

  const fetchParentOptions = async (parentCol: string) => {
    if (!selectedTable || !parentCol) return;

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
            columnName: parentCol,
          }),
        }
      );

      const data = await response.json();
      if (data.success && data.data) {
        setParentOptions(data.data);
      } else {
        setParentOptions([]);
      }
    } catch (error) {
      console.error("Error fetching parent options:", error);
      setParentOptions([]);
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
        description:
          "Option can only contain letters, spaces, underscores, and hyphens",
        variant: "destructive",
      });
      return;
    }
  
    if (isDependentDropdown && parentColumn) {
      // For dependent dropdowns, check the current view
      if (selectedParentOption === "__shared__") {
        // Adding shared option
        if (options.some(opt => opt.value.toLowerCase() === trimmedOption.toLowerCase() && opt.parent === null)) {
          toast({
            title: "Error",
            description: "This shared option already exists",
            variant: "destructive",
          });
          return;
        }
        setOptions([...options, { value: trimmedOption, parent: null }]);
      } else if (selectedParentOption && selectedParentOption !== "__all__") {
        // Adding option for specific parent
        if (options.some(
          opt => 
            opt.value.toLowerCase() === trimmedOption.toLowerCase() && 
            opt.parent === selectedParentOption
        )) {
          toast({
            title: "Error",
            description: `Option already exists for parent value "${selectedParentOption}"`,
            variant: "destructive",
          });
          return;
        }
        setOptions([...options, { value: trimmedOption, parent: selectedParentOption }]);
      }
    } else {
      // Regular dropdown handling
      if (options.some(opt => opt.value.toLowerCase() === trimmedOption.toLowerCase())) {
        toast({
          title: "Error",
          description: "Option already exists",
          variant: "destructive",
        });
        return;
      }
      setOptions([...options, { value: trimmedOption, parent: null }]);
    }
  
    setNewOption("");
    
    // Show success message
    toast({
      title: "Success",
      description: isDependentDropdown && selectedParentOption 
        ? `Option added for parent "${selectedParentOption}"`
        : "Option added successfully",
    });
  };




  const handleRemoveOption = (optionToRemove: string, specificParent?: string | null) => {
    if (isDependentDropdown) {
      if (specificParent === null || specificParent === "shared" || specificParent === "__shared__") {
        // Remove shared option (parent is null)
        setOptions(options.filter(opt => 
          !(opt.value === optionToRemove && opt.parent === null)
        ));
      } else if (specificParent) {
        // Remove for a specific parent
        setOptions(options.filter(opt => 
          !(opt.value === optionToRemove && opt.parent === specificParent)
        ));
      } else if (selectedParentOption === "__shared__") {
        // When in shared options view, remove shared option (parent is null)
        setOptions(options.filter(opt => 
          !(opt.value === optionToRemove && opt.parent === null)
        ));
      } else if (selectedParentOption && selectedParentOption !== "__all__") {
        // Remove option for specific parent
        setOptions(options.filter(opt => 
          !(opt.value === optionToRemove && opt.parent === selectedParentOption)
        ));
      }
    } else {
      // For regular dropdowns, just filter by value
      setOptions(options.filter(opt => opt.value !== optionToRemove));
    }
  };

  const handleColumnChange = (value: string) => {
    setSelectedColumn(value);
    setOptions([]);
    setNewOption("");

    // Check if the selected column is a child in any relationship
    const relationship = relationships.find((r) => r.childColumn === value);

    if (relationship) {
      setIsDependentDropdown(true);
      setParentColumn(relationship.parentColumn);
      fetchParentOptions(relationship.parentColumn);
    } else {
      setIsDependentDropdown(false);
      setParentColumn("");
      setParentOptions([]);
      setSelectedParentOption("");
    }
  };

  const handleParentColumnChange = (value: string) => {
    setParentColumn(value);
    setSelectedParentOption("");
    fetchParentOptions(value);
  };

  const handleToggleDependentDropdown = (checked: boolean) => {
    setIsDependentDropdown(checked);
    if (!checked) {
      setParentColumn("");
      setSelectedParentOption("");
      // Convert any existing dependent options to regular options
      setOptions(options.map((opt) => ({ value: opt.value })));
    }
  };

  const handleParentOptionChange = (value: string) => {
    setSelectedParentOption(value);

    if (value === "__all__") {
      // This is a special value to show all options grouped by parent
      toast({
        title: "All Parents View",
        description: "Showing options for all parent values",
      });
      return;
    }

    if (value === "__shared__") {
      // Show only shared options
      toast({
        title: "Shared Options",
        description: "Showing options available for all parent values",
      });
      return;
    }

    // If we already have options for this parent, just filter the view
    const existingOptionsForParent = options.filter(
      (opt) => opt.parent === value || opt.parent === null
    );

    if (existingOptionsForParent.length > 0) {
      toast({
        title: "Info",
        description: `Showing ${existingOptionsForParent.length} options for parent value "${value}"`,
      });
    } else {
      fetchFilteredOptions(value);
    }
  };

  const fetchFilteredOptions = async (parentValue: string) => {
    if (!selectedTable || !selectedColumn || !parentColumn) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:8080/api/dropdowns/${selectedTable}/${selectedColumn}/${parentValue}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        // Create options with the current parent value
        const newOptions = data.options.map((opt: string) => ({
          value: opt,
          parent: parentValue,
        }));

        // Keep existing options that have different parent values
        const existingOptionsForOtherParents = options.filter(
          (opt) => opt.parent && opt.parent !== parentValue
        );

        // Combine both sets of options
        setOptions([...existingOptionsForOtherParents, ...newOptions]);
      } else {
        // Only clear options for the current parent, keep others
        const remainingOptions = options.filter(
          (opt) => opt.parent && opt.parent !== parentValue
        );
        setOptions(remainingOptions);
      }
    } catch (error) {
      console.error("Error fetching filtered options:", error);
      toast({
        title: "Error",
        description: "Failed to fetch options for the selected parent value",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptions = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // First, fetch existing options for the table
      const existingOptionsResponse = await fetch(
        `http://localhost:8080/api/dropdowns/${selectedTable}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const existingData = await existingOptionsResponse.json();
      let existingTableOptions: ColumnDropdownOption[] = existingData.success
        ? existingData.dropdownOptions || []
        : [];

      // Remove existing options for the current column
      existingTableOptions = existingTableOptions.filter(
        (option) => option.columnName !== selectedColumn
      );

      // Prepare options based on whether it's a dependent dropdown or not
      let finalOptions;
      if (isDependentDropdown && parentColumn) {
        // ... existing dependent dropdown handling ...
        const sharedOptions = options
          .filter((opt) => opt.parent === null || opt.parent === "__shared__")
          .map((opt) => ({ value: opt.value, parent: null }));

        const parentSpecificOptions = options
          .filter((opt) => opt.parent && opt.parent !== "__shared__" && opt.parent !== null)
          .filter(
            (opt) => !sharedOptions.some((shared) => shared.value === opt.value)
          );

        finalOptions = [...sharedOptions, ...parentSpecificOptions];
      } else {
        // For non-dependent dropdowns, just use the values
        finalOptions = options.map((opt) => opt.value);
      }

      // Add new options for the current column
      const newColumnOption: ColumnDropdownOption = {
        columnName: selectedColumn,
        options: finalOptions,
      };

      // Add parent column reference if this is a dependent dropdown
      if (isDependentDropdown && parentColumn) {
        newColumnOption.parentColumn = parentColumn;
      }

      // Combine existing and new options
      const allOptions = [...existingTableOptions, newColumnOption];

      // Save all options
      const response = await fetch(
        "http://localhost:8080/api/admin/dropdowns/" + selectedTable,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            dropdown_options: allOptions,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Dropdown configuration saved successfully",
        });

        // Refresh the options
        await fetchExistingOptions();
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
      const response = await fetch(
        `http://localhost:8080/renamed/${tableName}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch renamed table data");
      }

      const data = await response.json();
      if (data.success) {
        setRenamedColumns(data.data);
      }
    } catch (error) {
      console.error("Error fetching renamed columns:", error);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      fetchRenamed(selectedTable);
    } else {
      setColumns([]);
    }
  }, [selectedTable]);

  const getDisplayName = (columnName: string) => {
    if (!renamedColumns || renamedColumns.length === 0) {
      return columnName
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    }

    const mapping = renamedColumns.find(
      (m) => m.original_column_name === columnName
    );
    return mapping?.renamed_column_name || columnName;
  };

  // Update the getOptionsByParent function
  const getOptionsByParent = () => {
    if (!isDependentDropdown) return {};
    const groupedOptions: Record<string, DropdownOption[]> = {};

    // Handle shared options first (parent is null)
    const sharedOptions = options.filter((opt) => opt.parent === null);
    if (sharedOptions.length > 0) {
      groupedOptions["shared"] = sharedOptions;
    }

    // Group parent-specific options
    options.forEach((option) => {
      if (option.parent && option.parent !== null && option.parent !== "__shared__") {
        if (!groupedOptions[option.parent]) {
          groupedOptions[option.parent] = [];
        }
        groupedOptions[option.parent].push(option);
      }
    });

    return groupedOptions;
  };

  // FIX: Also update the handleAddSharedOption function to ensure shared options are properly marked
  const handleAddSharedOption = () => {
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
    // Validate option format
    const validFormat = /^[A-Za-z0-9\s_-]+$/;
    if (!validFormat.test(trimmedOption)) {
      toast({
        title: "Error",
        description:
          "Option can only contain letters, numbers, spaces, underscores, and hyphens",
        variant: "destructive",
      });
      return;
    }
    // Check for duplicates among all options - both shared and parent-specific
    const sharedOptionExists = options.some(
      (opt) =>
        opt.value.toLowerCase() === trimmedOption.toLowerCase() && !opt.parent
    );
    const parentOptionExists = options.some(
      (opt) =>
        opt.value.toLowerCase() === trimmedOption.toLowerCase() && opt.parent
    );
    if (sharedOptionExists) {
      toast({
        title: "Error",
        description: "This shared option already exists",
        variant: "destructive",
      });
      return;
    }
    if (parentOptionExists) {
      // If option exists with a parent, confirm before making it shared
      if (
        window.confirm(
          `"${trimmedOption}" already exists for specific parent(s). Adding as a shared option will make it available for ALL parent values. Continue?`
        )
      ) {
        // User confirmed, continue with adding as shared
      } else {
        return; // User cancelled
      }
    }
    // Add the option with explicitly null parent (this makes it a shared option)
    // Ensure it's explicitly null, not undefined
    setOptions([...options, { value: trimmedOption, parent: null }]);
    setNewOption("");
    toast({
      title: "Success",
      description: "Shared option added - will appear under all parent values",
      variant: "default",
    });
  };


  const getFilteredOptions = (
    options: DropdownOption[],
    selectedParent: string | null
  ) => {
    if (selectedParent === "__all__") {
      // Show all options in the "All" view
      return options;
    }
    if (selectedParent === "__shared__") {
      // When in shared options view, only show options with null parent
      return options.filter((opt) => opt.parent === null);
    }
    if (selectedParent) {
      // When showing parent-specific view, show both parent-specific and shared (null parent) options
      return options.filter(
        (opt) => opt.parent === selectedParent || opt.parent === null
      ).sort((a, b) => {
        // Sort to show parent-specific options first, then shared options
        if ((a.parent === null) === (b.parent === null)) return 0;
        return a.parent === null ? 1 : -1;
      });
    }
    // Default case - show shared options
    return options.filter((opt) => opt.parent === null);
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
              onValueChange={handleColumnChange}
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

        {/* Dependent Dropdown Configuration */}
        {selectedColumn && !isLoading && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-[#0F172A]" />
                <h3 className="text-lg font-medium text-[#0F172A]">
                  Dependent Dropdown
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isDependentDropdown}
                  onCheckedChange={handleToggleDependentDropdown}
                  aria-label="Toggle dependent dropdown"
                />
                <Label htmlFor="dependent-mode">
                  {isDependentDropdown ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>

            {isDependentDropdown && (
              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="parent-column"
                    className="block text-sm font-medium mb-2"
                  >
                    Parent Column
                  </Label>
                  <Select
                    value={parentColumn}
                    onValueChange={handleParentColumnChange}
                    disabled={columns.length === 0 || columns.length === 1}
                  >
                    <SelectTrigger
                      className="border-gray-200 bg-white text-[#0F172A] hover:bg-gray-50"
                      id="parent-column"
                    >
                      <SelectValue placeholder="Select parent column" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-white border-gray-200"
                      position="popper"
                      sideOffset={4}
                    >
                      {columns
                        .filter((col) => col !== selectedColumn)
                        .map((column) => (
                          <SelectItem
                            key={column}
                            value={column}
                            className="hover:bg-gray-50"
                          >
                            {getDisplayName(column)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {parentColumn && (
                  <div>
                    <Label
                      htmlFor="parent-value"
                      className="block text-sm font-medium mb-2"
                    >
                      Parent Value
                    </Label>
                    <Select
                      value={selectedParentOption}
                      onValueChange={handleParentOptionChange}
                      disabled={parentOptions.length === 0}
                    >
                      <SelectTrigger
                        className="border-gray-200 bg-white text-[#0F172A] hover:bg-gray-50"
                        id="parent-value"
                      >
                        <SelectValue placeholder="Select parent value" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-white border-gray-200"
                        position="popper"
                        sideOffset={4}
                      >
                        {/* Add "All" and "Shared" options at the top */}
                        <SelectItem
                          key="__all__"
                          value="__all__"
                          className="hover:bg-gray-50 font-semibold border-b border-gray-100 mb-1 pb-1"
                        >
                          Show All Parent Values
                        </SelectItem>
                        <SelectItem
                          key="__shared__"
                          value="__shared__"
                          className="hover:bg-gray-50 font-semibold border-b border-gray-100 mb-1 pb-1"
                        >
                          Manage Shared Options
                        </SelectItem>
                        {parentOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="hover:bg-gray-50"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parentOptions.length === 0 && (
                      <p className="text-sm text-yellow-600 mt-2">
                        No options available for the parent column. Please
                        configure dropdown options for the parent column first.
                      </p>
                    )}
                  </div>
                )}

                {isDependentDropdown && !parentColumn && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      Please select a parent column to establish the dependent
                      relationship.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Options Management Section */}
        {selectedColumn && !isLoading && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="space-y-6">
              {/* Input for adding options */}
              <div className="flex gap-3">
                <Input
                  placeholder={
                    selectedParentOption === "__all__"
                      ? "Select a specific parent to add options"
                      : "Add new option"
                  }
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      selectedParentOption !== "__all__"
                    ) {
                      isDependentDropdown && !selectedParentOption
                        ? handleAddSharedOption()
                        : handleAddOption();
                    }
                  }}
                  disabled={selectedParentOption === "__all__"}
                  className="flex-1 border-gray-200 focus:ring-[#0F172A] focus:border-[#0F172A]"
                />

                {isDependentDropdown ? (
                  selectedParentOption === "__all__" ? (
                    // Disabled button when "All" is selected
                    <Button disabled className="bg-gray-300 text-gray-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Select Specific Parent
                    </Button>
                  ) : selectedParentOption === "__shared__" ? (
                    // Add shared option
                    <Button
                      onClick={handleAddSharedOption}
                      className="bg-green-700 hover:bg-green-800 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Shared Option
                    </Button>
                  ) : selectedParentOption ? (
                    // Add option for specific parent
                    <Button
                      onClick={handleAddOption}
                      className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add for {selectedParentOption}
                    </Button>
                  ) : (
                    // Default disabled state
                    <Button disabled className="bg-gray-300 text-gray-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Select Parent Value
                    </Button>
                  )
                ) : (
                  // Regular dropdown option
                  <Button
                    onClick={handleAddOption}
                    className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                )}
              </div>

              {/* Instructions and status messages */}
              {isDependentDropdown && (
                <>
                  {selectedParentOption === "__all__" ? (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">
                        Viewing options for all parent values.{" "}
                        <span className="font-bold">
                          Select a specific parent to add options.
                        </span>
                      </p>
                    </div>
                  ) : selectedParentOption ? (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">
                        Adding options for parent value:{" "}
                        <span className="font-bold">
                          {selectedParentOption}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                      <p className="text-sm text-green-700 font-medium">
                        Adding shared options that will appear under{" "}
                        <span className="font-bold">all parent values</span>
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Options Count */}
              {options.length > 0 && (
                <div className="text-sm text-gray-600 font-medium">
                  option{options.length !== 1 ? "s" : ""} available
                  {isDependentDropdown && selectedParentOption && (
                    <span> for parent value "{selectedParentOption}"</span>
                  )}
                </div>
              )}

              {/* Options List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedParentOption === "__all__" ? (
                  // Show all options grouped by parent
                  Object.entries(getOptionsByParent()).map(
                    ([parent, parentOpts]) => (
                      <div key={parent} className="mb-4">
                        <div className="mb-2 px-2 py-1 bg-gray-100 rounded font-medium text-sm">
                          {parent === "__shared__"
                            ? "Shared Options"
                            : `Parent: ${parent}`}
                        </div>
                        <div className="space-y-2 pl-2">
                          {parentOpts.map((option, optIndex) => (
                            <div
                              key={`${parent}-${optIndex}`}
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                parent === "__shared__"
                                  ? "border-green-200 bg-green-50 hover:bg-green-100"
                                  : "border-gray-200 bg-white hover:bg-gray-50"
                              } group`}
                            >
                              <span className="text-[#0F172A] font-medium">
                                {option.value}
                                {parent === "__shared__" && (
                                  <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                    Shared Option
                                  </span>
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveOption(
                                    option.value,
                                    parent === "__shared__" ? null : parent
                                  )
                                }
                                className="text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <>
                    {/* Parent-specific options section */}
                    {getFilteredOptions(options, selectedParentOption).length >
                    0 ? (
                      getFilteredOptions(options, selectedParentOption).map(
                        (option, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-4 rounded-lg border ${
                              option.parent === null
                                ? "border-green-200 bg-green-50 hover:bg-green-100"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            } group`}
                          >
                            <span className="text-[#0F172A] font-medium">
                              {option.value}
                              {option.parent === null && isDependentDropdown ? (
                                <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                  Shared Option
                                </span>
                              ) : null}
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
                        )
                      )
                    ) : (
                      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-center">
                        {selectedParentOption
                          ? `No options available for parent value: ${selectedParentOption}`
                          : "No shared options available"}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  onClick={handleSaveOptions}
                  disabled={isLoading || (isDependentDropdown && !parentColumn)}
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

        {/* Options Summary by Parent */}
        {isDependentDropdown && options.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Options Summary
            </h4>
            <div className="space-y-2">
              {Object.entries(getOptionsByParent()).map(
                ([parent, parentOptions]) => (
                  <div key={parent} className="flex items-center gap-2">
                    {parent === "shared" ? (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                        Shared Options
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                        {parent}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      {parentOptions.length} option
                      {parentOptions.length !== 1 ? "s" : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 text-xs hover:bg-blue-50"
                      onClick={() =>
                        parent === "__shared__"
                          ? setSelectedParentOption("")
                          : setSelectedParentOption(parent)
                      }
                    >
                      View
                    </Button>
                  </div>
                )
              )}
            </div>
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
