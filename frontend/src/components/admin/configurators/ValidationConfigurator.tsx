import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import axios from "axios";
import { EXCLUDED_TABLES } from "@/config/tableConfig";

interface ValidationRule {
  validation_id: string;
  table_name: string;
  column_name: string;
  data_type: string;
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
  allow_weekends: boolean;
  is_active: boolean;
  date_restriction?: 'past' | 'future' | 'today' | 'custom';
  days_in_past?: number;
  days_in_future?: number;
  case_restriction?: 'uppercase' | 'lowercase';
  number_sign?: 'positive' | 'negative' | 'non_negative' | 'non_positive';
  parity?: 'even' | 'odd';
}

interface Column {
  name: string;
  type: string;
}

const ValidationConfigurator: React.FC = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [validationRule, setValidationRule] = useState<ValidationRule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // const [showDecimalConfig, setShowDecimalConfig] = useState(false);
  // const [showMinMaxConfig, setShowMinMaxConfig] = useState(false);
  const { toast } = useToast();

  // Fetch tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await axios.get("http://localhost:8080/table", {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (response.data.success) {
            // Filter out excluded tables
            const tableNames = response.data.tables
            .map((t: any) => t.table_name)
            .filter((tableName: string) => !EXCLUDED_TABLES.includes(tableName));
            setTables(tableNames);
        }
      } catch (error) {
        console.error("Error fetching tables:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch tables",
        });
      }
    };
    fetchTables();
  }, []);

  // Fetch columns when table is selected
  useEffect(() => {
    const fetchColumns = async () => {
      if (!selectedTable) return;
      try {
        const response = await axios.post(
          "http://localhost:8080/fetchcolumnwithdatatype",
          { table_name: selectedTable },
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        if (response.data.success) {
          // Filter out columns that match tableName_sk pattern
          const columnData = response.data.columns
            .filter((col: Column) => {
              const expectedPkName = `${selectedTable}_sk`.toLowerCase();
              return col.name.toLowerCase() !== expectedPkName;
            })
            .map((col: Column) => ({
              name: col.name,
              type: col.type
            }));
          setColumns(columnData);
        }
      } catch (error) {
        console.error("Error fetching columns:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch columns",
        });
      }
    };
    fetchColumns();
  }, [selectedTable]);

  // Fetch validation rule when column is selected
  useEffect(() => {
    const fetchValidationRule = async () => {
      if (!selectedTable || !selectedColumn) return;
      setIsLoading(true);
      try {
        const response = await axios.get(
          `http://localhost:8080/admin/validations/${selectedTable}/${selectedColumn}`,
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        if (response.data.success) {
          setValidationRule({
            ...response.data.data,
            allow_weekends: response.data.data.allow_weekends ?? true
          });
        }
      } catch (error) {
        console.error("Error fetching validation rule:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch validation rule",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchValidationRule();
  }, [selectedTable, selectedColumn]);

  const handleSave = async () => {
    if (!selectedTable || !selectedColumn || !validationRule) return;
    setIsLoading(true);
    try {
      // Clean up undefined values to prevent backend issues
      const cleanValidationRule = Object.fromEntries(
        Object.entries(validationRule).filter(([_, value]) => value !== undefined)
      );

      const response = await axios.post(
        "http://localhost:8080/admin/validations/rules",
        {
          ...cleanValidationRule,
          table_name: selectedTable,
          column_name: selectedColumn,
          is_active: true, // Ensure is_active is always set
        },
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Validation rule saved successfully",
        });
      }
    } catch (error: any) {
      console.error("Error saving validation rule:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to save validation rule",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getColumnDataType = () => {
    const column = columns.find(col => col.name === selectedColumn);
    return column?.type || "";
  };

  const renderValidationPreview = () => {
    if (!validationRule) return null;

    const rules: string[] = [];

    // Basic validations
    if (!validationRule.allow_numbers) rules.push("Numbers are not allowed");
    if (!validationRule.allow_special_chars) rules.push("Special characters are not allowed");
    if (!validationRule.allow_spaces) rules.push("Spaces are not allowed");

    // Length validations
    if (validationRule.min_length) rules.push(`Minimum length: ${validationRule.min_length} characters`);
    if (validationRule.max_length) rules.push(`Maximum length: ${validationRule.max_length} characters`);

    // Numeric validations
    if (validationRule.min_value !== undefined) rules.push(`Minimum value: ${validationRule.min_value}`);
    if (validationRule.max_value !== undefined) rules.push(`Maximum value: ${validationRule.max_value}`);
    if (validationRule.decimal_places !== undefined) rules.push(`Decimal places: ${validationRule.decimal_places}`);

    // Date validations
    if (validationRule.min_date) rules.push(`Minimum date: ${validationRule.min_date}`);
    if (validationRule.max_date) rules.push(`Maximum date: ${validationRule.max_date}`);
    if (!validationRule.allow_weekends) rules.push("Weekends not allowed");

    // Pattern validation
    if (validationRule.regex_pattern) rules.push(`Pattern: ${validationRule.regex_pattern}`);

    if (rules.length === 0) return null;

    return (
      <Alert className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-2">Current Validation Rules:</div>
          <ul className="list-disc list-inside space-y-1">
            {rules.map((rule, index) => (
              <li key={`rule-${index}`} className="text-sm">{rule}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Validation Configuration</CardTitle>
        <CardDescription>
          Configure validation rules for table columns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Table Selection */}
          <div className="space-y-2">
            <Label>Select Table</Label>
            <Select
              value={selectedTable}
              onValueChange={(value) => {
                setSelectedTable(value);
                setSelectedColumn("");
                setValidationRule(null);
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                {tables.map((table) => (
                  <SelectItem key={`table-${table}`} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          {selectedTable && (
            <div className="space-y-2">
              <Label>Select Column</Label>
              <Select
                value={selectedColumn}
                onValueChange={(value) => {
                  setSelectedColumn(value);
                  setValidationRule(null);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select a column"/>
                </SelectTrigger>
                <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                  {columns.map((column) => (
                    <SelectItem key={`column-${column.name}`} value={column.name}>
                      {column.name} ({column.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Validation Configuration */}
          {selectedColumn && validationRule && (
            <div className="space-y-4 pt-4">
              <div className="space-y-4">
                {/* Basic Validations - Only show for character varying and text fields */}
                {(getColumnDataType().includes('character varying') || getColumnDataType().includes('text')) && (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={validationRule.allow_numbers}
                        onCheckedChange={(checked) =>
                          setValidationRule({
                            ...validationRule,
                            allow_numbers: checked,
                          })
                        }
                        aria-label="Allow numbers toggle"
                      />
                      <Label>Allow Numbers</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={validationRule.allow_special_chars}
                        onCheckedChange={(checked) =>
                          setValidationRule({
                            ...validationRule,
                            allow_special_chars: checked,
                          })
                        }
                        aria-label="Allow special characters toggle"
                      />
                      <Label>Allow Special Characters</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={validationRule.allow_spaces}
                        onCheckedChange={(checked) =>
                          setValidationRule({
                            ...validationRule,
                            allow_spaces: checked,
                          })
                        }
                        aria-label="Allow spaces toggle"
                      />
                      <Label>Allow Spaces</Label>
                    </div>
                  </div>
                )}

                {/* Date Validations */}
                {(getColumnDataType().includes('date') || getColumnDataType().includes('timestamp')) && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">Date Validations</h3>
                    
                    {/* Date Restrictions */}
                    <div className="space-y-2">
                      <Label>Date Restriction</Label>
                      <Select
                        value={validationRule.date_restriction || "none"}
                        onValueChange={(value) => {
                          setValidationRule({
                            ...validationRule,
                            date_restriction: value as 'past' | 'future' | 'today' | 'custom',
                            days_in_past: value === 'custom' ? validationRule.days_in_past : undefined,
                            days_in_future: value === 'custom' ? validationRule.days_in_future : undefined
                          });
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select date restriction" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">No restriction</SelectItem>
                          <SelectItem value="past">Past dates (including today)</SelectItem>
                          <SelectItem value="future">Future dates (including today)</SelectItem>
                          <SelectItem value="today">Today only</SelectItem>
                          <SelectItem value="custom">Custom days range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Days Range - Only show when date_restriction is 'custom' */}
                    {validationRule.date_restriction === 'custom' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Days in Past (from today)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={validationRule.days_in_past ?? ""}
                            onChange={(e) =>
                              setValidationRule({
                                ...validationRule,
                                days_in_past: e.target.value === "" ? undefined : parseInt(e.target.value),
                              })
                            }
                            placeholder="Enter number of days in past"
                          />
                          <p className="text-sm text-muted-foreground">
                            Leave empty for no past restriction, 0 to block past dates
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Days in Future (from today)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={validationRule.days_in_future ?? ""}
                            onChange={(e) =>
                              setValidationRule({
                                ...validationRule,
                                days_in_future: e.target.value === "" ? undefined : parseInt(e.target.value),
                              })
                            }
                            placeholder="Enter number of days in future"
                          />
                          <p className="text-sm text-muted-foreground">
                            Leave empty for no future restriction, 0 to block future dates
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Absolute Date Range */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-medium">Absolute Date Range (Optional)</h3>
                      <div className="space-y-2">
                        <Label>Minimum Date</Label>
                        <Input
                          type="date"
                          value={validationRule.min_date || ""}
                          onChange={(e) =>
                            setValidationRule({
                              ...validationRule,
                              min_date: e.target.value || undefined,
                            })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Set a fixed minimum date (independent of relative days)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Maximum Date</Label>
                        <Input
                          type="date"
                          value={validationRule.max_date || ""}
                          onChange={(e) =>
                            setValidationRule({
                              ...validationRule,
                              max_date: e.target.value || undefined,
                            })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Set a fixed maximum date (independent of relative days)
                        </p>
                      </div>
                    </div>

                    {/* Weekend Restriction */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={validationRule.allow_weekends}
                        onCheckedChange={(checked) =>
                          setValidationRule({
                            ...validationRule,
                            allow_weekends: checked,
                          })
                        }
                        aria-label="Allow weekends toggle"
                      />
                      <Label>Allow Weekends</Label>
                    </div>
                  </div>
                )}

                {/* Length Validations - Only show for character varying and text fields */}
                {(getColumnDataType().includes('character varying') || getColumnDataType().includes('text')) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Length</Label>
                      <Input
                        type="number"
                        value={validationRule.min_length || ""}
                        onChange={(e) =>
                          setValidationRule({
                            ...validationRule,
                            min_length: parseInt(e.target.value) || undefined,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Length</Label>
                      <Input
                        type="number"
                        value={validationRule.max_length || ""}
                        onChange={(e) =>
                          setValidationRule({
                            ...validationRule,
                            max_length: parseInt(e.target.value) || undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Numeric Validations */}
                {(getColumnDataType().includes('int') || 
                  getColumnDataType().includes('numeric') || 
                  getColumnDataType().includes('character varying') || 
                  getColumnDataType().includes('text')) && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">Numeric Validations</h3>
                    
                    {/* Decimal Places Configuration - Only for non-integer fields */}
                    {!getColumnDataType().includes('int') && (
                      <div className="space-y-2">
                        <Label>Decimal Places</Label>
                        <Input
                          type="number"
                          min="0"
                          value={validationRule?.decimal_places ?? ""}
                          onChange={(e) =>
                            setValidationRule({
                              ...validationRule,
                              decimal_places: e.target.value === "" ? undefined : parseInt(e.target.value)
                            })
                          }
                          placeholder="Enter number of decimal places allowed"
                        />
                        <p className="text-sm text-muted-foreground">
                          Set the number of decimal places allowed (leave empty for no restriction)
                        </p>
                      </div>
                    )}

                    {/* Min/Max Value Configuration */}
                    <div className="space-y-2">
                      <Label>Value Range</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Minimum Value</Label>
                          <Input
                            type="number"
                            step={!getColumnDataType().includes('int') ? "any" : "1"}
                            value={validationRule?.min_value ?? ""}
                            onChange={(e) =>
                              setValidationRule({
                                ...validationRule,
                                min_value: e.target.value === "" ? undefined : 
                                  !getColumnDataType().includes('int') 
                                    ? parseFloat(e.target.value) 
                                    : parseInt(e.target.value)
                              })
                            }
                            placeholder="Enter minimum value"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Maximum Value</Label>
                          <Input
                            type="number"
                            step={!getColumnDataType().includes('int') ? "any" : "1"}
                            value={validationRule?.max_value ?? ""}
                            onChange={(e) =>
                              setValidationRule({
                                ...validationRule,
                                max_value: e.target.value === "" ? undefined :
                                  !getColumnDataType().includes('int')
                                    ? parseFloat(e.target.value)
                                    : parseInt(e.target.value)
                              })
                            }
                            placeholder="Enter maximum value"
                          />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Set the allowed value range (leave empty for no restrictions)
                      </p>
                    </div>
                    
                    {/* Predefined Patterns - Only for numeric/integer fields */}
                    {(getColumnDataType().includes('int') || getColumnDataType().includes('numeric')) && (
                      <div className="space-y-2">
                        <Label>Predefined Pattern</Label>
                        <Select
                          value={validationRule.regex_pattern || "none"}
                          onValueChange={(value) =>
                            setValidationRule({
                              ...validationRule,
                              regex_pattern: value === "none" ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select pattern" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="none">No pattern</SelectItem>
                            <SelectItem value="^[0-9]{10}$">Phone Number (10 digits)</SelectItem>
                            <SelectItem value="^[0-9]{6}$">PIN Code (6 digits)</SelectItem>
                            {!getColumnDataType().includes('int') && (
                              <SelectItem value="^-?\d*\.?\d+$">Decimal Number</SelectItem>
                            )}
                            <SelectItem value="^-?\d+$">Integer Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Sign Restrictions - Only for numeric/integer fields */}
                    {(getColumnDataType().includes('int') || getColumnDataType().includes('numeric')) && (
                      <div className="space-y-2">
                        <Label>Sign Restriction</Label>
                        <Select
                          value={validationRule.number_sign || "none"}
                          onValueChange={(value) =>
                            setValidationRule({
                              ...validationRule,
                              number_sign: value as 'positive' | 'negative' | 'non_negative' | 'non_positive',
                            })
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select sign restriction" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="none">No restriction</SelectItem>
                            <SelectItem value="positive">Positive only</SelectItem>
                            <SelectItem value="negative">Negative only</SelectItem>
                            <SelectItem value="non_negative">Non-negative (≥ 0)</SelectItem>
                            <SelectItem value="non_positive">Non-positive (≤ 0)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Parity Check - Only show for integer fields */}
                    {getColumnDataType().includes('int') && (
                      <div className="space-y-2">
                        <Label>Parity Check</Label>
                        <Select
                          value={validationRule.parity || "none"}
                          onValueChange={(value) =>
                            setValidationRule({
                              ...validationRule,
                              parity: value as 'even' | 'odd',
                            })
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select parity restriction" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="none">No restriction</SelectItem>
                            <SelectItem value="even">Even numbers only</SelectItem>
                            <SelectItem value="odd">Odd numbers only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Validations */}
                {(getColumnDataType().includes('character varying') || getColumnDataType().includes('text')) && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">Text Validations</h3>
                    
                    {/* Predefined Patterns for Text */}
                    <div className="space-y-2">
                      <Label>Predefined Pattern</Label>
                      <Select
                        value={validationRule.regex_pattern || "none"}
                        onValueChange={(value) =>
                          setValidationRule({
                            ...validationRule,
                            regex_pattern: value === "none" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select pattern" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">No pattern</SelectItem>
                          <SelectItem value="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$">Email Address</SelectItem>
                          <SelectItem value="^[0-9]{10}$">Phone Number (10 digits)</SelectItem>
                          <SelectItem value="^[A-Z]{5}[0-9]{4}[A-Z]{1}$">PAN Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Case Restriction */}
                    <div className="space-y-2">
                      <Label>Case Restriction</Label>
                      <Select
                        value={validationRule.case_restriction || "none"}
                        onValueChange={(value) =>
                          setValidationRule({
                            ...validationRule,
                            case_restriction: value as 'uppercase' | 'lowercase',
                          })
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select case restriction" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">No restriction</SelectItem>
                          <SelectItem value="uppercase">Uppercase only</SelectItem>
                          <SelectItem value="lowercase">Lowercase only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Custom Error Message */}
                <div className="space-y-2">
                  <Label>Custom Error Message</Label>
                  <Input
                    value={validationRule.custom_error_message || ""}
                    onChange={(e) =>
                      setValidationRule({
                        ...validationRule,
                        custom_error_message: e.target.value,
                      })
                    }
                    placeholder="Enter custom error message"
                  />
                </div>

                {/* Validation Preview */}
                {renderValidationPreview()}

                {/* Save Button */}
                <Button
                  className="w-full mt-6"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Validation Rule"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ValidationConfigurator;