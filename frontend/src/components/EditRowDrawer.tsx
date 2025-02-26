import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addTableRow, DropdownConfig } from "@/services/tableDataService";
import DynamicDropdown from "@/components/ui/DynamicDropdown";

interface EditRowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row: Record<string, unknown> | null;
  columns: string[];
  onSave: (updatedRow: Record<string, unknown>) => void;
  mode: "edit" | "add";
  isColumnEditable: (column: string) => boolean;
  tableName: string;
  dropdownColumns: DropdownConfig[];
}

export const EditRowDrawer: React.FC<EditRowDrawerProps> = ({
  isOpen,
  onClose,
  row,
  columns,
  onSave,
  mode,
  isColumnEditable,
  tableName,
  dropdownColumns,
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (row) {
      // Only including editable columns in form data
      const editableData = columns.reduce((acc, column) => {
        if (isColumnEditable(column)) {
          acc[column] = row[column] || "";
        }
        return acc;
      }, {} as Record<string, unknown>);
      setFormData(editableData);
    } else {
      // For new rows, including all editable columns
      const newRowData = columns.reduce((acc, column) => {
        if (isColumnEditable(column)) {
          acc[column] = "";
        }
        return acc;
      }, {} as Record<string, unknown>);
      setFormData(newRowData);
    }
  }, [row, columns, isColumnEditable]);

  const handleChange = (column: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "add") {
        await addTableRow(tableName, formData);
        toast({
          variant: "success",
          title: "Success",
          description: "Row added successfully",
        });
      } else {
        // Preserve non-editable values from original row
        const updatedRow = {
          ...row,
          ...formData,
        };
        onSave(updatedRow);
      }

      toast({
            title: "Changes Saved",
                description: "Your changes have been saved successfully.",
               // Assuming your toast system supports variants
         });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Failed to process request",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 overflow-hidden z-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="relative w-96">
            <div className="h-full flex flex-col bg-white shadow-xl">
              {/* Header */}
              <div className="px-4 py-6 bg-gray-50 sm:px-6">
                <div className="flex items-start justify-between space-x-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-medium text-gray-900">
                      {mode === "edit" ? "Edit Row" : "Add Row"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Only editable fields can be changed
                    </p>
                  </div>
                  <div className="h-7 flex items-center">
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-500"
                      disabled={isLoading}
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 space-y-6 sm:px-6">
                  {columns.map((column) => {

                    // Converting column names to a consistent format for comparison
                    const normalizedColumn = column
                      .toLowerCase()
                      .replace(/_/g, "");
                    const dropdownConfig = dropdownColumns.find(
                      (dc) =>
                        dc.columnName.toLowerCase().replace(/_/g, "") ===
                        normalizedColumn
                    );

                    const isEditable = isColumnEditable(column);
                    const existingValue = row?.[column]
                      ? String(row[column])
                      : "";

                    // console.log(
                    //   "Column:",
                    //   column,
                    //   "Normalized:",
                    //   normalizedColumn,
                    //   "Available dropdowns:",
                    //   dropdownColumns.map((dc) => dc.columnName)
                    // );                                                 // Debug log

                    return (
                      <div key={column}>
                        <label
                          htmlFor={column}
                          className="block text-sm font-medium text-gray-700 capitalize"
                        >
                          {column.split("_").join(" ")}
                        </label>
                        {dropdownConfig && isEditable ? (
                          <DynamicDropdown
                            value={
                              formData[column] !== undefined
                                ? String(formData[column])
                                : existingValue
                            }
                            onChange={(value) => handleChange(column, value)}
                            placeholder="Select a value"
                            className="mt-1"
                            options={[
                              // Including existing value at the top if it exists and isn't in options
                              ...(existingValue &&
                              !dropdownConfig.options.includes(existingValue)
                                ? [
                                    {
                                      value: existingValue,
                                      label: existingValue,
                                    },
                                  ]
                                : []),
                              ...dropdownConfig.options.map((opt) => ({
                                value: opt,
                                label: opt,
                              })),
                            ]}
                            disabled={isLoading}
                          />
                        ) : (
                          <input
                            type="text"
                            name={column}
                            id={column}
                            value={String(
                              isEditable
                                ? formData[column] || ""
                                : row?.[column] || ""
                            )}
                            onChange={(e) =>
                              handleChange(column, e.target.value)
                            }
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            disabled={!isEditable || isLoading} // Disable if not editable
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 py-4 flex justify-end border-t border-gray-200">
                  <button
                    type="button"
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ml-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {mode === "add" ? "Adding..." : "Saving..."}
                      </>
                    ) : mode === "add" ? (
                      "Add Row"
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
