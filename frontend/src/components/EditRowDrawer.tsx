import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addTableRow } from "@/services/tableDataService";
import DynamicDropdown from "@/components/ui/DynamicDropdown";
import {
  preventXSS,
} from "@/utils/security";
import { sanitizeInput } from "@/utils/security";
import axios from "axios";
import { API_URL } from "@/config/constants";

interface DropdownConfig {
  columnName: string;
  options: string[] | Array<{value: string, parent?: string | null}>;
  parentColumn?: string;
}

interface DropdownRelationship {
  parentColumn: string;
  childColumn: string;
}

interface ValidationRule {
  allow_numbers: boolean;
  allow_special_chars: boolean;
  allow_spaces: boolean;
  min_length?: number;
  max_length?: number;
  regex_pattern?: string;
  custom_error_message?: string;
  min_value?: number;
  max_value?: number;
  decimal_places?: number;
  min_date?: string;
  max_date?: string;
  allow_weekends?: boolean;
  number_sign?: 'positive' | 'negative' | 'non_negative' | 'non_positive';
  parity?: 'even' | 'odd';
  date_restriction?: 'past' | 'future' | 'today' | 'custom';
  days_from_today?: number;
  case_restriction?: 'uppercase' | 'lowercase';
  days_in_past?: number;
  days_in_future?: number;
}

interface ValidationRules {
  [key: string]: ValidationRule;
}

interface EditRowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row: Record<string, unknown> | null;
  columns: string[];
  renamedColumns: { originalName: string; displayName: string }[];
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
  if (!dateValue) return "";

  // Handle both date-only and timestamp formats
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "";

  // Format as YYYY-MM-DD
  return date.toISOString().split("T")[0];
};

