import React, { useState, useCallback, useEffect } from "react";
import { Edit2, Eye, Ban, X, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  createUser,
  getAllUsers,
  updateUser,
  toggleUserActive,
  User,
} from "@/services/userApi";
import { useToast } from "@/hooks/use-toast";
import { UserApiResponse, DialogState } from "@/types/user";
import { Pagination } from "@/components/Pagination";

const INITIAL_USER_STATE: User = {
  firstName: "",
  lastName: "",
  email: "",
  role: "maker",
};

const UserManagement: React.FC = () => {
  const { toast } = useToast();

  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<User>(INITIAL_USER_STATE);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({
    disable: { open: false, user: null },
    edit: { open: false },
    create: { open: false },
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // To match the screenshot showing 8 items

  // Calculate pagination
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  // Load users from backend
  const loadUsers = useCallback(
    async (query: string) => {
      try {
        const response = await getAllUsers(query);
        if (response.success) {
          const transformedUsers = response.data.map(
            (user: UserApiResponse) => ({
              id: user.user_id,
              firstName: user.first_name,
              lastName: user.last_name,
              email: user.email,
              role: user.role,
              isDisabled: !user.active, // When active is false in DB, user is disabled
            })
          );
          setUsers(transformedUsers);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load users";
        toast({
          title: "Error",
          description: errorMessage,
          className: "bg-[#003087] text-white border-none",
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    loadUsers(searchQuery);
  }, [loadUsers]);

  const handleSearch = () => {
    loadUsers(searchQuery); // Fetch users based on search query
  };

  const handleclear = () => {
    setSearchQuery("");
    loadUsers(""); // Fetch users based on search query
  };

  // Form validation
  const validateForm = useCallback((user: User): Record<string, string> => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!user.firstName?.trim()) errors.firstName = "First name is required";
    if (!user.lastName?.trim()) errors.lastName = "Last name is required";
    if (!user.email?.trim()) errors.email = "Email is required";
    if (!emailRegex.test(user.email)) errors.email = "Invalid email format";

    return errors;
  }, []);

  // Handle user disable/enable
  const handleToggleUserActive = async (user: User) => {
    setDialogState((prev) => ({
      ...prev,
      disable: { open: true, user },
    }));
  };

  const confirmToggleUserActive = async () => {
    const user = dialogState.disable.user;
    if (!user?.email) return;

    try {
      const response = await toggleUserActive(user.email);
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
          className: "bg-[#003087] text-white border-none",
        });

        // Update local state based on the response from server
        if (response.data?.active !== undefined) {
          setUsers((prevUsers) =>
            prevUsers.map((u) =>
              u.email === user.email
                ? { ...u, isDisabled: !response.data!.active }
                : u
            )
          );
        }
        // Reload users to ensure we're in sync with the database
        loadUsers(searchQuery);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update user status",
        className: "bg-[#003087] text-white border-none",
      });
      // Refresh users list to ensure UI is in sync with database
      loadUsers(searchQuery);
    } finally {
      setDialogState((prev) => ({
        ...prev,
        disable: { open: false, user: null },
      }));
    }
  };

  // Render helpers
  const renderFormInput = useCallback(
    (
      field: keyof User,
      label: string,
      type: string = "text",
      value: string,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => (
      <div className="grid gap-2">
        <Input
          type={type}
          placeholder={label}
          value={value}
          onChange={onChange}
          className={errors[field] ? "border-red-500" : ""}
          aria-label={label}
          aria-invalid={!!errors[field]}
        />
        {errors[field] && (
          <p className="text-red-500 text-sm" role="alert">
            {errors[field]}
          </p>
        )}
      </div>
    ),
    [errors]
  );

  // Create user handler
  const handleCreateUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const validationErrors = validateForm(newUser);

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        toast({
          title: "Validation Error",
          description: "Please fix the errors in the form",
          className: "bg-[#003087] text-white border-none",
        });
        return;
      }

      try {
        const response = await createUser(newUser);
        if (response.success) {
          setNewUser(INITIAL_USER_STATE);
          setErrors({});
          loadUsers(searchQuery);
          toast({
            title: "Success",
            description: "User created successfully",
            className: "bg-[#003087] text-white border-none",
          });
          setDialogOpen(false);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to perform operation";
        toast({
          title: "Error",
          description: errorMessage,
          className: "bg-[#003087] text-white border-none",
        });
      }
    },
    [newUser, validateForm, toast, loadUsers]
  );

  // Handle edit click
  const handleEditClick = useCallback((user: User) => {
    setEditingUser({ ...user });
    setDialogState((prev) => ({
      ...prev,
      edit: { open: true },
    }));
    setErrors({});
  }, []);

  // Update user handler
  const handleUpdateUser = useCallback(async () => {
    if (!editingUser?.id) return;

    const validationErrors = validateForm(editingUser);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        className: "bg-[#003087] text-white border-none",
      });
      return;
    }

    try {
      const response = await updateUser(editingUser.id.toString(), {
        email: editingUser.email,
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        role: editingUser.role,
        // password: editingUser.password, // Only included if changed
      });

      if (response.success) {
        setDialogState((prev) => ({ ...prev, edit: { open: false } }));
        setEditingUser(null);
        setErrors({});
        loadUsers(searchQuery);
        toast({
          title: "Success",
          description: "User updated successfully",
          className: "bg-[#003087] text-white border-none",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user";
      toast({
        title: "Error",
        description: errorMessage,
        className: "bg-[#003087] text-white border-none",
      });
    }
  }, [editingUser, validateForm, toast, loadUsers]);

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          User Management
        </h1>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center ">
          {/* Search Input */}
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              placeholder="Search by name or email..."
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex space-x-2">
            <Button
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-400 transition-colors"
              onClick={handleclear}
            >
              Clear
            </Button>
            <Button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 transition-colors"
              onClick={handleSearch}
            >
              Search
            </Button>
          </div>
        </div>

        <Button
          onClick={() => {
            setDialogState((prev) => ({ ...prev, create: { open: true } }));
            setDialogOpen(true);
          }}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-md"
        >
          + Create New User
        </Button>
      </div>

      <Card className="border border-gray-200 shadow-sm rounded-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white border-b">
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-[80px]">
                    Edit
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-[80px]">
                    Action
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-[60px]">
                    No
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">
                    Name
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">
                    Email
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-[100px]">
                    Role
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500 w-[100px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user, index) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(user)}
                        className="text-blue-600 hover:bg-blue-50 p-2 h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleUserActive(user)}
                        className={`hover:bg-${
                          user.isDisabled ? "green" : "red"
                        }-50 p-2 h-8 w-8`}
                      >
                        {user.isDisabled ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <Ban className="h-4 w-4 text-red-600" />
                        )}
                      </Button>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {startIndex + index + 1}
                    </td>
                    <td className="p-4 text-sm text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{user.email}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
                        ${
                          user.role === "maker"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
                        ${
                          user.isDisabled
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {user.isDisabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedUsers.length === 0 && (
              <div className="flex justify-center items-center h-32">
                <p className="text-gray-500 text-lg font-semibold">
                  No users found
                </p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-white border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-4 relative">
            <button
              onClick={() => {
                setDialogState((prev) => ({
                  ...prev,
                  create: { open: false },
                }));
                setDialogOpen(false);
              }}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Create New User
              </DialogTitle>
              <DialogDescription>
                Fill in the user details below. All fields are required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-poppins">
                {renderFormInput(
                  "firstName",
                  "First Name",
                  "text",
                  newUser.firstName,
                  (e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                )}
                {renderFormInput(
                  "lastName",
                  "Last Name",
                  "text",
                  newUser.lastName,
                  (e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                )}
                {renderFormInput(
                  "email",
                  "Email",
                  "email",
                  newUser.email,
                  (e) =>
                    setNewUser((prev) => ({ ...prev, email: e.target.value }))
                )}

                <div className="space-y-2">
                  <Select
                    value={newUser.role}
                    onValueChange={(value: "maker" | "checker" | "admin") =>
                      setNewUser((prev) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maker">Maker</SelectItem>
                      <SelectItem value="checker">Checker</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit User Dialog */}
      <Dialog
        open={dialogState.edit.open}
        onOpenChange={(open) =>
          setDialogState((prev) => ({ ...prev, edit: { open } }))
        }
      >
        <DialogContent className="bg-white font-poppins p-4 relative">
          <button
            onClick={() =>
              setDialogState((prev) => ({ ...prev, edit: { open: false } }))
            }
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader>
            <DialogTitle className="font-poppins">Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="edit-firstName" className="font-poppins">
                  First Name
                </label>
                <Input
                  id="edit-firstName"
                  value={editingUser?.firstName || ""}
                  onChange={(e) =>
                    setEditingUser((prev) =>
                      prev ? { ...prev, firstName: e.target.value } : null
                    )
                  }
                  className={`${
                    errors.firstName ? "border-red-500" : ""
                  } font-poppins`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm font-poppins">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-lastName" className="font-poppins">
                  Last Name
                </label>
                <Input
                  id="edit-lastName"
                  value={editingUser?.lastName || ""}
                  onChange={(e) =>
                    setEditingUser((prev) =>
                      prev ? { ...prev, lastName: e.target.value } : null
                    )
                  }
                  className={`${
                    errors.lastName ? "border-red-500" : ""
                  } font-poppins`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm font-poppins">
                    {errors.lastName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-email" className="font-poppins">
                  Email
                </label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser?.email || ""}
                  readOnly
                  className={`${
                    errors.email ? "border-red-500" : ""
                  } font-poppins`}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm font-poppins">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-role" className="font-poppins">
                  Role
                </label>
                <Select
                  value={editingUser?.role || ""}
                  onValueChange={(value: "maker" | "checker" | "admin") =>
                    setEditingUser((prev) =>
                      prev ? { ...prev, role: value } : null
                    )
                  }
                >
                  <SelectTrigger className="font-poppins">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white font-poppins">
                    <SelectItem value="maker">Maker</SelectItem>
                    <SelectItem value="checker">Checker</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogState((prev) => ({ ...prev, edit: { open: false } }));
                setEditingUser(null);
                setErrors({});
              }}
              className="font-poppins"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} className="font-poppins">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable/Enable User Confirmation Dialog */}
      <Dialog
        open={dialogState.disable.open}
        onOpenChange={(open) =>
          setDialogState((prev) => ({
            ...prev,
            disable: { ...prev.disable, open },
          }))
        }
      >
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
          <div className="flex flex-col gap-0">
            {/* Header Section */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-xl font-semibold text-[#0F172A]">
                    {dialogState.disable.user?.isDisabled
                      ? "Enable User"
                      : "Disable User"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {dialogState.disable.user?.isDisabled
                      ? "This action will restore user access to the system."
                      : "This action will revoke user access to the system."}
                  </DialogDescription>
                </div>
                <button
                  onClick={() =>
                    setDialogState((prev) => ({
                      ...prev,
                      disable: { open: false, user: null },
                    }))
                  }
                  className="rounded-md p-1.5 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>

            {/* Content Section */}
            <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {dialogState.disable.user?.isDisabled ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Ban className="h-5 w-5 text-red-600" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium text-[#0F172A]">
                      {dialogState.disable.user?.firstName}{" "}
                      {dialogState.disable.user?.lastName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {dialogState.disable.user?.email}
                    </span>
                  </div>
                </div>

                {!dialogState.disable.user?.isDisabled && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-md">
                    <p className="text-sm text-amber-800">
                      This user will no longer be able to access the system
                      until re-enabled. All active sessions will be terminated.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Section */}
            <div className="px-6 py-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setDialogState((prev) => ({
                    ...prev,
                    disable: { open: false, user: null },
                  }))
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                variant={
                  dialogState.disable.user?.isDisabled
                    ? "default"
                    : "destructive"
                }
                onClick={confirmToggleUserActive}
                className={`px-4 py-2 text-sm font-medium ${
                  dialogState.disable.user?.isDisabled
                    ? "bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {dialogState.disable.user?.isDisabled
                  ? "Enable User"
                  : "Disable User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
