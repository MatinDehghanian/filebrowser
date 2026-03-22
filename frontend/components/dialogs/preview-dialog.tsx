"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatBytes, getFileType } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem } from "@/types";

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | null;
  items: FileItem[];
  onNavigate: (item: FileItem) => void;
}

export function PreviewDialog({
  open,
  onOpenChange,
  item,
  items,
  onNavigate,
}: PreviewDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentIndex = item ? items.findIndex((i) => i.path === item.path) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < items.length - 1;

  const fileType = item ? getFileType(item.name, item.isDir) : null;

  // Load text content for code/text files
  useEffect(() => {
    if (!item || !open) {
      setTextContent(null);
      return;
    }

    if (fileType === "code" || item.type === "text") {
      setIsLoading(true);
      api
        .getFileContent(item.path)
        .then((content) => {
          setTextContent(content);
        })
        .catch((error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to load file content"
          );
          setTextContent(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [item, open, fileType]);

  const handlePrev = useCallback(() => {
    if (canGoPrev) {
      onNavigate(items[currentIndex - 1]);
    }
  }, [canGoPrev, currentIndex, items, onNavigate]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      onNavigate(items[currentIndex + 1]);
    }
  }, [canGoNext, currentIndex, items, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext, onOpenChange]);

  const handleDownload = () => {
    if (item) {
      window.open(api.getDownloadUrl(item.path), "_blank");
      toast.success(`"${item.name}" download started`);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderPreview = () => {
    if (!item) return null;

    switch (fileType) {
      case "image":
        return (
          <div className="flex h-full items-center justify-center p-4">
              
            <img
              src={api.getPreviewUrl(item.path, "big")}
              alt={item.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        );

      case "video":
        return (
          <div className="flex h-full items-center justify-center p-4">
            <video
              src={api.getDownloadUrl(item.path, true)}
              controls
              autoPlay
              className="max-h-full max-w-full"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case "audio":
        return (
          <div className="flex h-full flex-col items-center justify-center gap-8 p-4">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
              <svg
                className="h-16 w-16 text-primary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <audio
              src={api.getDownloadUrl(item.path, true)}
              controls
              autoPlay
              className="w-full max-w-md"
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case "code":
      case "document":
        if (isLoading) {
          return (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          );
        }
        if (textContent !== null) {
          return (
            <ScrollArea className="h-full">
              <pre className="p-4 text-sm">
                <code>{textContent}</code>
              </pre>
            </ScrollArea>
          );
        }
        // PDF
        if (item.name.toLowerCase().endsWith(".pdf")) {
          return (
            <iframe
              src={api.getDownloadUrl(item.path, true)}
              className="h-full w-full"
              title={item.name}
            />
          );
        }
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
            <p className="text-muted-foreground">
              Preview not available for this file type
            </p>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        );

      default:
        return (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
            <p className="text-muted-foreground">
              Preview not available for this file type
            </p>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        );
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          isFullscreen
            ? "h-screen max-h-screen w-screen max-w-full rounded-none"
            : "h-[90vh] max-w-5xl"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex-1 min-w-0">
            <DialogTitle className="truncate">{item.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {formatBytes(item.size)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="relative flex-1 overflow-hidden bg-muted/30">
          {renderPreview()}

          {/* Navigation Arrows */}
          {items.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                onClick={handlePrev}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                onClick={handleNext}
                disabled={!canGoNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Footer - File Counter */}
        {items.length > 1 && (
          <div className="border-t px-4 py-2 text-center text-sm text-muted-foreground">
            {currentIndex + 1} of {items.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
