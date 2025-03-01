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
  dataTypes: Record<string, string>;
}

interface ValidationErrors {
  [key: string]: string;
}

const formatDateForInput = (dateValue: string | null | undefined): string => {
  if (!dateValue) return '';
  
  // Handle both date-only and timestamp formats
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  
  // Format as YYYY-MM-DD
  return date.toISOString().split('T')[0];
};

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
  dataTypes,
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const { toast } = useToast();

  useEffect(() => {
    if (row) {
      const editableData = columns.reduce((acc, column) => {
        if (isColumnEditable(column)) {
          if (dataTypes[column]?.toLowerCase().includes('date')) {
            acc[column] = formatDateForInput(row[column] as string);
          } else {
            acc[column] = row[column] ?? "";
          }
        }
        return acc;
      }, {} as Record<string, unknown>);
      setFormData(editableData);
    } else {
      const newRowData = columns.reduce((acc, column) => {
        if (isColumnEditable(column)) {
          acc[column] = "";
        }
        return acc;
      }, {} as Record<string, unknown>);
      setFormData(newRowData);
    }
    setErrors({});
  }, [row, columns, isColumnEditable, dataTypes]);

  const validateField = (column: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") {
      return "This field cannot be empty";
    }

    const stringValue = String(value).trim();
    
    // Check for special characters/symbols
    const symbolRegex = /[!#$%^&*()+=\[\]{};:'"<>/?\\|`~]/;
    if (symbolRegex.test(stringValue)) {
      return "Special characters are not allowed";
    }

    const dataType = dataTypes[column]?.toLowerCase();
    if (!dataType) return "";

    switch (dataType) {
      case "integer":
        const numValue = Number(stringValue);
        if (isNaN(numValue) || !Number.isInteger(numValue)) {
          return "Must be a valid integer";
        }
        break;

      case "date":
        const dateValue = new Date(stringValue);
        if (isNaN(dateValue.getTime())) {
          return "Must be a valid date (YYYY-MM-DD)";
        }
        break;

      case "uuid":
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(stringValue)) {
          return "Must be a valid UUID";
        }
        break;

      case "numeric":
      case "decimal":
        const numericValue = Number(stringValue);
        if (isNaN(numericValue)) {
          return "Must be a valid number";
        }
        break;

      case "boolean":
        if (!["true", "false", "0", "1"].includes(stringValue.toLowerCase())) {
          return "Must be true or false";
        }
        break;

      case "timestamp":
      case "timestamp without time zone":
      case "timestamp with time zone":
        const timestampValue = new Date(stringValue);
        if (isNaN(timestampValue.getTime())) {
          return "Must be a valid timestamp";
        }
        break;
    }
    return "";
  };

  const handleChange = (column: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [column]: value,
    }));

    // Validate and set error
    const error = validateField(column, value);
    setErrors((prev) => ({
      ...prev,
      [column]: error,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Initialize validation flags
    const newErrors: ValidationErrors = {};
    let hasErrors = false;
    let hasChanges = false;
    let hasAtLeastOneValue = false;

    // First pass: Check for values and validate fields
    Object.entries(formData).forEach(([column, value]) => {
      const stringValue = String(value || "").trim();
      
      if (stringValue !== "") {
        hasAtLeastOneValue = true;
        
        // Validate non-empty fields
        const error = validateField(column, value);
        if (error) {
          newErrors[column] = error;
          hasErrors = true;
        }
      }
    });

    // Second pass: Check for actual changes in edit mode
    if (mode === "edit" && row) {
      hasChanges = false; // Reset hasChanges flag
      Object.entries(formData).forEach(([column, value]) => {
        const stringValue = String(value || "").trim();
        const originalValue = row[column];
        const isDate = dataTypes[column]?.toLowerCase().includes('date');

        if (isDate) {
          const formattedOriginal = formatDateForInput(originalValue as string);
          if (formattedOriginal !== stringValue && stringValue !== "") {
            hasChanges = true;
          }
        } else {
          const originalString = String(originalValue || "").trim();
          if (originalString !== stringValue && stringValue !== "") {
            hasChanges = true;
          }
        }
      });
    }

    setErrors(newErrors);

    // Validation checks
    if (mode === "add" && !hasAtLeastOneValue) {
      toast({
        variant: "destructive",
        title: "No Data Entered",
        description: "Please fill at least one field before adding a row",
      });
      return;
    }

    if (mode === "edit" && !hasChanges) {
      toast({
        variant: "destructive",
        title: "No Changes or Empty request Detected",
        description: "Please make at least one change before saving",
      });
      return;
    }

    if (hasErrors) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please correct the errors before submitting",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "add") {
        // Remove empty fields before submitting
        const nonEmptyData = Object.entries(formData).reduce((acc, [key, value]) => {
          const stringValue = String(value || "").trim();
          if (stringValue !== "") {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, unknown>);

        if (Object.keys(nonEmptyData).length === 0) {
          toast({
            variant: "destructive",
            title: "Empty Data",
            description: "Please fill at least one field with valid data",
          });
          setIsLoading(false);
          return;
        }

        await addTableRow(tableName, nonEmptyData);
        toast({
          variant: "success",
          title: "Success",
          description: "Row added successfully",
        });
      } else {
        // For edit mode, only include changed fields
        const changedData = Object.entries(formData).reduce((acc, [key, value]) => {
          const stringValue = String(value || "").trim();
          const originalValue = row?.[key];
          const isDate = dataTypes[key]?.toLowerCase().includes('date');
          
          if (isDate) {
            const formattedOriginal = formatDateForInput(originalValue as string);
            if (formattedOriginal !== stringValue && stringValue !== "") {
              acc[key] = value;
            }
          } else {
            const originalString = String(originalValue || "").trim();
            if (originalString !== stringValue && stringValue !== "") {
              acc[key] = value;
            }
          }
          return acc;
        }, {} as Record<string, unknown>);

        if (Object.keys(changedData).length === 0) {
          toast({
            variant: "destructive",
            title: "No Changes",
            description: "Please make at least one change before saving",
          });
          setIsLoading(false);
          return;
        }

        const updatedRow = {
          ...row,
          ...changedData,
        };
        onSave(updatedRow);
      }

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

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 space-y-6 sm:px-6">
                  {columns.map((column) => {
                    const normalizedColumn = column.toLowerCase().replace(/_/g, "");
                    const dropdownConfig = dropdownColumns.find(
                      (dc) =>
                        dc.columnName.toLowerCase().replace(/_/g, "") ===
                        normalizedColumn
                    );
                    const isEditable = isColumnEditable(column);
                    const isDateField = dataTypes[column]?.toLowerCase().includes('date');
                    const existingValue = row?.[column]
                      ? isDateField 
                        ? formatDateForInput(row[column] as string)
                        : String(row[column])
                      : "";

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
                            type={isDateField ? "date" : "text"}
                            name={column}
                            id={column}
                            value={String(
                              isEditable
                                ? formData[column] || ""
                                : isDateField
                                  ? formatDateForInput(row?.[column] as string)
                                  : row?.[column] || ""
                            )}
                            onChange={(e) => handleChange(column, e.target.value)}
                            className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                              errors[column]
                                ? "border-red-300"
                                : "border-gray-300"
                            }`}
                            disabled={!isEditable || isLoading}
                          />
                        )}
                        {errors[column] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[column]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

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

export default EditRowDrawer;