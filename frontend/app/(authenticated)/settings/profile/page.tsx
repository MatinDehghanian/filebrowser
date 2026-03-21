"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth, useUser } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import type { ViewMode } from "@/types";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "zh-cn", label: "Chinese (Simplified)" },
  { value: "zh-tw", label: "Chinese (Traditional)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
];

export default function ProfileSettingsPage() {
  const user = useUser();
  const { updateUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [locale, setLocale] = useState(user.locale);
  const [viewMode, setViewMode] = useState<ViewMode>(user.viewMode);
  const [singleClick, setSingleClick] = useState(user.singleClick);
  const [hideDotfiles, setHideDotfiles] = useState(user.hideDotfiles);
  const [dateFormat, setDateFormat] = useState(user.dateFormat);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      await toast.promise(
        api.updateUser(user.id, { password: newPassword }, { currentPassword }),
        {
          loading: "Changing password...",
          success: "Password changed successfully",
          error: (error) =>
            error instanceof Error
              ? error.message
              : "Failed to change password",
        },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);

    try {
      const request = api.updateUser(user.id, {
        locale,
        viewMode,
        singleClick,
        hideDotfiles,
        dateFormat,
      });

      toast.promise(request, {
        loading: "Saving preferences...",
        success: "Preferences saved successfully",
        error: (error) =>
          error instanceof Error ? error.message : "Failed to save preferences",
      });

      const updatedUser = await request;
      updateUser(updatedUser);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={user.username} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={user.perm.admin ? "Administrator" : "User"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Input value={user.scope || "/"} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        {!user.lockPassword && (
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="locale">Language</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="view-mode">Default View Mode</Label>
              <Select
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
              >
                <SelectTrigger id="view-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="mosaic">Grid</SelectItem>
                  <SelectItem value="mosaic gallery">Gallery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Single Click</Label>
                <p className="text-sm text-muted-foreground">
                  Open files and folders with a single click
                </p>
              </div>
              <Switch checked={singleClick} onCheckedChange={setSingleClick} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Hide Dotfiles</Label>
                <p className="text-sm text-muted-foreground">
                  Hide files and folders starting with a dot
                </p>
              </div>
              <Switch
                checked={hideDotfiles}
                onCheckedChange={setHideDotfiles}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Relative Dates</Label>
                <p className="text-sm text-muted-foreground">
                  Show dates as relative (e.g., &quot;2 hours ago&quot;)
                </p>
              </div>
              <Switch checked={dateFormat} onCheckedChange={setDateFormat} />
            </div>

            <Button onClick={handleSavePreferences} disabled={isSavingPrefs}>
              {isSavingPrefs ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