export const EditRowDrawer: React.FC<EditRowDrawerProps> = ({
  isOpen,
  onClose,
  row,
  columns,
  renamedColumns,
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
  const [filteredOptions, setFilteredOptions] = useState<Record<string, string[]>>({});
  const [relationships, setRelationships] = useState<DropdownRelationship[]>([]);
  const { toast } = useToast();
  const [validationRules, setValidationRules] = useState<ValidationRules>({});

  const isPrimaryKey = (column: string): boolean => {
    const expectedPkName = `${tableName}_sk`.toLowerCase();
    return column.toLowerCase() === expectedPkName;
  };

  const getDisplayName = (columnName: string) => {
    if (!renamedColumns) return columnName;
    const mapping = renamedColumns.find(m => m.originalName === columnName);
    // Only return display name if it's different from original name
    return mapping?.displayName !== mapping?.originalName ? mapping?.displayName : columnName;
  };

  useEffect(() => {
    if (row) {
      const editableData = columns.reduce((acc, column) => {
        if (isColumnEditable(column) && !isPrimaryKey(column)) {
          if (dataTypes[column]?.toLowerCase().includes("date")) {
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
        if (isColumnEditable(column) && !isPrimaryKey(column)) {
          acc[column] = "";
        }
        return acc;
      }, {} as Record<string, unknown>);
      setFormData(newRowData);
    }
    setErrors({});
  }, [row, columns, isColumnEditable, dataTypes, tableName]);

  useEffect(() => {
    const rels: DropdownRelationship[] = [];
    dropdownColumns.forEach(config => {
      if (config.parentColumn) {
        rels.push({
          parentColumn: config.parentColumn,
          childColumn: config.columnName
        });
      }
    });
    setRelationships(rels);
  }, [dropdownColumns]);

  const fetchFilteredOptions = async (childColumn: string, parentValue: string) => {
    if (!parentValue) {
      setFilteredOptions(prev => ({
        ...prev,
        [childColumn]: []
      }));
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/dropdowns/${tableName}/${childColumn}/${encodeURIComponent(parentValue)}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setFilteredOptions(prev => ({
          ...prev,
          [childColumn]: data.options || []
        }));
      } else {
        console.error("Failed to fetch filtered options:", data.message);
        setFilteredOptions(prev => ({
          ...prev,
          [childColumn]: []
        }));
      }
    } catch (error) {
      console.error("Error fetching filtered options:", error);
      setFilteredOptions(prev => ({
        ...prev,
        [childColumn]: []
      }));
    }
  };

  useEffect(() => {
    if (row && relationships.length > 0) {
      relationships.forEach(rel => {
        const parentValue = row[rel.parentColumn];
        if (parentValue) {
          fetchFilteredOptions(rel.childColumn, String(parentValue));
        }
      });
    }
  }, [row, relationships, tableName]);

  // Fetch validation rules when component mounts or table changes
  useEffect(() => {
    const fetchValidationRules = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/admin/validations/${tableName}`,
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        if (response.data.success) {
          // Convert array of rules to an object keyed by column_name
          const rules = response.data.data.reduce((acc: ValidationRules, rule: ValidationRule & { column_name: string }) => {
            acc[rule.column_name] = rule;
            return acc;
          }, {});
          setValidationRules(rules);
        }
      } catch (error) {
        console.error("Error fetching validation rules:", error);
      }
    };

    if (tableName) {
      fetchValidationRules();
    }
  }, [tableName]);

  const validateField = (column: string, value: unknown): string => {
    // Allow empty values
    if (value === null || value === undefined || value === "") {
      return "";
    }

    const stringValue = String(value).trim();
    const validationRule = validationRules[column];
    const dataType = dataTypes[column]?.toLowerCase();

    // SQL Injection Prevention
    // const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(['";])/i;
    // if (sqlInjectionPattern.test(stringValue)) {
    //   return "Invalid input: Contains potentially harmful characters or keywords";
    // }

    if (validationRule) {
      // Special characters validation
      if (!validationRule.allow_special_chars) {
        const symbolRegex = /[!@#$%^&*()+=\[\]{};:'"\\|,.<>/?`~\-_]/;
        if (symbolRegex.test(stringValue)) {
          return validationRule.custom_error_message || "Special characters are not allowed in this field";
        }
      }

      // Numbers validation
      if (!validationRule.allow_numbers) {
        const numberRegex = /\d/;
        if (numberRegex.test(stringValue)) {
          return validationRule.custom_error_message || "Numbers are not allowed in this field";
        }
      }

      // Spaces validation
      if (!validationRule.allow_spaces) {
        if (stringValue.includes(' ')) {
          return validationRule.custom_error_message || "Spaces are not allowed in this field";
        }
      }

      // Length validations (only for non-date fields)
      if (!dataType.includes('date') && !dataType.includes('timestamp')) {
        if (validationRule.min_length && stringValue.length < validationRule.min_length) {
          return `Minimum length should be ${validationRule.min_length} characters`;
        }

        if (validationRule.max_length && stringValue.length > validationRule.max_length) {
          return `Maximum length should be ${validationRule.max_length} characters`;
        }
      }

      // Case restriction validation for text fields
      if ((dataType.includes('character varying') || dataType.includes('text')) && validationRule.case_restriction) {
        switch (validationRule.case_restriction) {
          case 'uppercase':
            if (stringValue !== stringValue.toUpperCase()) {
              return "Value must be in uppercase";
            }
            break;
          case 'lowercase':
            if (stringValue !== stringValue.toLowerCase()) {
              return "Value must be in lowercase";
            }
            break;
        }
      }

      // Regex pattern validation
      if (validationRule.regex_pattern) {
        try {
          const regex = new RegExp(validationRule.regex_pattern);
          if (!regex.test(stringValue)) {
            return validationRule.custom_error_message || "Input format is invalid";
          }
        } catch (error) {
          console.error('Invalid regex pattern:', error);
        }
      }
    }

    // Data type validations
    switch (dataType) {
      case "integer":
      case "numeric":
      case "decimal": {
        const numValue = Number(stringValue);
        if (isNaN(numValue)) {
          return "Must be a valid number";
        }

        if (dataType === "integer" && !Number.isInteger(numValue)) {
          return "Must be a valid integer";
        }

        if (validationRule) {
          // Number sign validations
          if (validationRule.number_sign) {
            switch (validationRule.number_sign) {
              case 'positive':
                if (numValue <= 0) {
                  return "Value must be positive (> 0)";
                }
                break;
              case 'negative':
                if (numValue >= 0) {
                  return "Value must be negative (< 0)";
                }
                break;
              case 'non_negative':
                if (numValue < 0) {
                  return "Value must be non-negative (≥ 0)";
                }
                break;
              case 'non_positive':
                if (numValue > 0) {
                  return "Value must be non-positive (≤ 0)";
                }
                break;
            }
          }

          // Parity validations
          if (validationRule.parity && Number.isInteger(numValue)) {
            switch (validationRule.parity) {
              case 'even':
                if (numValue % 2 !== 0) {
                  return "Value must be an even number";
                }
                break;
              case 'odd':
                if (numValue % 2 === 0) {
                  return "Value must be an odd number";
                }
                break;
            }
          }

          if (typeof validationRule.min_value === 'number' && numValue < validationRule.min_value) {
            return `Value must be greater than or equal to ${validationRule.min_value}`;
          }
          if (typeof validationRule.max_value === 'number' && numValue > validationRule.max_value) {
            return `Value must be less than or equal to ${validationRule.max_value}`;
          }
          if (typeof validationRule.decimal_places === 'number') {
            const decimalParts = stringValue.split('.');
            if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
              return `Maximum ${validationRule.decimal_places} decimal places allowed`;
            }
          }
        }
        break;
      }

      case "character varying":
      case "text": {
        // Only apply numeric validations if they are explicitly configured
        if (validationRule) {
          const hasNumericValidations = 
            typeof validationRule.decimal_places === 'number' ||
            typeof validationRule.min_value === 'number' ||
            typeof validationRule.max_value === 'number';

          if (hasNumericValidations) {
            const numValue = Number(stringValue);
            if (isNaN(numValue)) {
              return "Must be a valid number";
            }

            if ( validationRule.min_value !== null && validationRule.min_value !== undefined) {
              if (numValue < validationRule.min_value) {
                return `Value must be greater than or equal to ${validationRule.min_value}`;
              }
            }

            if ( validationRule.max_value !== null && validationRule.max_value !== undefined) {
              if (numValue > validationRule.max_value) {
                return `Value must be less than or equal to ${validationRule.max_value}`;
              }
            }

            if (typeof validationRule.decimal_places === 'number') {
              const decimalParts = stringValue.split('.');
              if (decimalParts[1] && decimalParts[1].length > validationRule.decimal_places) {
                return `Maximum ${validationRule.decimal_places} decimal places allowed`;
              }
            }
          }
        }
        break;
      }

      case "date":
      case "timestamp":
      case "timestamp without time zone":
      case "timestamp with time zone": {
        const dateValue = new Date(stringValue);
        if (isNaN(dateValue.getTime())) {
          return "Must be a valid date";
        }

        if (validationRule) {
          // Date restriction validations
          if (validationRule.date_restriction) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const inputDate = new Date(dateValue);
            inputDate.setHours(0, 0, 0, 0);

            switch (validationRule.date_restriction) {
              case 'past':
                if (inputDate > today) {
                  return "Date must be in the past or today";
                }
                break;

              case 'future':
                if (inputDate < today) {
                  return "Date must be in the future or today";
                }
                break;

              case 'today':
                if (inputDate.getTime() !== today.getTime()) {
                  return "Date must be today";
                }
                break;

              case 'custom': {
                const pastLimit = validationRule.days_in_past;
                const futureLimit = validationRule.days_in_future;

                // Skip validation if both limits are null/undefined
                if (pastLimit === null || pastLimit === undefined) {
                  if (futureLimit === null || futureLimit === undefined) {
                    break; // No restrictions if both are null/undefined
                  }
                }

                // Handle past limit
                if (pastLimit !== null && pastLimit !== undefined) {
                  if (pastLimit === 0) {
                    // Block all past dates
                    if (inputDate < today) {
                      return "Past dates are not allowed";
                    }
                  } else {
                    // Check past limit
                    const pastDate = new Date(today);
                    pastDate.setDate(today.getDate() - pastLimit);
                    pastDate.setHours(0, 0, 0, 0);
                    if (inputDate < pastDate) {
                      return `Date must not be more than ${pastLimit} days in the past`;
                    }
                  }
                }

                // Handle future limit
                if (futureLimit !== null && futureLimit !== undefined) {
                  if (futureLimit === 0) {
                    // Block all future dates
                    if (inputDate > today) {
                      return "Future dates are not allowed";
                    }
                  } else {
                    // Check future limit
                    const futureDate = new Date(today);
                    futureDate.setDate(today.getDate() + futureLimit);
                    futureDate.setHours(0, 0, 0, 0);
                    if (inputDate > futureDate) {
                      return `Date must not be more than ${futureLimit} days in the future`;
                    }
                  }
                }
                break;
              }
            }

            if (validationRule.min_date && dateValue < new Date(validationRule.min_date)) {
              return `Date must be after ${new Date(validationRule.min_date).toLocaleDateString()}`;
            }
            if (validationRule.max_date && dateValue > new Date(validationRule.max_date)) {
              return `Date must be before ${new Date(validationRule.max_date).toLocaleDateString()}`;
            }
            if (validationRule.allow_weekends === false) {
              const day = dateValue.getDay();
              if (day === 0 || day === 6) {
                return "Weekend dates are not allowed";
              }
            }
          }
        }
        break;
      }

      case "uuid": {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(stringValue)) {
          return "Must be a valid UUID";
        }
        break;
      }

      case "boolean": {
        if (!["true", "false", "0", "1"].includes(stringValue.toLowerCase())) {
          return "Must be true or false";
        }
        break;
      }
    }

    return "";
  };

  const handleChange = (column: string, value: string) => {
    const sanitizedValue = preventXSS(sanitizeInput(value));

    setFormData((prev) => ({
      ...prev,
      [column]: sanitizedValue,
    }));

    // Check if this column is a parent for any child columns
    const childColumns = relationships
      .filter(rel => rel.parentColumn === column)
      .map(rel => rel.childColumn);

    // If this column is a parent, fetch filtered options for each child
    if (childColumns.length > 0 && sanitizedValue) {
      childColumns.forEach(childColumn => {
        fetchFilteredOptions(childColumn, sanitizedValue);
        
        // Reset child column value when parent changes
        setFormData(prev => ({
          ...prev,
          [childColumn]: ""
        }));
      });
    }

    // Validate and set error
    const error = validateField(column, sanitizedValue);
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

      // Only validate non-empty fields
      if (stringValue !== "") {
        hasAtLeastOneValue = true;
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
        const isDate = dataTypes[column]?.toLowerCase().includes("date");

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
        const nonEmptyData = Object.entries(formData).reduce(
          (acc, [key, value]) => {
            const stringValue = String(value || "").trim();
            if (stringValue !== "") {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, unknown>
        );

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
        const changedData = Object.entries(formData).reduce(
          (acc, [key, value]) => {
            const stringValue = String(value || "").trim();
            const originalValue = row?.[key];
            const isDate = dataTypes[key]?.toLowerCase().includes("date");

            if (isDate) {
              const formattedOriginal = formatDateForInput(
                originalValue as string
              );
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
          },
          {} as Record<string, unknown>
        );

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
                    const isEditable =
                      isColumnEditable(column) && !isPrimaryKey(column);
                    const isDateField = dataTypes[column]
                      ?.toLowerCase()
                      .includes("date");
                    const existingValue = row?.[column]
                      ? isDateField
                        ? formatDateForInput(row[column] as string)
                        : String(row[column])
                      : "";
                      
                    // Check if this column is a child in a relationship
                    const parentRelationship = relationships.find(rel => rel.childColumn === column);
                    const isChildDropdown = !!parentRelationship;
                    
                    // Get parent value if this is a child dropdown
                    const parentValue = parentRelationship 
                      ? formData[parentRelationship.parentColumn] || row?.[parentRelationship.parentColumn]
                      : null;
                      
                    // Get available options - use filtered options for child dropdowns
                    const availableOptions = isChildDropdown && filteredOptions[column]
                      ? filteredOptions[column]
                      : dropdownConfig?.options || [];
                      
                    // Make sure options are properly formatted for DynamicDropdown
                    const formattedOptions = Array.isArray(availableOptions)
                      ? availableOptions.map(opt => {
                          if (typeof opt === 'string') {
                            return {
                              value: opt,
                              label: opt
                            };
                          } else if (typeof opt === 'object' && opt !== null && 'value' in opt) {
                            return {
                              value: opt.value,
                              label: opt.value
                            };
                          }
                          return {
                            value: String(opt),
                            label: String(opt)
                          };
                        })
                      : [];

                    return (
                      <div key={column}>
                        <label
                          htmlFor={column}
                          className="block text-sm font-medium text-gray-700 capitalize"
                        >
                          {getDisplayName(column)}
                          {isChildDropdown && parentRelationship && (
                            <span className="ml-2 text-xs text-blue-600">
                              (Depends on {getDisplayName(parentRelationship.parentColumn)})
                            </span>
                          )}
                        </label>
                        {dropdownConfig && isEditable ? (
                          <DynamicDropdown
                            value={
                              formData[column] !== undefined
                                ? String(formData[column])
                                : existingValue
                            }
                            onChange={(value) => handleChange(column, value)}
                            placeholder={
                              isChildDropdown && !parentValue 
                                ? `Select ${getDisplayName(parentRelationship.parentColumn)} first`
                                : "Select a value"
                            }
                            className="mt-1"
                            options={[
                              ...(existingValue &&
                              !formattedOptions.some(o => o.value === existingValue)
                                ? [
                                    {
                                      value: existingValue,
                                      label: existingValue,
                                    },
                                  ]
                                : []),
                              ...formattedOptions,
                            ]}
                            disabled={
                              isLoading || 
                              (isChildDropdown && !parentValue) // Disable child dropdown if parent not selected
                            }
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
                            onChange={(e) =>
                              handleChange(column, e.target.value)
                            }
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
                        {isChildDropdown && !parentValue && (
                          <p className="mt-1 text-sm text-amber-600">
                            Select a {getDisplayName(parentRelationship.parentColumn)} first
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