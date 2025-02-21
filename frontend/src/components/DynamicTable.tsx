import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { useTableData } from "../hooks/useTableData";
import { useColumnPermissions } from "../hooks/useColumnPermissions";
import { EditRowDrawer } from "./EditRowDrawer";
import {
  requestRowEdit,
  fetchDropdownOptions,
  DropdownConfig,
} from "../services/tableDataService";
import { Pagination } from "./Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  fetchHighlightedCells,
  CellHighlight,
} from "@/services/highlightService";
import HighlightedCell from "./ui/HighlightedCell";

interface ColumnStatus {
  column_name: string;
  column_status: "editable" | "non-editable";
}

interface DynamicTableProps {
  tableName: string;
  pageSize: number;
  onPageSizeChange: (newPageSize: number) => void;
  userRole: "maker" | "checker";
}

interface FilterOption {
  value: string;
  label: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "isEmpty";
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
  tableName,
  pageSize,
  onPageSizeChange,
}) => {
  const filterOptions: FilterOption[] = [
    { value: "equals", label: "Equals", operator: "equals" },
    { value: "contains", label: "Contains", operator: "contains" },
    { value: "startsWith", label: "Starts with", operator: "startsWith" },
    { value: "endsWith", label: "Ends with", operator: "endsWith" },
    { value: "isEmpty", label: "Is empty", operator: "isEmpty" },
  ];

  // states for server-side filtering
  const [filterParams, setFilterParams] = useState({
    searchQuery: "",
    sortColumn: null as string | null,
    sortDirection: "asc" as "asc" | "desc",
    filters: {} as Record<string, { operator: string; value: string }>,
    currentPage: 1,
  });

  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null
  );
  const [selectedRow, setSelectedRow] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownColumns, setDropdownColumns] = useState<DropdownConfig[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
  const { toast } = useToast();
  const [highlightedCells, setHighlightedCells] = useState<CellHighlight[]>([]);

  // Add ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [tempFilters, setTempFilters] = useState<
    Record<string, { operator: string; value: string }>
  >({});

  const {
    data: processedData,
    columns,
    isLoading: isDataLoading,
    error: dataError,
    refresh: refreshData,
    pagination,
    setCurrentPage,
  } = useTableData({ tableName, pageSize, filterParams });

  const {
    isColumnEditable,
    columnStatuses,
    isLoading: isPermissionsLoading,
    error: permissionsError,
  } = useColumnPermissions(tableName);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // search button handler
  const handleSearchClick = () => {
    setFilterParams((prev) => ({
      ...prev,
      searchQuery: searchInput,
      currentPage: 1,
    }));
  };

  // clear search handler
  const handleClearSearch = () => {
    setSearchInput("");
    setFilterParams((prev) => ({
      ...prev,
      searchQuery: "",
      currentPage: 1,
    }));
  };

  // Check if a column has active filters
  const hasActiveFilter = (column: string) => {
    return (
      filterParams.filters[column] && filterParams.filters[column].value !== ""
    );
  };

  const applyFilter = (column: string, operator: string, value: string) => {
    setTempFilters((prev) => ({
      ...prev,
      [column]: { operator, value },
    }));
  };

  // Add apply filter handler
  const handleApplyFilter = (column: string) => {
    setFilterParams((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [column]: tempFilters[column],
      },
      currentPage: 1,
    }));
    setActiveFilterColumn(null);
  };

  // sort handling
  const handleSort = useCallback((column: string) => {
    setFilterParams((prev) => {
      // If clicking a different column, start with ascending sort
      if (prev.sortColumn !== column) {
        return {
          ...prev,
          sortColumn: column,
          sortDirection: "asc",
          currentPage: 1,
        };
      }

      // If clicking the same column, cycle through: asc -> desc -> none -> asc
      if (prev.sortDirection === "asc") {
        return {
          ...prev,
          sortDirection: "desc",
          currentPage: 1,
        };
      } else {
        return {
          ...prev,
          sortColumn: null,
          sortDirection: "asc", // Reset to default
          currentPage: 1,
        };
      }
    });
  }, []);

  // filter click handler
  const handleFilterClick = useCallback(
    (column: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveFilterColumn(activeFilterColumn === column ? null : column);
    },
    [activeFilterColumn]
  );

  const clearFilter = useCallback((column: string) => {
    setFilterParams((prev) => {
      const newFilters = { ...prev.filters };
      delete newFilters[column];
      return {
        ...prev,
        filters: newFilters,
        currentPage: 1,
      };
    });
    setActiveFilterColumn(null);
  }, []);

  // page change handler
  const handlePageChange = useCallback(
    (page: number) => {
      setFilterParams((prev) => ({
        ...prev,
        currentPage: page,
      }));
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  // page size change handler
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      onPageSizeChange(newSize);
      setFilterParams((prev) => ({
        ...prev,
        currentPage: 1,
      }));
    },
    [onPageSizeChange]
  );

  useEffect(() => {
    console.log("FilterParams updated:", filterParams);
  }, [filterParams]);

  // Fetching dropdown columns when table name changes
  useEffect(() => {
    fetchDropdownData();
  }, [tableName]);

  useEffect(() => {
    if (tableName) {
      fetchHighlightedCells(tableName)
        .then((highlights) => setHighlightedCells(highlights))
        .catch(console.error);
    }
  }, [tableName]);

  const fetchDropdownData = async () => {
    try {
      setIsLoadingDropdowns(true);
      const dropdowns = await fetchDropdownOptions(tableName);
      setDropdownColumns(dropdowns.filter((item) => item.options.length > 0));
    } catch (error) {
      console.error("Error fetching dropdown options:", error);
      toast({
        title: "Error",
        description: "Failed to load dropdown options",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDropdowns(false);
    }
  };

  const handleEditClick = (row: Record<string, unknown>) => {
    setSelectedRow(row);
    setIsAddMode(false);
    setIsDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedRow({});
    setIsAddMode(true);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setSelectedRow(null);
    setIsAddMode(false);
    setIsDrawerOpen(false);
    setError(null);
  };

  const handleRowSave = async (updatedRow: Record<string, unknown>) => {
    try {
      setError(null);

      if (!selectedRow) {
        throw new Error("No row selected for editing");
      }

      const editData = {
        table_name: tableName,
        row_id: String(
          selectedRow.id ||
            selectedRow[`${tableName}_sk`] ||
            selectedRow[`${tableName}_id`]
        ),
        old_values: selectedRow,
        new_values: updatedRow,
        table_id: tableName,
      };

      const response = await requestRowEdit(editData);

      if (response.success) {
        handleDrawerClose();
        refreshData();
        toast({
          title: "Success",
          description: isAddMode
            ? "Row added successfully"
            : "Changes requested successfully",
        });

        // Refresh highlighted cells after edit
        const highlights = await fetchHighlightedCells(tableName);
        setHighlightedCells(highlights);
      } else {
        setError(response.message || "Failed to submit edit request");
      }
    } catch (err) {
      console.error("Error saving row:", err);
      setError(err instanceof Error ? err.message : "Failed to save changes");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes",
      });
    }
  };

  // Function to determine column background color
  const getColumnStyle = (column: string) => {
    if (
      !columnStatuses.some(
        (status: ColumnStatus) => status.column_name === column
      )
    ) {
      return "bg-[#e3f2fd]"; // Light blue for columns not in API response
    }
    if (!isColumnEditable(column)) {
      return "bg-[#e8eaf6]"; // Indigo 50 for non-editable columns
    }
    return "bg-white"; // Default background for editable columns
  };

  const renderCell = (
    value: unknown,
    row: Record<string, unknown>,
    columnName: string
  ) => {
    const rowId = String(
      row.id || row[`${tableName}_sk`] || row[`${tableName}_id`] || "undefined"
    );

    const isHighlighted = highlightedCells.some(
      (highlight) =>
        highlight.row_id === rowId &&
        highlight.changed_fields.includes(columnName)
    );

    return (
      <HighlightedCell
        value={String(value ?? "")}
        isHighlighted={isHighlighted}
      />
    );
  };

  if (isDataLoading || isPermissionsLoading || isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00bfa5]"></div>
      </div>
    );
  }

  if (dataError || permissionsError) {
    return (
      <div className="text-red-600 p-4 text-center bg-red-50 rounded-lg">
        {dataError || permissionsError}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      {error && (
        <div className="m-4 p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>
      )}
      <div className="flex flex-col flex-1 bg-white rounded-lg border border-[#e3f2fd] overflow-hidden">
        {/* Search and Filter Controls */}
        <div className="relative flex items-center w-full mb-4">
          {/* Search and Filter Toggle Row */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search in all columns..."
              value={searchInput}
              onChange={handleSearch}
              className="w-full pl-10 pr-[5.5rem] py-2.5 border border-[#e3f2fd] rounded-lg focus:outline-none focus:border-[#00bfa5] focus:ring-1 focus:ring-[#00bfa5]/10 text-sm"
            />
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            <button
              onClick={handleSearchClick}
              disabled={!searchInput.trim()}
              className={`mr-1 px-3 py-1 rounded-md text-sm font-medium transition-colors
          ${
            searchInput.trim()
              ? "bg-[#00bfa5] text-white hover:bg-[#00bfa5]/90"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
            >
              Search
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-[#e3f2fd] scrollbar-track-transparent min-h-[300px]">
          <table className="w-full border-collapse min-w-max">
            {/* Fixed header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#f8fafc] border-b border-[#e3f2fd]">
                <th className="sticky left-0 z-20 bg-[#f8fafc] px-4 py-3 text-left text-sm font-medium text-[#1a237e] w-[80px]">
                  Action
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className={`px-6 py-3 text-left text-sm font-medium text-[#1a237e] ${getColumnStyle(
                      column
                    )}`}
                  >
                    <div className="flex items-center gap-2 cursor-pointer group whitespace-nowrap relative">
                      <div
                        className="flex items-center gap-2 cursor-pointer group whitespace-nowrap"
                        onClick={() => handleSort(column)}
                      >
                        {column}

                        <div
                          className={` flex flex-col gap-0 ml-1.5 
                            ${
                              filterParams.sortColumn === column ||
                              filterParams.sortDirection === null
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            } transition-opacity
                          `}
                        >
                          <div
                            className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                              ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "asc"
                                  ? "bg-[#00bfa5] p-0.5" // Active ascending background
                                  : ""
                              }`}
                          >
                            <ChevronUp
                              className={`h-2.5 w-2.5 ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "asc"
                                  ? "text-white stroke-[2.5]" // Active ascending icon
                                  : filterParams.sortDirection === null
                                  ? "text-gray-400 group-hover:text-[#00bfa5]"
                                  : "text-gray-400 group-hover:text-[#00bfa5]/70"
                              }`}
                            />
                          </div>

                          <div
                            className={`transition-all duration-200 rounded h-3.5 w-3.5 flex items-center justify-center
                              ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "desc"
                                  ? "bg-[#00bfa5] p-0.5" // Active descending background
                                  : ""
                              }`}
                          >
                            <ChevronDown
                              className={`h-2.5 w-2.5 ${
                                filterParams.sortColumn === column &&
                                filterParams.sortDirection === "desc"
                                  ? "text-white stroke-[2.5]" // Active descending icon
                                  : filterParams.sortDirection === null
                                  ? "text-gray-400 group-hover:text-[#00bfa5]"
                                  : "text-gray-400 group-hover:text-[#00bfa5]/70"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Filter icon */}
                      <button
                        className={`filter-icon p-1.5 rounded transition-colors flex items-center justify-center
                        ${
                          hasActiveFilter(column)
                            ? "bg-[#00bfa5] text-white hover:bg-[#00bfa5]/90"
                            : "text-gray-400 hover:bg-[#e3f2fd] hover:text-[#00bfa5]"
                        }
                        ${
                          activeFilterColumn === column
                            ? "bg-[#00bfa5] text-white"
                            : ""
                        }`}
                        onClick={(e) => handleFilterClick(column, e)}
                      >
                        <Filter className="w-4 h-4" />
                      </button>

                      {/* Filter dropdown */}
                      {activeFilterColumn === column && (
                        <div className="filter-dropdown absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-[#e3f2fd] z-50">
                          <div className="p-4">
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Filter Type
                              </label>
                              <select
                                className="w-full p-2 border border-[#e3f2fd] rounded-md shadow-sm focus:border-[#00bfa5] focus:ring-1 focus:ring-[#00bfa5] focus:outline-none"
                                value={
                                  tempFilters[column]?.operator || "contains"
                                }
                                onChange={(e) => {
                                  const newOperator = e.target.value;
                                  setTempFilters((prev) => ({
                                    ...prev,
                                    [column]: {
                                      operator: newOperator,
                                      value:
                                        newOperator === "isEmpty"
                                          ? ""
                                          : prev[column]?.value || "",
                                    },
                                  }));
                                }}
                              >
                                {filterOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {(!tempFilters[column]?.operator ||
                              tempFilters[column]?.operator !== "isEmpty") && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Filter Value
                                </label>
                                <input
                                  type="text"
                                  className="w-full p-2 border border-[#e3f2fd] rounded-md shadow-sm focus:border-[#00bfa5] focus:ring-1 focus:ring-[#00bfa5] focus:outline-none"
                                  placeholder="Enter value..."
                                  value={tempFilters[column]?.value || ""}
                                  onChange={(e) => {
                                    applyFilter(
                                      column,
                                      tempFilters[column]?.operator ||
                                        "contains",
                                      e.target.value
                                    );
                                  }}
                                />
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#e3f2fd]">
                              <button
                                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                onClick={() => {
                                  clearFilter(column);
                                  setTempFilters((prev) => {
                                    const newFilters = { ...prev };
                                    delete newFilters[column];
                                    return newFilters;
                                  });
                                }}
                              >
                                Clear
                              </button>
                              <button
                                className="px-4 py-2 text-sm font-medium text-white bg-[#00bfa5] hover:bg-[#00bfa5]/90 rounded-md transition-colors"
                                onClick={() => handleApplyFilter(column)}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="divide-y divide-[#e3f2fd]">
              {processedData.length > 0 ? (
                processedData.map((row, index) => (
                  <tr
                    key={index}
                    className="hover:bg-[#f8fafc] transition-colors even:bg-gray-50"
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 w-[80px]">
                      <button
                        className="p-1.5 hover:bg-[#e3f2fd] rounded-lg transition-colors"
                        onClick={() => handleEditClick(row)}
                      >
                        <svg
                          className="w-5 h-5 text-[#00bfa5]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={`${row.id}_${column}`}
                        className={`px-4 py-2 ${getColumnStyle(column)}`}
                      >
                        {renderCell(row[column], row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="h-[200px]">
                  <td colSpan={columns.length + 1} className="align-top pt-10">
                    <div className="flex flex-col items-start ml-[35vw] text-gray-500">
                      <p
                        className="text-lg font-medium"
                        style={{ color: "black" }}
                      >
                        No matching records found
                      </p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination and Page Size Selector - Bottom */}
        {pagination.totalPages > 0 && (
          <div className="border-t border-[#e3f2fd] bg-white py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#1a237e] font-medium">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-[#e3f2fd] text-sm text-[#1a237e] focus:outline-none focus:border-[#00bfa5]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <Pagination
                currentPage={filterParams.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Row Button */}
      {
        <button
          onClick={handleAddClick}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[#00bfa5] text-white rounded-full shadow-lg hover:bg-[#00bfa5]/90 transition-colors flex items-center justify-center z-30"
          aria-label="Add new row"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      }

      {/* Edit Drawer */}
      <EditRowDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        row={selectedRow}
        columns={columns}
        onSave={handleRowSave}
        mode={isAddMode ? "add" : "edit"}
        isColumnEditable={isColumnEditable}
        tableName={tableName}
        dropdownColumns={dropdownColumns}
      />
    </div>
  );
};
