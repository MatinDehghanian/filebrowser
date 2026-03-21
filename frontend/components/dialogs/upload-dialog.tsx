"use client";

import { useState, useCallback, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatBytes, joinPaths } from "@/lib/utils";
import api from "@/lib/api";

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  onComplete: () => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  path,
  onComplete,
}: UploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...fileArray]);
  }, []);

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
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const uploadFile = async (uploadFile: UploadFile, index: number) => {
    const filePath = joinPaths(path, uploadFile.file.name);
    
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "uploading" as const } : f
      )
    );

    try {
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      const token = api.getToken();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f, i) => (i === index ? { ...f, progress } : f))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(xhr.statusText || "Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        xhr.open("POST", `/api/resources${filePath}?override=false`);
        if (token) {
          xhr.setRequestHeader("X-Auth", token);
        }
        xhr.send(uploadFile.file);
      });

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "completed" as const, progress: 100 } : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    const pendingFiles = files
      .map((f, i) => ({ file: f, index: i }))
      .filter(({ file }) => file.status === "pending");

    // Upload files sequentially
    for (const { file, index } of pendingFiles) {
      await uploadFile(file, index);
    }

    setIsUploading(false);

    const completedCount = files.filter((f) => f.status === "completed").length;
    const errorCount = files.filter((f) => f.status === "error").length;

    if (completedCount > 0) {
      toast.success(`${completedCount} file(s) uploaded successfully`);
      onComplete();
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to upload`);
    }

    // Close if all successful
    if (errorCount === 0) {
      handleClose();
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
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
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload multiple files at once
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <ScrollArea className="max-h-60">
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
                      {uploadFile.status === "uploading" && (
                        <Progress
                          value={uploadFile.progress}
                          className="mt-2 h-1"
                        />
                      )}
                      {uploadFile.status === "error" && (
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
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
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
              {isUploading ? "Uploading..." : `Upload ${pendingCount} file(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
