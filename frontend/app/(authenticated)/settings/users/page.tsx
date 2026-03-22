"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Shield, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsAdmin } from "@/contexts/auth-context";
import api from "@/lib/api";
import type { User, Permissions } from "@/types";

const DEFAULT_PERMISSIONS: Permissions = {
  admin: false,
  execute: true,
  create: true,
  rename: true,
  modify: true,
  delete: true,
  share: true,
  download: true,
};

interface UserFormData {
  username: string;
  password: string;
  currentPassword: string;
  scope: string;
  perm: Permissions;
  lockPassword: boolean;
}

const INITIAL_FORM: UserFormData = {
  username: "",
  password: "",
  currentPassword: "",
  scope: "/",
  perm: DEFAULT_PERMISSIONS,
  lockPassword: false,
};

export default function UsersSettingsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: users, mutate, isLoading } = useSWR<User[]>("users", () => api.getUsers());
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState("");
  const [formData, setFormData] = useState<UserFormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/files/", { replace: true });
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: "",
        scope: user.scope,
        perm: user.perm,
        lockPassword: user.lockPassword,
      });
    } else {
      setEditingUser(null);
      setFormData(INITIAL_FORM);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData(INITIAL_FORM);
  };

  const handleSubmit = async () => {
    if (!formData.username) {
      toast.error("Username is required");
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    if (!formData.currentPassword) {
      toast.error("Your current password is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const userData: Partial<User> = {
        username: formData.username,
        scope: formData.scope || "/",
        perm: formData.perm,
        lockPassword: formData.lockPassword,
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      if (editingUser) {
        await api.updateUser(editingUser.id, userData, {
          currentPassword: formData.currentPassword,
        });
        toast.success("User updated successfully");
      } else {
        await api.createUser(userData, {
          currentPassword: formData.currentPassword,
        });
        toast.success("User created successfully");
      }

      mutate();
      handleCloseDialog();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save user"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    if (!deleteCurrentPassword) {
      toast.error("Your current password is required");
      return;
    }

    try {
      await api.deleteUser(deleteUser.id, {
        currentPassword: deleteCurrentPassword,
      });
      toast.success("User deleted successfully");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user"
      );
    } finally {
      setDeleteUser(null);
      setDeleteCurrentPassword("");
    }
  };

  const updatePermission = (key: keyof Permissions, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      perm: { ...prev.perm, [key]: value },
    }));
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            All registered users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <h3 className="font-medium">No users found</h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {user.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {user.scope}
                      </code>
                    </TableCell>
                    <TableCell>
                      {user.perm.admin ? (
                        <Badge className="gap-1">
                          <Shield className="h-3 w-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <UserIcon className="h-3 w-3" />
                          User
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.perm.create && (
                          <Badge variant="outline" className="text-xs">Create</Badge>
                        )}
                        {user.perm.delete && (
                          <Badge variant="outline" className="text-xs">Delete</Badge>
                        )}
                        {user.perm.share && (
                          <Badge variant="outline" className="text-xs">Share</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUser(user)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Create User"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
                disabled={!!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editingUser && "(leave empty to keep current)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current-password">Your Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={formData.currentPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="Required for creating/updating users"
              />
              <p className="text-xs text-muted-foreground">
                Enter your own admin password to confirm this action.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Input
                id="scope"
                value={formData.scope}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, scope: e.target.value }))
                }
                placeholder="/"
              />
              <p className="text-xs text-muted-foreground">
                The directory this user can access (e.g., /home/user)
              </p>
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-admin" className="font-normal">Administrator</Label>
                  <Switch
                    id="perm-admin"
                    checked={formData.perm.admin}
                    onCheckedChange={(v) => updatePermission("admin", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-create" className="font-normal">Create</Label>
                  <Switch
                    id="perm-create"
                    checked={formData.perm.create}
                    onCheckedChange={(v) => updatePermission("create", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-rename" className="font-normal">Rename</Label>
                  <Switch
                    id="perm-rename"
                    checked={formData.perm.rename}
                    onCheckedChange={(v) => updatePermission("rename", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-modify" className="font-normal">Modify</Label>
                  <Switch
                    id="perm-modify"
                    checked={formData.perm.modify}
                    onCheckedChange={(v) => updatePermission("modify", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-delete" className="font-normal">Delete</Label>
                  <Switch
                    id="perm-delete"
                    checked={formData.perm.delete}
                    onCheckedChange={(v) => updatePermission("delete", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-share" className="font-normal">Share</Label>
                  <Switch
                    id="perm-share"
                    checked={formData.perm.share}
                    onCheckedChange={(v) => updatePermission("share", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-download" className="font-normal">Download</Label>
                  <Switch
                    id="perm-download"
                    checked={formData.perm.download}
                    onCheckedChange={(v) => updatePermission("download", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="perm-execute" className="font-normal">Execute</Label>
                  <Switch
                    id="perm-execute"
                    checked={formData.perm.execute}
                    onCheckedChange={(v) => updatePermission("execute", v)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="lock-password">Lock Password</Label>
                <p className="text-xs text-muted-foreground">
                  Prevent user from changing their password
                </p>
              </div>
              <Switch
                id="lock-password"
                checked={formData.lockPassword}
                onCheckedChange={(v) =>
                  setFormData((prev) => ({ ...prev, lockPassword: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingUser
                ? "Save Changes"
                : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteUser(null);
            setDeleteCurrentPassword("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user &quot;{deleteUser?.username}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-current-password">Your Current Password</Label>
            <Input
              id="delete-current-password"
              type="password"
              value={deleteCurrentPassword}
              onChange={(event) => setDeleteCurrentPassword(event.target.value)}
              placeholder="Required to confirm deletion"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
