"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, File, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes, joinPaths } from "@/lib/utils";
import api from "@/lib/api";
import { uploadResumable } from "@/lib/transfers";
import { useConflictResolver } from "./conflict-dialog";
import { useAuth } from "@/contexts/auth-context";

interface UploadFile {
  file: File;
  progress: number;
  status:
    "pending" | "uploading" | "completed" | "error" | "skipped" | "paused";
  error?: string;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  onComplete: () => void;
  initialFiles?: File[];
}

export function UploadDialog({
  open,
  onOpenChange,
  path,
  onComplete,
  initialFiles,
}: UploadDialogProps) {
  const { user } = useAuth();
  const [uploadSettings, setUploadSettings] = useState<{
    chunkSize?: number;
    retryCount?: number;
  }>({});
  useEffect(() => {
    if (open) {
      let cancelled = false;
      void api
        .getPublicSettings()
        .then((settings) => {
          if (!cancelled) setUploadSettings(settings.tus || {});
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [open]);
  const conflict = useConflictResolver();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles).map((file) => ({
        file,
        progress: 0,
        status: "pending" as const,
      }));
      if (!isUploading) setFiles((prev) => [...prev, ...fileArray]);
    },
    [isUploading],
  );

  useEffect(() => {
    if (open && initialFiles?.length)
      setFiles(
        initialFiles.map((file) => ({ file, progress: 0, status: "pending" })),
      );
  }, [open, initialFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const uploadFile = async (uploadFile: UploadFile, index: number) => {
    const relative = uploadFile.file.webkitRelativePath || uploadFile.file.name;
    const filePath = joinPaths(path, relative);
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "uploading", error: undefined } : f,
      ),
    );
    try {
      const result = await uploadResumable(uploadFile.file, filePath, {
        ownerId: user!.id,
        signal: controller.current!.signal,
        resolve: conflict.resolve,
        canReplace: user?.perm.modify,
        chunkSize: uploadSettings.chunkSize,
        retries: uploadSettings.retryCount,
        onProgress: (progress) =>
          setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, progress } : f)),
          ),
      });
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: result,
                progress: result === "completed" ? 100 : 0,
              }
            : f,
        ),
      );
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        controller.current?.abort();
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status:
                  error instanceof Error && error.name === "AbortError"
                    ? "paused"
                    : "error",
                error:
                  error instanceof Error && error.name === "AbortError"
                    ? "Paused. Choose Upload to continue."
                    : error instanceof Error
                      ? error.message
                      : "Upload failed",
              }
            : f,
        ),
      );
      return controller.current?.signal.aborted ? "paused" : "error";
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    conflict.reset();
    controller.current = new AbortController();

    const pendingFiles = files
      .map((f, i) => ({ file: f, index: i }))
      .filter(
        ({ file }) =>
          file.status === "pending" ||
          file.status === "error" ||
          file.status === "paused",
      );

    let completedCount = 0;
    let errorCount = 0;
    for (const { file, index } of pendingFiles) {
      if (controller.current.signal.aborted) break;
      const result = await uploadFile(file, index);
      if (result === "completed") completedCount++;
      else if (result === "error") errorCount++;
    }
    setIsUploading(false);
    if (completedCount > 0) {
      toast.success(`${completedCount} file(s) uploaded successfully`);
      onComplete();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed. You can retry them.`);
    } else if (!controller.current.signal.aborted) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter(
    (f) =>
      f.status === "pending" || f.status === "error" || f.status === "paused",
  ).length;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        {/* Capped to the screen height; only the file list scrolls. */}
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Drop Zone */}
            <div
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25",
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drag and drop files here, or{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload files or folders. Interrupted uploads can resume for up
                  to 24 hours.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                disabled={isUploading}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <label className="block shrink-0 cursor-pointer text-sm text-primary">
              Or select a folder
              <input
                type="file"
                multiple
                {...({ webkitdirectory: "" } as Record<string, string>)}
                className="hidden"
                disabled={isUploading}
                onChange={handleFileSelect}
              />
            </label>
            {/* File List */}
            {files.length > 0 && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-72">
                <div className="space-y-2">
                  {files.map((uploadFile, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <File className="h-8 w-8 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(uploadFile.file.size)}
                        </p>
                        {uploadFile.status === "skipped" && (
                          <p className="text-xs text-muted-foreground">
                            Skipped
                          </p>
                        )}
                        {uploadFile.status === "uploading" && (
                          <Progress
                            value={uploadFile.progress}
                            className="mt-2 h-1"
                          />
                        )}
                        {(uploadFile.status === "error" ||
                          uploadFile.status === "paused") && (
                          <p className="text-xs text-destructive mt-1">
                            {uploadFile.error}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {uploadFile.status === "completed" && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {uploadFile.status === "error" && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        {uploadFile.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isUploading}
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex shrink-0 justify-end gap-2">
              {isUploading && (
                <Button
                  variant="outline"
                  onClick={() => controller.current?.abort()}
                >
                  Pause
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={pendingCount === 0 || isUploading}
              >
                {isUploading
                  ? "Uploading..."
                  : `Upload ${pendingCount} file(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {conflict.dialog}
    </>
  );
}
