import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";
import { Pagination } from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  // CheckCircle,
  // XCircle,
  FileWarning,
  Eye,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

interface AdminLog {
  log_id: string;
  admin_email: string;
  action_type: "CREATE" | "UPDATE" | "DELETE";
  section: string;
  action_details: {
    requestBody?: Record<string, any>;
    response?: Record<string, any>;
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
  };
  ip_address: string;
  target_table: string;
  target_id: string | null;
  status: "completed" | "failed";
  created_at: string;
  additional_info: Record<string, any> | null;
  first_name: string;
  last_name: string;
}

interface FilterParams {
  sortColumn: string | null;
  sortDirection: "asc" | "desc" | null;
  currentPage: number;
  sectionFilter: string;
}

const API_URL = 'http://localhost:8080';

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);
  const [loading, setLoading] = useState(true);
  // const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchText, setSearchText] = useState("");
  const { toast } = useToast();
  const [customDateRange, setCustomDateRange] = useState({
    from: "",
    to: "",
  });
  const [filterParams, setFilterParams] = useState<FilterParams>({
    sortColumn: "created_at",
    sortDirection: "desc",
    currentPage: 1,
    sectionFilter: "all"
  });
  // const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    groupName: "",
    tableName: "",
    columnName: "",
    actionType: "all"
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filterParams.sortColumn && filterParams.sortDirection) {
        queryParams.append('sortBy', filterParams.sortColumn);
        queryParams.append('sortOrder', filterParams.sortDirection);
      }
      if (filterParams.sectionFilter !== 'all') {
        queryParams.append('section', filterParams.sectionFilter);
      }
      if (advancedFilters.actionType !== 'all') {
        queryParams.append('actionType', advancedFilters.actionType);
      }
      if (searchText) {
        queryParams.append('search', searchText);
      }
      if (customDateRange.from) {
        queryParams.append('startDate', customDateRange.from);
      }
      if (customDateRange.to) {
        queryParams.append('endDate', customDateRange.to);
      }
      
      // Add advanced filters
      if (advancedFilters.groupName) {
        queryParams.append('groupName', advancedFilters.groupName);
      }
      if (advancedFilters.tableName) {
        queryParams.append('tableName', advancedFilters.tableName);
      }
      if (advancedFilters.columnName) {
        queryParams.append('columnName', advancedFilters.columnName);
      }
      
      queryParams.append('page', filterParams.currentPage.toString());
      queryParams.append('limit', itemsPerPage.toString());

      const response = await fetch(`${API_URL}/admin/logs?${queryParams}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTotal(data.total || data.logs.length);
        setTotalPages(data.totalPages || Math.ceil(data.total / itemsPerPage));
      } else {
        // Fallback for older API format
        setLogs(data);
        setTotal(data.length);
        setTotalPages(Math.ceil(data.length / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        variant: "destructive",
        description: "Failed to fetch admin logs"
      });
      setLogs([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filterParams, itemsPerPage, customDateRange, advancedFilters, toast]);

  const fetchSections = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/logs/sections`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }
      
      const data = await response.json();
      if (data.success && data.sections) {
        setSections(data.sections);
      } else {
        setSections([]);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      setSections([]);
    }
  };

  const fetchActionTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/logs/action-types`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch action types');
      }
      
      const data = await response.json();
      if (data.success && data.actionTypes) {
        setActionTypes(data.actionTypes);
      } else {
        setActionTypes([]);
      }
    } catch (error) {
      console.error('Error fetching action types:', error);
      setActionTypes([]);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchSections();
    fetchActionTypes();
  }, [fetchLogs]);

  const handleSort = (column: string) => {
    setFilterParams(prev => {
      if (prev.sortColumn !== column) {
        return {
          ...prev,
          sortColumn: column,
          sortDirection: "asc",
          currentPage: 1,
        };
      }

      if (prev.sortDirection === "asc") {
        return {
          ...prev,
          sortDirection: "desc",
          currentPage: 1,
        };
      }

      return {
        ...prev,
        sortColumn: null,
        sortDirection: null,
        currentPage: 1,
      };
    });
  };

  const handleSectionFilter = (section: string) => {
    setFilterParams(prev => ({
      ...prev,
      sectionFilter: section,
      currentPage: 1,
    }));
  };

  const handleSearch = () => {
    setFilterParams(prev => ({
      ...prev,
      currentPage: 1,
    }));
    fetchLogs();
  };

  const handleAdvancedFilterChange = (field: string, value: string) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyAdvancedFilters = () => {
    setFilterParams(prev => ({
      ...prev,
      currentPage: 1,
    }));
    setShowAdvancedFilters(false);
  };

  const handleDateChange = (type: "from" | "to", value: string) => {
    setCustomDateRange(prev => ({
      ...prev,
      [type]: value,
    }));
    setFilterParams(prev => ({
      ...prev,
      currentPage: 1,
    }));
  };

  const clearFilters = () => {
    setSearchText("");
    setCustomDateRange({ from: "", to: "" });
    setAdvancedFilters({
      groupName: "",
      tableName: "",
      columnName: "",
      actionType: "all"
    });
    setFilterParams({
      sortColumn: "created_at",
      sortDirection: "desc",
      currentPage: 1,
      sectionFilter: "all"
    });
  };

  const handlePageChange = (page: number) => {
    setFilterParams(prev => ({
      ...prev,
      currentPage: page,
    }));
  };

  const getChangesSummary = (log: AdminLog): string => {
    if (!log.additional_info && !log.action_details) return "Action completed";
    
    const info = log.additional_info || {};
    
    switch (log.section) {
      case "USER_MANAGEMENT":
        if (log.action_type === "CREATE") {
          return `Created user ${info.email || log.action_details?.requestBody?.email || ''}`;
        } else if (log.action_type === "UPDATE") {
          if (info.action === "User Activated") {
            return `Activated user ${info.email || ''}`;
          } else if (info.action === "User Deactivated") {
            return `Deactivated user ${info.email || ''}`;
          } else {
            const changes = Object.keys(info).filter(key => 
              ["role", "active", "first_name", "last_name"].includes(key)
            );
            return `Updated user fields: ${changes.join(", ")}`;
          }
        }
        break;
        
      case "GROUP_MANAGEMENT":
        if (log.action_type === "CREATE") {
          return `Created group "${info.group_name}" with ${info.tables?.length || 0} tables`;
        } else if (log.action_type === "UPDATE") {
          if (info.action === "Group Toggled") {
            return `${info.new_status} group "${info.group_name}"`;
          } else if (info.action === "Table Added to Group") {
            return `Added tables to group "${info.group_name}"`;
          } else {
            return `Updated group "${info.group_name}"`;
          }
        } else if (log.action_type === "DELETE") {
          return `Deleted group "${info.group_name}"`;
        }
        break;
        
      case "COLUMN_PERMISSION":
        return `Updated permissions for ${info.editable_count || 0} editable and ${info.non_editable_count || 0} non-editable columns in table "${info.table_name || log.target_table}"`;
        
      case "DROPDOWN_MANAGEMENT":
        // Focus on showing specific changes
        const changeDetails = [];
        
        // Show counts of specific changes for dependent dropdowns
        if (info.dependent_changes && Object.keys(info.dependent_changes).length > 0) {
          const dependentChanges = Object.entries(info.dependent_changes).map(([col, data]: [string, any]) => {
            const addedCount = data.added?.length || 0;
            const removedCount = data.removed?.length || 0;
            
            if (addedCount > 0 && removedCount > 0) {
              return `${col} (+${addedCount}/-${removedCount})`;
            } else if (addedCount > 0) {
              return `${col} (+${addedCount})`;
            } else if (removedCount > 0) {
              return `${col} (-${removedCount})`;
            }
            return col;
          });
          
          if (dependentChanges.length > 0) {
            changeDetails.push(`modified dependent columns: ${dependentChanges.join(', ')}`);
          }
        }
        
        // Show counts of specific changes for regular dropdowns
        if (info.regular_changes && Object.keys(info.regular_changes).length > 0) {
          const regularChanges = Object.entries(info.regular_changes).map(([col, data]: [string, any]) => {
            const addedCount = data.added?.length || 0;
            const removedCount = data.removed?.length || 0;
            
            if (addedCount > 0 && removedCount > 0) {
              return `${col} (+${addedCount}/-${removedCount})`;
            } else if (addedCount > 0) {
              return `${col} (+${addedCount})`;
            } else if (removedCount > 0) {
              return `${col} (-${removedCount})`;
            }
            return col;
          });
          
          if (regularChanges.length > 0) {
            changeDetails.push(`modified regular columns: ${regularChanges.join(', ')}`);
          }
        }
        
        // Use changes array directly if the structured changes aren't available
        if ((!info.dependent_changes || Object.keys(info.dependent_changes).length === 0) && 
            (!info.regular_changes || Object.keys(info.regular_changes).length === 0) && 
            info.changes) {
          
          const addedCount = info.changes.added?.length || 0;
          const removedCount = info.changes.removed?.length || 0;
          
          if (addedCount > 0) {
            changeDetails.push(`added ${addedCount} option${addedCount !== 1 ? 's' : ''}`);
          }
          
          if (removedCount > 0) {
            changeDetails.push(`removed ${removedCount} option${removedCount !== 1 ? 's' : ''}`);
          }
        }
        
        // If we have specific change details, return them
        if (changeDetails.length > 0) {
          return `Modified dropdown options for ${info.table_name || log.target_table}: ${changeDetails.join(', ')}`;
        }
        
        // Fall back to legacy format if no specific changes were found
        if (info.is_dependent || log.action_details?.requestBody?.parent_column) {
          // For dependent dropdowns, provide more specific information
          const dependentInfo = [];
          
          if (info.dependent_dropdowns && info.dependent_dropdowns.length > 0) {
            dependentInfo.push(`Updated ${info.dependent_dropdowns.length} dependent columns`);
          } else if (info.dependent_columns && info.dependent_columns.length > 0) {
            dependentInfo.push(`Updated ${info.dependent_columns.length} dependent columns`);
          } else {
            dependentInfo.push(`parent ${info.parent_column || log.action_details?.requestBody?.parent_column || ''}`);
          }
          
          return `Updated dependent dropdown options for ${info.table_name || log.target_table} (${dependentInfo.join(", ")})`;
        }
        
        // For regular dropdown updates
        const columnInfo = [];
        if (info.columns_updated && info.columns_updated.length > 0) {
          columnInfo.push(`${info.columns_updated.length} columns`);
        } else if (info.column_name) {
          columnInfo.push(info.column_name);
        }
        
        return `Updated dropdown options for ${info.table_name || log.target_table}${columnInfo.length > 0 ? ` (${columnInfo.join(", ")})` : ''}`;
        
      case "COLUMN_RENAME":
        return `Renamed column "${info.original_column_name}" to "${info.renamed_column_name}" in table "${info.table_name || log.target_table}"`;
        
      case "VALIDATION_CONFIG":
        return `Updated validation rules for ${info.column_name || ''} in table "${info.table_name || log.target_table}"`;
      
      case "TABLE_CONFIG":
        if (log.action_type === "CREATE") {
          return `Added display metadata for table "${info.original_table_name || log.target_table}"`;
        } else if (log.action_type === "UPDATE") {
          return `Updated display metadata for table "${info.original_table_name || log.target_table}"`;
        } else if (log.action_type === "DELETE") {
          return `Deleted display metadata for table "${info.original_table_name || log.target_table}"`;
        }
        break;
    }
    
    return "Action completed";
  };

  const renderActionDetails = (log: AdminLog): string[] => {
    const details: string[] = [];
    const info = log.additional_info || {};
    const requestBody = log.action_details?.requestBody || {};
    
    switch (log.section) {
      case "USER_MANAGEMENT":
        if (log.action_type === "CREATE") {
          details.push(`Created user: ${info.email || requestBody.email || ''}`);
          details.push(`Role: ${info.role || requestBody.role || ''}`);
          if (info.first_name || requestBody.first_name) {
            details.push(`Name: ${info.first_name || requestBody.first_name || ''} ${info.last_name || requestBody.last_name || ''}`);
          }
        } else if (log.action_type === "UPDATE") {
          if (info.changes) {
            details.push("Changes made:");
            (info.changes as any[]).forEach(change => {
              details.push(`  - ${change.field}: ${change.oldValue} → ${change.newValue}`);
            });
          } else {
            // Fallback to listing all modified fields
            Object.entries(info).forEach(([key, value]) => {
              if (["email", "role", "first_name", "last_name", "active"].includes(key)) {
                details.push(`${key}: ${value}`);
              }
            });
          }
        }
        break;
        
      case "GROUP_MANAGEMENT":
        details.push(`Group: ${info.group_name || requestBody.group_name || ''}`);
        
        if (log.action_type === "CREATE") {
          if (info.tables && Array.isArray(info.tables) && info.tables.length > 0) {
            details.push(`Tables: ${info.tables.join(", ")}`);
          } else if (requestBody.tables && Array.isArray(requestBody.tables) && requestBody.tables.length > 0) {
            details.push(`Tables: ${requestBody.tables.join(", ")}`);
          } else {
            details.push("No tables added initially");
          }
        } else if (log.action_type === "UPDATE") {
          if (info.action === "Group Toggled") {
            details.push(`Status changed to: ${info.new_status}`);
          } else {
            if (info.added_tables && info.added_tables.length > 0) {
              details.push(`Added tables: ${info.added_tables.join(", ")}`);
            }
            if (info.removed_tables && info.removed_tables.length > 0) {
              details.push(`Removed tables: ${info.removed_tables.join(", ")}`);
            }
            if ((!info.added_tables || info.added_tables.length === 0) && 
                (!info.removed_tables || info.removed_tables.length === 0)) {
              details.push(`Current tables: ${info.tables?.join(", ") || requestBody.tables?.join(", ") || "None"}`);
            }
          }
        }
        break;
        
      case "COLUMN_PERMISSION":
        details.push(`Table: ${info.table_name || requestBody.table_name || log.target_table}`);
        if (info.columns && Array.isArray(info.columns)) {
          details.push("Column permissions:");
          info.columns.forEach((col: any) => {
            details.push(`  - ${col.column_name}: ${col.status}`);
          });
        } else if (requestBody.column_list && Array.isArray(requestBody.column_list)) {
          details.push("Column permissions:");
          requestBody.column_list.forEach((col: any) => {
            details.push(`  - ${col.column_name}: ${col.column_status}`);
          });
        }
        break;
        
      case "DROPDOWN_MANAGEMENT":
        details.push(`Table: ${info.table_name || requestBody.table_name || log.target_table}`);
        
        // Show precise changes for dependent dropdowns when available
        if (info.dependent_changes && Object.keys(info.dependent_changes).length > 0) {
          details.push("🔄 Changes to Dependent Dropdowns:");
          
          Object.entries(info.dependent_changes).forEach(([columnName, changes]: [string, any]) => {
            const parentColumn = changes.parent_column;
            details.push(`  • Column: ${columnName} (depends on ${parentColumn})`);
            
            // Show added options with their parent values
            if (changes.added && changes.added.length > 0) {
              details.push("    ➕ Added options:");
              changes.added.forEach((opt: any) => {
                details.push(`      - "${opt.value}" under parent "${opt.parent}"`);
              });
            }
            
            // Show removed options with their parent values
            if (changes.removed && changes.removed.length > 0) {
              details.push("    ➖ Removed options:");
              changes.removed.forEach((opt: any) => {
                details.push(`      - "${opt.value}" under parent "${opt.parent}"`);
              });
            }
          });
        }
        
        // Show changes for regular dropdowns
        if (info.regular_changes && Object.keys(info.regular_changes).length > 0) {
          details.push("🔄 Changes to Regular Dropdowns:");
          
          Object.entries(info.regular_changes).forEach(([columnName, changes]: [string, any]) => {
            details.push(`  • Column: ${columnName}`);
            
            // Show added options
            if (changes.added && changes.added.length > 0) {
              details.push("    ➕ Added options:");
              changes.added.forEach((value: any) => {
                details.push(`      - "${value}"`);
              });
            }
            
            // Show removed options
            if (changes.removed && changes.removed.length > 0) {
              details.push("    ➖ Removed options:");
              changes.removed.forEach((value: any) => {
                details.push(`      - "${value}"`);
              });
            }
          });
        }
        
        // Show specific changes when individual items are tracked
        if (info.changes && (info.changes.added.length > 0 || info.changes.removed.length > 0)) {
          // Skip if we've already displayed changes through the more structured format above
          if (!info.dependent_changes && !info.regular_changes) {
            if (info.changes.added.length > 0) {
              details.push("➕ Added Options:");
              info.changes.added.forEach((item: any) => {
                if (item.parent_column) {
                  details.push(`  • ${item.column}: "${item.value}" under parent "${item.parent_value}"`);
                } else {
                  details.push(`  • ${item.column}: "${item.value}"`);
                }
              });
            }
            
            if (info.changes.removed.length > 0) {
              details.push("➖ Removed Options:");
              info.changes.removed.forEach((item: any) => {
                if (item.parent_column) {
                  details.push(`  • ${item.column}: "${item.value}" under parent "${item.parent_value}"`);
                } else {
                  details.push(`  • ${item.column}: "${item.value}"`);
                }
              });
            }
          }
        }
        
        // Fall back to existing approach if we don't have specific change data
        if ((!info.changes || (info.changes.added.length === 0 && info.changes.removed.length === 0)) &&
            (!info.dependent_changes || Object.keys(info.dependent_changes).length === 0) &&
            (!info.regular_changes || Object.keys(info.regular_changes).length === 0)) {
          
          // For structured information from our enhanced backend
          if (info.columns_updated && info.columns_updated.length > 0) {
            details.push(`Columns Updated: ${info.columns_updated.length}`);
          } else if (info.column_name) {
            details.push(`Column: ${info.column_name}`);
          }
          
          // Display count of values rather than all values
          if (info.regular_dropdowns && info.regular_dropdowns.length > 0) {
            details.push("Regular Dropdowns:");
            info.regular_dropdowns.forEach((dropdown: any) => {
              const valueCount = dropdown.values_count || (dropdown.values ? dropdown.values.length : 0);
              
              if (valueCount === 0) {
                details.push(`  • ${dropdown.column}: No options configured`);
              } else {
                details.push(`  • ${dropdown.column}: ${valueCount} options`);
                
                // Show examples only if values array is available and not too long
                if (dropdown.values && Array.isArray(dropdown.values) && dropdown.values.length <= 3) {
                  details.push(`    Values: ${dropdown.values.join(", ")}`);
                }
              }
            });
          }
          
          // Display dependent dropdowns with focus on structure, not all values
          if (info.dependent_dropdowns && info.dependent_dropdowns.length > 0) {
            details.push("Dependent Dropdowns:");
            info.dependent_dropdowns.forEach((dropdown: any) => {
              details.push(`  • ${dropdown.column} (depends on ${dropdown.parent_column})`);
              
              const valueCount = dropdown.values_count || (dropdown.values ? dropdown.values.length : 0);
              if (valueCount === 0) {
                details.push(`    No options configured`);
              } else {
                details.push(`    ${valueCount} options configured`);
                
                // Show examples only if values array is available and not too long
                if (dropdown.values && Array.isArray(dropdown.values) && dropdown.values.length <= 3) {
                  details.push(`    Examples: ${dropdown.values.join(", ")}`);
                }
              }
            });
          }
          
          // Fall back to old display format if enhanced data isn't available
          if (!info.regular_dropdowns && !info.dependent_dropdowns) {
            if (info.column_name) {
              details.push(`Column: ${info.column_name || requestBody.column_name || ''}`);
            }
            
            // Special handling for dependent dropdowns
            if (info.is_dependent || requestBody.parent_column) {
              details.push(`Parent Column: ${info.parent_column || requestBody.parent_column || ''}`);
              details.push("Dependency configuration updated");
            }
          }
          
          // Legacy format for added/removed options
          if (info.added_options && info.added_options.length > 0) {
            const formattedAdded = info.added_options.map((opt: any) => formatDropdownOption(opt));
            details.push(`Added options: ${formattedAdded.join(", ")}`);
          }
          if (info.removed_options && info.removed_options.length > 0) {
            const formattedRemoved = info.removed_options.map((opt: any) => formatDropdownOption(opt));
            details.push(`Removed options: ${formattedRemoved.join(", ")}`);
          }
        }
        break;
        
      case "COLUMN_RENAME":
        details.push(`Table: ${info.table_name || requestBody.table_name || log.target_table}`);
        details.push(`Original column name: ${info.original_column_name || requestBody.original_column_name || ''}`);
        details.push(`New column name: ${info.renamed_column_name || requestBody.renamed_column_name || ''}`);
        break;
        
      case "VALIDATION_CONFIG":
        details.push(`Table: ${info.table_name || requestBody.table_name || log.target_table}`);
        details.push(`Column: ${info.column_name || requestBody.column_name || ''}`);
        
        if (info.validations) {
          details.push("Validation rules:");
          if (typeof info.validations === 'object') {
            Object.entries(info.validations).forEach(([rule, value]) => {
              details.push(`  - ${rule}: ${value}`);
            });
          }
        } else if (requestBody.validations || requestBody.validation) {
          const validations = requestBody.validations || requestBody.validation;
          details.push("Validation rules:");
          if (typeof validations === 'object') {
            Object.entries(validations).forEach(([rule, value]) => {
              details.push(`  - ${rule}: ${value}`);
            });
          }
        }
        
        // Add data type information
        if (info.data_type || requestBody.data_type) {
          details.push(`Data Type: ${info.data_type || requestBody.data_type}`);
        }
        
        // Add status information
        if (info.is_active !== undefined || requestBody.is_active !== undefined) {
          const isActive = info.is_active !== undefined ? info.is_active : requestBody.is_active;
          details.push(`Status: ${isActive ? 'Active' : 'Inactive'}`);
        }
        
        if (info.added_validations && info.added_validations.length > 0) {
          details.push(`Added validations for: ${info.added_validations.join(", ")}`);
        }
        if (info.removed_validations && info.removed_validations.length > 0) {
          details.push(`Removed validations for: ${info.removed_validations.join(", ")}`);
        }
        if (info.modified_validations && info.modified_validations.length > 0) {
          details.push(`Modified validations for: ${info.modified_validations.join(", ")}`);
        }
        break;
      
      case "TABLE_CONFIG":
        details.push(`Original Table Name: ${info.original_table_name || requestBody.original_table_name || log.target_table}`);
        details.push(`Display Name: ${info.display_name || requestBody.display_name || ''}`);
        
        if (info.description || requestBody.description) {
          details.push(`Description: ${info.description || requestBody.description || ''}`);
        }
        
        if (log.action_type === "UPDATE") {
          // Add what fields were changed
          const changedFields = [];
          if (info.old_display_name !== undefined && info.old_display_name !== info.display_name) {
            changedFields.push(`Display Name: "${info.old_display_name}" → "${info.display_name}"`);
          } else if (requestBody.old_display_name !== undefined && requestBody.old_display_name !== requestBody.display_name) {
            changedFields.push(`Display Name: "${requestBody.old_display_name}" → "${requestBody.display_name}"`);
          }
          
          if (info.old_description !== undefined && info.old_description !== info.description) {
            changedFields.push(`Description: modified`);
          } else if (requestBody.old_description !== undefined && requestBody.old_description !== requestBody.description) {
            changedFields.push(`Description: modified`);
          }
          
          if (changedFields.length > 0) {
            details.push("Changes:");
            changedFields.forEach(change => {
              details.push(`  - ${change}`);
            });
          }
        }
        break;
    }
    
    if (details.length === 0) {
      details.push("No detailed information available");
    }
    
    return details;
  };

  // Helper function to properly format dropdown option values
  const formatDropdownOption = (option: any): string => {
    if (option === null || option === undefined) {
      return "null";
    }
    
    if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
      return String(option);
    }
    
    // Handle object values with parent-child relationships
    if (typeof option === 'object') {
      // Format dropdown configuration objects with columnName and options
      if (option.columnName && option.options !== undefined) {
        if (option.parentColumn) {
          return `${option.columnName} (dependent on ${option.parentColumn}: ${option.options.length} options)`;
        }
        
        if (Array.isArray(option.options) && option.options.length === 0) {
          return `${option.columnName}: No options`;
        }
        
        if (Array.isArray(option.options) && option.options.length <= 3) {
          const optValues = option.options.map((opt: any) => {
            if (typeof opt === 'object' && opt.value) {
              return opt.value + (opt.parent ? ` (${opt.parent})` : '');
            }
            return String(opt);
          });
          return `${option.columnName}: ${optValues.join(", ")}`;
        }
        
        return `${option.columnName}: ${option.options.length} options`;
      }
      
      // Handle standard value-parent objects
      if (option.value !== undefined) {
        if (option.parent) {
          return `${option.value} (parent: ${option.parent})`;
        }
        return String(option.value);
      }
      
      // For other objects, show a better representation than [object Object]
      try {
        return JSON.stringify(option);
      } catch (e) {
        return `Complex object`;
      }
    }
    
    return String(option);
  };

  // Add this function to format JSON data in a more user-friendly way
  const formatJsonForDisplay = (jsonData: any): JSX.Element => {
    if (!jsonData) return <span className="text-gray-500 italic">No data available</span>;
    
    // Special handling for dropdown changes
    if (jsonData.changes && (jsonData.changes.added?.length > 0 || jsonData.changes.removed?.length > 0)) {
      return (
        <div className="space-y-4">
          <div className="font-medium text-gray-700">Dropdown Changes</div>
          
          {jsonData.changes.added?.length > 0 && (
            <div className="pl-4 space-y-2">
              <div className="font-medium text-green-600">Added Options ({jsonData.changes.added.length})</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                {jsonData.changes.added.map((item: any, i: number) => (
                  <div key={`added-${i}`} className="text-sm flex items-start gap-1">
                    <span className="text-gray-600">{item.column}:</span>
                    <span className="text-green-600 font-medium">{typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}</span>
                    {item.parent_column && (
                      <span className="text-gray-500">
                        (parent: {item.parent_value || 'none'})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {jsonData.changes.removed?.length > 0 && (
            <div className="pl-4 space-y-2">
              <div className="font-medium text-red-600">Removed Options ({jsonData.changes.removed.length})</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                {jsonData.changes.removed.map((item: any, i: number) => (
                  <div key={`removed-${i}`} className="text-sm flex items-start gap-1">
                    <span className="text-gray-600">{item.column}:</span>
                    <span className="text-red-600 font-medium">{typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}</span>
                    {item.parent_column && (
                      <span className="text-gray-500">
                        (parent: {item.parent_value || 'none'})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Existing handling for dropdown options
    if (jsonData.dropdown_options && Array.isArray(jsonData.dropdown_options)) {
      return (
        <div className="space-y-4">
          <div className="font-medium text-gray-700">Dropdown Configuration</div>
          <div className="space-y-3 pl-4">
            {jsonData.dropdown_options.map((option: any, index: number) => (
              <div key={index} className="border-l-2 border-gray-200 pl-4 pb-3">
                <div className="font-medium text-blue-600">
                  {option.columnName} 
                  {option.parentColumn && <span className="text-purple-600"> (depends on {option.parentColumn})</span>}
                </div>
                {Array.isArray(option.options) && option.options.length > 0 ? (
                  <div>
                    <div className="text-sm text-gray-600 mt-1 mb-2">{option.options.length} options:</div>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {option.options.slice(0, 10).map((opt: any, i: number) => (
                        <div key={i} className="text-sm">
                          {typeof opt === 'object' && opt.value ? (
                            <>
                              <span className="text-green-600">{opt.value}</span>
                              {opt.parent && <span className="text-gray-500"> ({opt.parent})</span>}
                            </>
                          ) : (
                            <span>{String(opt)}</span>
                          )}
                        </div>
                      ))}
                      {option.options.length > 10 && (
                        <div className="text-sm text-gray-500 col-span-2">
                          ...and {option.options.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mt-1">No options configured</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Special handling for dependent and regular changes
    if ((jsonData.dependent_changes && Object.keys(jsonData.dependent_changes).length > 0) ||
        (jsonData.regular_changes && Object.keys(jsonData.regular_changes).length > 0)) {
      
      return (
        <div className="space-y-6">
          {/* Dependent dropdown changes */}
          {jsonData.dependent_changes && Object.keys(jsonData.dependent_changes).length > 0 && (
            <div className="space-y-3">
              <div className="font-medium text-gray-700">Dependent Dropdown Changes</div>
              <div className="space-y-4 pl-4">
                {Object.entries(jsonData.dependent_changes).map(([column, changes]: [string, any], idx: number) => (
                  <div key={`dep-${idx}`} className="border-l-2 border-gray-200 pl-4 space-y-2">
                    <div className="font-medium text-blue-600">
                      {column} <span className="text-purple-600">(depends on {changes.parent_column})</span>
                    </div>
                    
                    {/* Added values */}
                    {changes.added && changes.added.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-green-600">Added Options:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-3">
                          {changes.added.map((item: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="text-green-600">{item.value}</span>
                              <span className="text-gray-500"> (parent: {item.parent})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Removed values */}
                    {changes.removed && changes.removed.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-red-600">Removed Options:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-3">
                          {changes.removed.map((item: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="text-red-600">{item.value}</span>
                              <span className="text-gray-500"> (parent: {item.parent})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Regular dropdown changes */}
          {jsonData.regular_changes && Object.keys(jsonData.regular_changes).length > 0 && (
            <div className="space-y-3">
              <div className="font-medium text-gray-700">Regular Dropdown Changes</div>
              <div className="space-y-4 pl-4">
                {Object.entries(jsonData.regular_changes).map(([column, changes]: [string, any], idx: number) => (
                  <div key={`reg-${idx}`} className="border-l-2 border-gray-200 pl-4 space-y-2">
                    <div className="font-medium text-blue-600">{column}</div>
                    
                    {/* Added values */}
                    {changes.added && changes.added.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-green-600">Added Options:</div>
                        <div className="grid grid-cols-2 gap-2 pl-3">
                          {changes.added.map((item: any, i: number) => (
                            <div key={i} className="text-sm text-green-600">
                              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Removed values */}
                    {changes.removed && changes.removed.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-red-600">Removed Options:</div>
                        <div className="grid grid-cols-2 gap-2 pl-3">
                          {changes.removed.map((item: any, i: number) => (
                            <div key={i} className="text-sm text-red-600">
                              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Handle different data types
    if (typeof jsonData === 'string') {
      return <span className="text-blue-700">{jsonData}</span>;
    }
    
    if (typeof jsonData === 'number' || typeof jsonData === 'boolean') {
      return <span className="text-purple-700">{String(jsonData)}</span>;
    }
    
    if (jsonData === null) {
      return <span className="text-gray-500 italic">null</span>;
    }
    
    if (Array.isArray(jsonData)) {
      if (jsonData.length === 0) {
        return <span className="text-gray-500 italic">Empty array</span>;
      }
      
      return (
        <div className="pl-4 border-l-2 border-gray-200">
          {jsonData.map((item, index) => (
            <div key={index} className="mb-2">
              <span className="text-gray-600 mr-2">Item {index + 1}:</span>
              {formatJsonForDisplay(item)}
            </div>
          ))}
        </div>
      );
    }
    
    if (typeof jsonData === 'object') {
      const entries = Object.entries(jsonData);
      if (entries.length === 0) {
        return <span className="text-gray-500 italic">Empty object</span>;
      }
      
      return (
        <div className="space-y-2">
          {entries.map(([key, value], index) => (
            <div key={key} className={index !== entries.length - 1 ? "pb-2 border-b border-gray-100" : ""}>
              <div className="flex flex-col">
                <span className="font-medium text-gray-700">{key.replace(/_/g, ' ')}</span>
                <div className="ml-4 mt-1">
                  {formatJsonForDisplay(value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    return <span>{String(jsonData)}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search admin, action type, or details..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 w-full sm:w-[300px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customDateRange.from}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="w-[150px]"
            max={customDateRange.to || undefined}
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={customDateRange.to}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="w-[150px]"
            min={customDateRange.from || undefined}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="flex gap-2">
          <Dialog open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowAdvancedFilters(true)}
            >
              <Filter className="h-4 w-4" />
              Advanced Filters
            </Button>
            <DialogContent className="max-w-md">
              <DialogTitle>Advanced Filters</DialogTitle>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Action Type</label>
                  <Select 
                    value={advancedFilters.actionType}
                    onValueChange={(value) => handleAdvancedFilterChange('actionType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group Name</label>
                  <Input 
                    placeholder="Filter by specific group..."
                    value={advancedFilters.groupName}
                    onChange={(e) => handleAdvancedFilterChange('groupName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Table Name</label>
                  <Input 
                    placeholder="Filter by specific table..."
                    value={advancedFilters.tableName}
                    onChange={(e) => handleAdvancedFilterChange('tableName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Name</label>
                  <Input 
                    placeholder="Filter by specific column..."
                    value={advancedFilters.columnName}
                    onChange={(e) => handleAdvancedFilterChange('columnName', e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAdvancedFilters(false)}>
                    Cancel
                  </Button>
                  <Button onClick={applyAdvancedFilters}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Clear Filters
          </button>
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Section Filters */}
      <div className="flex overflow-x-auto pb-2 gap-2">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => handleSectionFilter(section)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${
              filterParams.sectionFilter === section
                ? "bg-blue-100 text-blue-800 font-medium"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {section === "all" ? "All Sections" : section}
          </button>
        ))}
      </div>

      {/* Active filters display */}
      {(filterParams.sectionFilter !== 'all' || 
        advancedFilters.groupName || 
        advancedFilters.tableName || 
        advancedFilters.columnName || 
        advancedFilters.actionType !== 'all') && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">Active filters:</span>
          
          {filterParams.sectionFilter !== 'all' && (
            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span>Section: {filterParams.sectionFilter}</span>
              <button 
                onClick={() => handleSectionFilter('all')}
                className="hover:bg-blue-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          {advancedFilters.actionType !== 'all' && (
            <div className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span>Action: {advancedFilters.actionType}</span>
              <button 
                onClick={() => handleAdvancedFilterChange('actionType', 'all')}
                className="hover:bg-indigo-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          {advancedFilters.groupName && (
            <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span>Group: {advancedFilters.groupName}</span>
              <button 
                onClick={() => handleAdvancedFilterChange('groupName', '')}
                className="hover:bg-purple-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          {advancedFilters.tableName && (
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span>Table: {advancedFilters.tableName}</span>
              <button 
                onClick={() => handleAdvancedFilterChange('tableName', '')}
                className="hover:bg-green-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          {advancedFilters.columnName && (
            <div className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span>Column: {advancedFilters.columnName}</span>
              <button 
                onClick={() => handleAdvancedFilterChange('columnName', '')}
                className="hover:bg-amber-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && (!logs || logs.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FileWarning className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No logs found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">
                  <div className="flex items-center">
                    Category
                    <button
                      onClick={() => handleSort("section")}
                      className="ml-2 p-1"
                    >
                      {filterParams.sortColumn === "section" ? (
                        filterParams.sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <div className="h-4 w-4 flex flex-col opacity-30">
                          <ChevronUp className="h-2 w-2" />
                          <ChevronDown className="h-2 w-2" />
                        </div>
                      )}
                    </button>
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Action Type</TableHead>
                <TableHead className="w-[240px]">What Changed</TableHead>
                <TableHead className="w-[160px]">Admin User</TableHead>
                <TableHead className="w-[140px]">
                  <div className="flex items-center">
                    When
                    <button
                      onClick={() => handleSort("created_at")}
                      className="ml-2 p-1"
                    >
                      {filterParams.sortColumn === "created_at" ? (
                        filterParams.sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <div className="h-4 w-4 flex flex-col opacity-30">
                          <ChevronUp className="h-2 w-2" />
                          <ChevronDown className="h-2 w-2" />
                        </div>
                      )}
                    </button>
                  </div>
                </TableHead>
                <TableHead className="w-[120px] text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.log_id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{log.section}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      log.action_type === "CREATE"
                        ? "bg-green-100 text-green-800"
                        : log.action_type === "UPDATE"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {log.action_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium flex items-start gap-1">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 whitespace-nowrap">
                        {log.target_table ? log.target_table.replace('app.', '') : "System"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5">
                      {getChangesSummary(log)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{log.first_name} {log.last_name}</div>
                    <div className="text-xs text-gray-500">{log.admin_email}</div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-full transition-colors text-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>See Details</span>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white py-3 px-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">Rows per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                const newItemsPerPage = Number(value);
                setItemsPerPage(newItemsPerPage);
                setFilterParams(prev => ({
                  ...prev,
                  currentPage: 1
                }));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              Showing {(filterParams.currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(filterParams.currentPage * itemsPerPage, total)} of {total} logs
            </span>
            <Pagination
              currentPage={filterParams.currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
            <DialogTitle className="text-xl font-semibold">
              Administrative Action Details
            </DialogTitle>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {selectedLog && (
            <div className="p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">Category</h4>
                    <div className="flex items-center">
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                        {selectedLog.section}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">Type of Change</h4>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedLog.action_type === "CREATE"
                        ? "bg-green-100 text-green-800"
                        : selectedLog.action_type === "UPDATE"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {selectedLog.action_type === "CREATE" 
                        ? "Added" 
                        : selectedLog.action_type === "UPDATE" 
                        ? "Modified" 
                        : "Removed"}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">Changed Item</h4>
                    <p className="text-lg text-gray-900">
                      {selectedLog.target_table ? selectedLog.target_table.replace('app.', '') : "System Setting"}
                    </p>
                    {selectedLog.target_id && (
                      <p className="text-sm text-gray-500">Reference ID: {selectedLog.target_id}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">Changed By</h4>
                    <p className="text-lg text-gray-900">
                      {selectedLog.first_name} {selectedLog.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{selectedLog.admin_email}</p>
                  </div>
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">Date & Time</h4>
                    <p className="text-lg text-gray-900">
                      {format(new Date(selectedLog.created_at), "dd MMM yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-gray-500 font-medium mb-2">From IP</h4>
                    <p className="text-lg text-gray-900">{selectedLog.ip_address}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-gray-500 font-medium mb-3">Summary of Changes</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {renderActionDetails(selectedLog).map((detail, index) => {
                      // Check if the detail is an indented item
                      const indentLevel = detail.startsWith('  ') ? (detail.startsWith('    ') ? 2 : 1) : 0;
                      const className = indentLevel === 2 
                        ? 'ml-8 text-gray-500 text-sm' 
                        : indentLevel === 1 
                          ? 'ml-4 text-gray-600' 
                          : 'text-gray-700 font-medium';
                      
                      return (
                        <p key={index} className={className}>
                          {detail}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* Show Before/After Data when available */}
                {selectedLog.action_details?.oldData && selectedLog.action_details?.newData && (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-gray-500 font-medium mb-2">Previous Values</h4>
                      <div className="bg-red-50 rounded-lg p-4 overflow-x-auto border border-red-100">
                        {formatJsonForDisplay(selectedLog.action_details.oldData)}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-gray-500 font-medium mb-2">New Values</h4>
                      <div className="bg-green-50 rounded-lg p-4 overflow-x-auto border border-green-100">
                        {formatJsonForDisplay(selectedLog.action_details.newData)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show Raw Request/Response Data */}
                <div className="space-y-4">
                  <h4 className="text-gray-500 font-medium mb-2">Technical Details</h4>
                  <details className="bg-gray-50 rounded-lg">
                    <summary className="px-4 py-2 cursor-pointer font-medium">
                      Advanced Request/Response Information
                    </summary>
                    <div className="p-4 space-y-6 border-t border-gray-200">
                      {selectedLog.action_details?.requestBody && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">Submitted Data</h5>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            {formatJsonForDisplay(selectedLog.action_details.requestBody)}
                          </div>
                        </div>
                      )}
                      {selectedLog.action_details?.response && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-600 mb-3">System Response</h5>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            {formatJsonForDisplay(selectedLog.action_details.response)}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLogs; 