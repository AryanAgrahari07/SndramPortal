import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Database, Table, List } from "lucide-react";
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

interface TableGroup {
  group_id: string;
  group_name: string;
  tables: string[];
}

interface ApiGroupResponse {
  success: boolean;
  data: {
    group_name: string;
    table_list: string[];
    row_id: string | null;
  }[];
}

const GroupConfiguration: React.FC = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<TableGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TableGroup | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddTablesDialogOpen, setIsAddTablesDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  useEffect(() => {
    fetchGroups();
    fetchAvailableTables();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/getGroupList", {
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        const tableNames = data.tables.map(
          (table: { table_name: string }) => table.table_name
        );
        setAvailableTables(tableNames);
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/addGroup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_name: newGroupName.trim() }),
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

  const handleDeleteGroup = async (group: TableGroup) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/removeGroup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group_name: group.group_name }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchGroups();
        toast({
          title: "Success",
          description: "Group deleted successfully",
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

  const handleDeleteTable = async (groupName: string, tableName: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8080/removeTable", {
        method: "POST",
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
        <div className="flex items-center justify-between text-[#0F172A] mb-8 ">
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
                  <div className="flex gap-2">
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

        {/* Create Group Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-white p-6">
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Enter a name for the new group to manage table permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  placeholder="Enter group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="border-gray-200 focus:ring-[#0F172A] focus:border-[#0F172A]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setNewGroupName("");
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateGroup}
                className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  "Create Group"
                )}
              </Button>
            </DialogFooter>
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
                    // Ensure selectedGroup.tables is not null or undefined
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
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
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
      </div>
    </div>
  );
};

export default GroupConfiguration;
