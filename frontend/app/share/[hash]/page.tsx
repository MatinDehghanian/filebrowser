"use client";

import { useState, useEffect, use } from "react";
import { Download, FolderOpen, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon } from "@/components/files/file-icon";
import { formatBytes, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem, FileListingResponse } from "@/types";

interface SharePageProps {
  params: Promise<{ hash: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const { hash } = resolvedParams;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<FileItem | FileListingResponse | null>(null);
  const [currentPath, setCurrentPath] = useState("");

  const fetchShare = async (path = "", pwd?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // For password-protected shares, we need to pass the password
      // The API might use a token approach or direct password
      const result = await api.getPublicShare(hash, path);
      setData(result);
      setCurrentPath(path);
      setNeedsPassword(false);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("password") || err.message.includes("401")) {
          setNeedsPassword(true);
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load share");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [hash]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Please enter the password");
      return;
    }

    setIsSubmitting(true);

    try {
      // Note: The actual password handling depends on the API implementation
      // This might need adjustment based on how the backend handles password-protected shares
      await fetchShare(currentPath, password);
    } catch (err) {
      toast.error("Invalid password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = (path = "") => {
    const url = api.getPublicDownloadUrl(hash, path);
    window.open(url, "_blank");
  };

  const handleNavigate = (item: FileItem) => {
    if (item.isDir) {
      fetchShare(item.path);
    } else {
      handleDownload(item.path);
    }
  };

  const handleNavigateUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const parentPath = parts.length > 0 ? "/" + parts.join("/") : "";
    fetchShare(parentPath);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading share...</p>
        </div>
      </div>
    );
  }

  // Password required
  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Password Required</CardTitle>
            <CardDescription>
              This share is protected with a password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Verifying..." : "Access Share"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Share Not Found</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This share may have expired or been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No data
  if (!data) {
    return null;
  }

  // Check if it's a directory listing
  const isDirectory = "items" in data && Array.isArray((data as FileListingResponse).items);
  const items = isDirectory ? (data as FileListingResponse).items : [];
  const fileData = !isDirectory ? (data as FileItem) : null;

  // Single file view
  if (fileData && !fileData.isDir) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <FileIcon name={fileData.name} isDir={false} size="lg" />
            </div>
            <CardTitle className="break-all">{fileData.name}</CardTitle>
            <CardDescription>
              {formatBytes(fileData.size)} &middot; {formatDate(fileData.modified)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => handleDownload()}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Directory listing
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>
                    {currentPath ? currentPath.split("/").pop() : "Shared Folder"}
                  </CardTitle>
                  <CardDescription>
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => handleDownload(currentPath)}>
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Breadcrumb */}
            {currentPath && (
              <div className="mb-4 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateUp}
                >
                  .. Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPath}
                </span>
              </div>
            )}

            {/* File List */}
            <ScrollArea className="h-[60vh]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">This folder is empty</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {items
                    .sort((a, b) => {
                      // Folders first
                      if (a.isDir && !b.isDir) return -1;
                      if (!a.isDir && b.isDir) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((item) => (
                      <button
                        key={item.path}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                        onClick={() => handleNavigate(item)}
                      >
                        <FileIcon name={item.name} isDir={item.isDir} size="md" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="truncate font-medium">{item.name}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.isDir ? "-" : formatBytes(item.size)}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
