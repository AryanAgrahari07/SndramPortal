import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Database, Table, List, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import logo from "@/assets/images/select-table.svg";
import { EXCLUDED_TABLES } from "@/config/tableConfig";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Switch } from "@/components/ui/Switch";
import axios from "axios";

interface TableGroup {
  group_id: string;
  group_name: string;
  tables: string[];
  is_enabled: boolean;
}

interface ApiGroupResponse {
  success: boolean;
  data: {
    group_name: string;
    table_list: string[];
    row_id: string | null;
    is_enabled: boolean;
  }[];
}

const GroupConfiguration: React.FC = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<TableGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TableGroup | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddTablesDialogOpen, setIsAddTablesDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupName, setEditingGroupName] = useState("");
  const [oldGroupName, setOldGroupName] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    groupId: "",
    groupName: "",
  });
  const [confirmTableDialog, setConfirmTableDialog] = useState({
    isOpen: false,
    groupName: "",
    tableName: "",
  });

  const validateGroupName = (name: string, oldName: string = ""): { isValid: boolean; message: string } => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return { isValid: false, message: "Group name is required" };
    }

    if (trimmedName.length < 3 || trimmedName.length > 50) {
      return { isValid: false, message: "Group name must be between 3 and 50 characters" };
    }

    const validCharactersRegex = /^[A-Za-z\s_-]+$/;
    if (!validCharactersRegex.test(trimmedName)) {
      return { isValid: false, message: "Group name can only contain letters, spaces, underscores, and hyphens" };
    }

    // Check for duplicate group names, excluding the current one being edited
    if (groups.some(group => 
      group.group_name.toLowerCase() === trimmedName.toLowerCase() && 
      group.group_name.toLowerCase() !== oldName.toLowerCase()
    )) {
      return { isValid: false, message: "Group name already exists" };
    }

    return { isValid: true, message: "" };
  };

  useEffect(() => {
    fetchGroups();
    fetchAvailableTables();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/getGroupList", {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as ApiGroupResponse;
      if (data.success) {
        const formattedGroups: TableGroup[] = data.data.map((group) => ({
          group_id: group.row_id || group.group_name,
          group_name: group.group_name,
          tables: group.table_list,
          is_enabled: group.is_enabled,
        }));
        setGroups(formattedGroups);
      } else {
        throw new Error("Failed to fetch groups");
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch groups",
        variant: "destructive",
      });
      setGroups([]);
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
      const data = await response.json();
      if (data.success) {
        const filteredTables = data.tables
          .map((table: { table_name: string }) => table.table_name)
          .filter((tableName: string) => !EXCLUDED_TABLES.includes(tableName));

        setAvailableTables(filteredTables);
      } else {
        throw new Error(data.message || "Failed to fetch tables");
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch tables",
        variant: "destructive",
      });
    }
  };

  const handleToggleGroup = async (groupId: string, isEnabled: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
      "http://localhost:8080/toggle",
      {
        group_name: groupId, // Using group_name since that's what your schema uses
        is_enabled: isEnabled
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true
      }
    );

    if (response.data.success) {
      setGroups(groups.map(group => 
        group.group_name === groupId 
          ? { ...group, is_enabled: isEnabled }
          : group
      ));
      
      toast({
        title: "Success",
        description: `Group ${isEnabled ? 'enabled' : 'disabled'} successfully`,
      });
    } else {
      throw new Error(response.data.message || "Failed to update group status");
    }
  } catch (error) {
    console.error("Failed to update group status:", error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to update group status",
      variant: "destructive",
    });
  }
  };

  const handleCreateGroup = async () => {
    const validation = validateGroupName(newGroupName);
    if (!validation.isValid) {
      toast({
        title: "Error",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const trimmedGroupName = newGroupName.trim();
      
      const response = await fetch("http://localhost:8080/addGroup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_name: trimmedGroupName }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        setIsCreateDialogOpen(false);
        setNewGroupName("");
        toast({
          title: "Success",
          description: "Group created successfully",
        });
      } else {
        throw new Error(data.message || "Failed to create group");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditGroup = (group: TableGroup) => {
    setOldGroupName(group.group_name);
    setEditingGroupName(group.group_name);
    setIsEditDialogOpen(true);
  };

  const handleUpdateGroupName = async () => {
    // Validate the new group name
    if (oldGroupName === editingGroupName) {
      setIsEditDialogOpen(false);
      return;
    }

    const validation = validateGroupName(editingGroupName, oldGroupName);
    if (!validation.isValid) {
      toast({
        title: "Error",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/updategroup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_group_name: oldGroupName,
          new_group_name: editingGroupName.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        setIsEditDialogOpen(false);
        toast({
          title: "Success",
          description: "Group name updated successfully",
        });
      } else {
        throw new Error(data.message || "Failed to update group name");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update group name",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTablesToGroup = async () => {
    if (!selectedGroup || selectedTables.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one table",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/addtable", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          group_name: selectedGroup.group_name,
          table_list: selectedTables,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        setIsAddTablesDialogOpen(false);
        setSelectedTables([]);
        toast({
          title: "Success",
          description: "Tables added successfully",
        });
      } else {
        throw new Error(data.message || "Failed to add tables");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add tables",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = (group: TableGroup) => {
    setConfirmDialog({
      isOpen: true,
      groupId: group.group_name,
      groupName: group.group_name,
    });
  };

  const confirmDeleteGroup = async (groupName: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/removeGroup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_name: groupName }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        toast({
          title: "Success",
          description: `${groupName} deleted successfully`,
        });
      } else {
        throw new Error(data.message || "Failed to delete group");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTable = (groupName: string, tableName: string) => {
    setConfirmTableDialog({
      isOpen: true,
      groupName,
      tableName,
    });
  };

  const confirmDeleteTable = async (groupName: string, tableName: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/removeTable", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          group_name: groupName,
          table_name: tableName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        toast({
          title: "Success",
          description: "Table removed successfully",
        });
      } else {
        throw new Error(data.message || "Failed to remove table");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove table",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddTablesDialog = (group: TableGroup) => {
    setSelectedGroup(group);
    setSelectedTables([]);
    setIsAddTablesDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6 bg-[#F8FAFC]">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between text-[#0F172A] mb-8">
          <div className="flex items-center space-x-4">
            <Database className="h-6 w-6" />
            <h2 className="text-2xl font-semibold">Group Configuration</h2>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Group
          </Button>
        </div>

        {/* Groups List */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0F172A] border-t-transparent"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <img
              src={logo}
              alt="No groups"
              className="w-32 h-32 mx-auto opacity-50 mb-6"
            />
            <h3 className="text-xl font-medium text-[#0F172A] mb-2">
              No Groups Available
            </h3>
            <p className="text-gray-600">
              Create a new group to start managing table permissions
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <div
                key={group.group_id}
                className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Table className="h-5 w-5 text-[#0F172A]" />
                    <div>
                      <h3 className="text-lg font-medium text-[#0F172A]">
                        {group.group_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {group.tables?.length || 0} tables assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-2">
                      <Switch
                        checked={group.is_enabled}
                        onCheckedChange={(checked) => handleToggleGroup(group.group_name, checked)}
                        aria-label={`Toggle ${group.group_name} group`}
                      />
                      <span className="text-sm text-gray-500">
                        {group.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditGroup(group)}
                        className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                        disabled={isLoading}
                        title="Edit Group Name"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleOpenAddTablesDialog(group)}
                        className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                        disabled={isLoading}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Tables
                      </Button>
                      <Button
                        onClick={() => handleDeleteGroup(group)}
                        variant="destructive"
                        disabled={isLoading}
                        title="Delete Group"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>

                {group.tables && group.tables.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <List className="h-4 w-4" />
                      <span>Assigned Tables</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.tables.map((table) => (
                        <div
                          key={`${group.group_id}-${table}`}
                          className="flex items-center bg-gray-50 rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="text-[#0F172A]">{table}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDeleteTable(group.group_name, table)
                            }
                            className="ml-2 text-gray-400 hover:text-red-600"
                            disabled={isLoading}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() =>
            setConfirmDialog({ isOpen: false, groupId: "", groupName: "" })
          }
          onConfirm={() => {
            confirmDeleteGroup(confirmDialog.groupId);
            setConfirmDialog({ isOpen: false, groupId: "", groupName: "" });
          }}
          title="Confirm Deletion"
          description={`Are you sure you want to delete "${confirmDialog.groupName}"? This action cannot be undone.`}
        />

        {/* Create Group Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
            <div className="flex flex-col gap-0">
              <div className="px-6 pt-6 pb-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col gap-1">
                    <DialogTitle className="text-xl font-semibold text-[#0F172A]">
                      Create New Group
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                      Enter a name for the new group to manage table permissions.
                    </DialogDescription>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Group Name
                    </Label>
                    <Input
                      placeholder="Enter group name"
                      value={newGroupName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[A-Za-z\s_-]*$/.test(value)) {
                          setNewGroupName(value);
                        }
                      }}
                      className={`w-full p-2.5 rounded-md border ${
                        newGroupName && !validateGroupName(newGroupName).isValid
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-200 focus:ring-[#0F172A]/10 focus:border-[#0F172A]"
                      } bg-white`}
                    />
                    {newGroupName && !validateGroupName(newGroupName).isValid && (
                      <p className="text-sm text-red-500 mt-1">
                        {validateGroupName(newGroupName).message}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Group name should contain only letters, spaces, underscores, and hyphens.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setNewGroupName("");
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F172A]/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  disabled={isLoading || !validateGroupName(newGroupName).isValid}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F172A] hover:bg-[#0F172A]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F172A]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    "Create Group"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Tables Dialog */}
        <Dialog
          open={isAddTablesDialogOpen}
          onOpenChange={setIsAddTablesDialogOpen}
        >
          <DialogContent className="bg-white p-6">
            <DialogHeader>
              <DialogTitle>Add Tables to Group</DialogTitle>
              <DialogDescription>
                Select tables to add to {selectedGroup?.group_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {selectedGroup &&
                availableTables
                  .filter((table) => {
                    const groupTables = selectedGroup.tables || [];
                    return !groupTables.includes(table);
                  })
                  .map((table) => (
                    <div
                      key={table}
                      className="flex items-center space-x-2 py-2"
                    >
                      <Checkbox
                        id={table}
                        checked={selectedTables.includes(table)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTables([...selectedTables, table]);
                          } else {
                            setSelectedTables(
                              selectedTables.filter((t) => t !== table)
                            );
                          }
                        }}
                        disabled={isLoading}
                      />
                      <Label htmlFor={table} className="text-[#0F172A]">
                        {table}
                      </Label>
                    </div>
                  ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddTablesDialogOpen(false);
                  setSelectedTables([]);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddTablesToGroup}
                className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                disabled={isLoading || selectedTables.length === 0}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Adding...</span>
                  </div>
                ) : (
                  "Add Selected Tables"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          isOpen={confirmTableDialog.isOpen}
          onClose={() =>
            setConfirmTableDialog({ isOpen: false, groupName: "", tableName: "" })
          }
          onConfirm={() => {
            confirmDeleteTable(confirmTableDialog.groupName, confirmTableDialog.tableName);
            setConfirmTableDialog({ isOpen: false, groupName: "", tableName: "" });
          }}
          title="Confirm Table Removal"
          description={`Are you sure you want to remove "${confirmTableDialog.tableName}" from the group "${confirmTableDialog.groupName}"? This action cannot be undone.`}
        />

        {/* Edit Group Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
            <div className="flex flex-col gap-0">
              <div className="px-6 pt-6 pb-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-full">
                      <Edit className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <DialogTitle className="text-xl font-semibold text-[#0F172A]">
                        Edit Group Name
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-500">
                        Update the name for this group.
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Group Name
                    </Label>
                    <Input
                      placeholder="Enter group name"
                      value={editingGroupName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[A-Za-z\s_-]*$/.test(value)) {
                          setEditingGroupName(value);
                        }
                      }}
                      className={`w-full p-2.5 rounded-md border ${
                        editingGroupName && !validateGroupName(editingGroupName, oldGroupName).isValid
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-200 focus:ring-[#0F172A]/10 focus:border-[#0F172A]"
                      } bg-white`}
                    />
                    {editingGroupName && !validateGroupName(editingGroupName, oldGroupName).isValid && (
                      <p className="text-sm text-red-500 mt-1">
                        {validateGroupName(editingGroupName, oldGroupName).message}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Group name should contain only letters, spaces, underscores, and hyphens.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingGroupName("");
                    setOldGroupName("");
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F172A]/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateGroupName}
                  disabled={isLoading || !validateGroupName(editingGroupName, oldGroupName).isValid || editingGroupName === oldGroupName}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Edit className="h-4 w-4 mr-2" />
                      <span>Update Group</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GroupConfiguration;