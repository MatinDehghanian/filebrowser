"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useSWR from "swr";
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
import { useIsAdmin } from "@/contexts/auth-context";
import api from "@/lib/api";
import type { DeepPartial, Settings, ViewMode } from "@/types";

export default function GlobalSettingsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: settings, mutate, isLoading } = useSWR<Settings>(
    "settings",
    () => api.getSettings()
  );

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<DeepPartial<Settings>>({});

  useEffect(() => {
    if (!isAdmin) {
      navigate("/files/", { replace: true });
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  // Initialize form data when settings load
  const currentSettings = { ...settings, ...formData };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);

    try {
      await toast.promise(
        (async () => {
          await api.updateSettings(formData);
          await mutate();
          setFormData({});
        })(),
        {
          loading: "Saving settings...",
          success: "Settings saved successfully",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to save settings",
        },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const updateBranding = (key: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      branding: {
        ...(settings?.branding || {}),
        ...(prev.branding || {}),
        [key]: value,
      },
    }));
  };

  const updateDefaults = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      defaults: {
        ...(settings?.defaults || {}),
        ...(prev.defaults || {}),
        [key]: value,
      },
    }));
  };

  const updateDefaultPerm = (key: string, value: boolean) => {
    const currentPerm = {
      ...(settings?.defaults?.perm || {}),
      ...(formData.defaults?.perm || {}),
    };
    updateDefaults("perm", { ...currentPerm, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="text-center py-16">
          <p className="text-destructive">Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Global Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and defaults
        </p>
      </div>

      <div className="space-y-6">
        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Customize the appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Instance Name</Label>
              <Input
                id="brand-name"
                value={currentSettings.branding?.name || ""}
                onChange={(e) => updateBranding("name", e.target.value)}
                placeholder="File Browser"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Disable External Links</Label>
                <p className="text-sm text-muted-foreground">
                  Hide links to external resources
                </p>
              </div>
              <Switch
                checked={currentSettings.branding?.disableExternal ?? false}
                onCheckedChange={(v) => updateBranding("disableExternal", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Disable Usage Percentage</Label>
                <p className="text-sm text-muted-foreground">
                  Hide storage usage percentage in the sidebar
                </p>
              </div>
              <Switch
                checked={currentSettings.branding?.disableUsedPercentage ?? false}
                onCheckedChange={(v) => updateBranding("disableUsedPercentage", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Signup Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Registration</CardTitle>
            <CardDescription>User registration settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Signup</Label>
                <p className="text-sm text-muted-foreground">
                  Allow new users to register
                </p>
              </div>
              <Switch
                checked={currentSettings.signup ?? false}
                onCheckedChange={(v) => updateField("signup", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Create User Directory</Label>
                <p className="text-sm text-muted-foreground">
                  Create a home directory for new users
                </p>
              </div>
              <Switch
                checked={currentSettings.createUserDir ?? false}
                onCheckedChange={(v) => updateField("createUserDir", v)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-home-base">User Home Base Path</Label>
              <Input
                id="user-home-base"
                value={currentSettings.userHomeBasePath || ""}
                onChange={(e) => updateField("userHomeBasePath", e.target.value)}
                placeholder="/users"
              />
              <p className="text-xs text-muted-foreground">
                Base path for user home directories (e.g., /users will create /users/username)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Default User Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Default User Settings</CardTitle>
            <CardDescription>
              Default settings for new users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-scope">Default Scope</Label>
              <Input
                id="default-scope"
                value={currentSettings.defaults?.scope || ""}
                onChange={(e) => updateDefaults("scope", e.target.value)}
                placeholder="/"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-view">Default View Mode</Label>
              <Select
                value={currentSettings.defaults?.viewMode || "list"}
                onValueChange={(v) => updateDefaults("viewMode", v as ViewMode)}
              >
                <SelectTrigger id="default-view">
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

            <div className="space-y-3">
              <Label>Default Permissions</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Create</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.create ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("create", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Rename</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.rename ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("rename", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Modify</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.modify ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("modify", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Delete</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.delete ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("delete", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Share</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.share ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("share", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Download</Label>
                  <Switch
                    checked={currentSettings.defaults?.perm?.download ?? true}
                    onCheckedChange={(v) => updateDefaultPerm("download", v)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || Object.keys(formData).length === 0}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
