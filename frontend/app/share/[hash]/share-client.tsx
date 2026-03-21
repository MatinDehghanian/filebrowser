"use client";

import { useCallback, useState, useEffect } from "react";
import Image from "next/image";
import {
  Download,
  FolderOpen,
  Eye,
  EyeOff,
  FileText,
  X,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileIcon } from "@/components/files/file-icon";
import { ShareQrDialog } from "@/components/share/share-qr-dialog";
import { formatBytes, formatDate, getFileType } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem, FileListingResponse } from "@/types";

const PLACEHOLDER_HASH = "placeholder";

interface ShareClientProps {
  initialHash: string;
}

export default function ShareClient({ initialHash }: ShareClientProps) {
  const [hash, setHash] = useState(initialHash);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<FileItem | FileListingResponse | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isShareQrOpen, setIsShareQrOpen] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  const isTextLikeFile = (item: FileItem) => {
    if (item.isDir) {
      return false;
    }

    const fileType = getFileType(item.name, item.isDir);
    const lowerName = item.name.toLowerCase();
    const mimeType = (item.type || "").toLowerCase();

    if (fileType === "code") {
      return true;
    }

    if (
      mimeType.startsWith("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("xml") ||
      mimeType.includes("yaml") ||
      mimeType.includes("javascript") ||
      mimeType.includes("typescript") ||
      mimeType.includes("shell")
    ) {
      return true;
    }

    if (
      lowerName === "dockerfile" ||
      lowerName === "makefile" ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".log") ||
      lowerName.endsWith(".conf") ||
      lowerName.endsWith(".ini") ||
      lowerName.endsWith(".toml") ||
      lowerName.endsWith(".env")
    ) {
      return true;
    }

    return false;
  };

  const fetchShare = useCallback(async (path = "", pwd?: string) => {
    setIsLoading(true);
    setError(null);
    const effectivePassword = pwd ?? sharePassword;

    try {
      const result = await api.getPublicShare(
        hash,
        path,
        effectivePassword || undefined,
      );
      setData(result);
      setCurrentPath(path);
      setSelectedPaths([]);
      setNeedsPassword(false);
      if (effectivePassword) {
        setSharePassword(effectivePassword);
      }
    } catch (err) {
      const apiError = err as { status?: number; message?: string };
      const message =
        apiError?.message ?? (err instanceof Error ? err.message : "");

      if (
        apiError?.status === 401 ||
        message.includes("password") ||
        message.includes("401") ||
        message.includes("Unauthorized")
      ) {
        if (pwd) {
          setSharePassword("");
        }
        setNeedsPassword(true);
      } else {
        setError(message || "Failed to load share");
      }
    } finally {
      setIsLoading(false);
    }
  }, [hash, sharePassword]);

  useEffect(() => {
    if (hash !== PLACEHOLDER_HASH) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "share" && parts[1]) {
      setHash(parts[1]);
    } else {
      setError("Invalid share link");
      setIsLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    if (!hash || hash === PLACEHOLDER_HASH) {
      return;
    }

    fetchShare();
  }, [fetchShare, hash]);

  useEffect(() => {
    const modalPreviewItem = isPreviewOpen ? previewItem : null;
    const singleFilePreviewItem =
      data &&
      !(
        "items" in data && Array.isArray((data as FileListingResponse).items)
      ) &&
      !(data as FileItem).isDir
        ? (data as FileItem)
        : null;

    const activePreviewItem = modalPreviewItem ?? singleFilePreviewItem;

    if (!activePreviewItem) {
      setPreviewText("");
      setIsPreviewLoading(false);
      return;
    }

    if (!isTextLikeFile(activePreviewItem)) {
      setPreviewText("");
      setIsPreviewLoading(false);
      return;
    }

    const token =
      activePreviewItem.token || (data as { token?: string })?.token;
    const contentUrl = api.getPublicDownloadUrl(
      hash,
      activePreviewItem.path,
      true,
      token,
    );
    const abortController = new AbortController();

    setIsPreviewLoading(true);
    fetch(contentUrl, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load file preview");
        }
        return res.text();
      })
      .then((text) => setPreviewText(text))
      .catch(() => setPreviewText("Failed to load file preview"))
      .finally(() => setIsPreviewLoading(false));

    return () => {
      abortController.abort();
    };
  }, [previewItem, isPreviewOpen, hash, data]);

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
    } catch {
      toast.error("Invalid password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShareToken = (item?: FileItem | null) => {
    return item?.token || (data as { token?: string })?.token;
  };

  const handleDownload = (path = "", item?: FileItem | null) => {
    const token = getShareToken(item);
    const url = api.getPublicDownloadUrl(hash, path, false, token);
    window.open(url, "_blank");
  };

  const openPreview = (item: FileItem) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const getInlineUrl = (item: FileItem) => {
    const token = getShareToken(item);
    return api.getPublicDownloadUrl(hash, item.path, true, token);
  };

  const handleItemClick = (item: FileItem) => {
    if (item.isDir) {
      fetchShare(item.path);
      return;
    }

    if (item.type?.startsWith("image")) {
      openPreview(item);
      return;
    }

    if (isTextLikeFile(item)) {
      openPreview(item);
      return;
    }

    handleDownload(item.path, item);
  };

  const handleBack = () => {
    if (!currentPath) {
      return;
    }

    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    fetchShare(parentPath);
  };

  const togglePathSelection = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const handleBulkDownload = () => {
    if (!selectedPaths.length) {
      return;
    }

    selectedPaths.forEach((path) => handleDownload(path));
  };

  const renderPreview = (item: FileItem | null) => {
    if (!item) {
      return null;
    }

    if (item.type?.startsWith("image")) {
      return (
        <Image
          src={getInlineUrl(item)}
          alt={item.name}
          width={1200}
          height={800}
          sizes="100vw"
          className="max-h-[70vh] w-full object-contain"
        />
      );
    }

    if (isTextLikeFile(item)) {
      return (
        <ScrollArea className="max-h-[70vh] rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm">{previewText}</pre>
        </ScrollArea>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p>This file type cannot be previewed.</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading share...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border p-6 text-center">
          <h1 className="text-2xl font-semibold">Share not available</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Protected Share</CardTitle>
            <CardDescription>
              This share is protected with a password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter the share password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Unlocking..." : "Unlock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const listing = "items" in data ? (data as FileListingResponse) : null;
  const file = listing ? null : (data as FileItem);
  const canInlinePreview =
    !!file &&
    (file.type?.startsWith("image") || isTextLikeFile(file));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Shared via File Browser</p>
            <h1 className="text-2xl font-semibold">
              {listing?.name ?? file?.name ?? "Shared file"}
            </h1>
            {listing && (
              <p className="text-sm text-muted-foreground">
                {listing.items.length} item(s)
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsShareQrOpen(true)}
              className="gap-2"
            >
              <QrCode className="h-4 w-4" />
              Share QR
            </Button>
            {listing ? (
              <Button
                onClick={handleBulkDownload}
                disabled={!selectedPaths.length}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download selected
              </Button>
            ) : (
              <Button
                onClick={() => handleDownload(file?.path, file)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        {listing && currentPath && (
          <Button variant="ghost" onClick={handleBack} className="w-fit gap-2">
            <FolderOpen className="h-4 w-4" />
            Back
          </Button>
        )}

        {listing ? (
          <div className="space-y-4">
            {listing.items.map((item) => (
              <div
                key={item.path}
                className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedPaths.includes(item.path)}
                    onCheckedChange={() => togglePathSelection(item.path)}
                  />
                  <FileIcon name={item.name} isDir={item.isDir} />
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => handleItemClick(item)}
                  >
                    <p className="font-medium">
                      {item.name}
                      {item.isDir && "/"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.isDir ? "Folder" : formatBytes(item.size ?? 0)}
                    </p>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatDate(item.modified ?? 0)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(item.path, item)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{file?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {file?.isDir ? "Folder" : formatBytes(file?.size ?? 0)}
                </p>
              </div>
              <Button
                onClick={() => handleDownload(file?.path, file)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
            {canInlinePreview && (
              <div className="mt-6">
                {isPreviewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : (
                  renderPreview(file)
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex items-center justify-between gap-4">
            <DialogTitle>{previewItem?.name ?? "Preview"}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          {isPreviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            renderPreview(previewItem)
          )}
        </DialogContent>
      </Dialog>

      <ShareQrDialog
        open={isShareQrOpen}
        onOpenChange={setIsShareQrOpen}
        url={typeof window !== "undefined" ? window.location.href : ""}
      />
    </div>
  );
}
