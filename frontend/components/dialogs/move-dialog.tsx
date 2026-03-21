"use client";

import { useState, useEffect } from "react";
import { Folder, ChevronRight, Home } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, joinPaths } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem, FileListingResponse } from "@/types";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FileItem[];
  currentPath: string;
  onComplete: () => void;
}

export function MoveDialog({
  open,
  onOpenChange,
  items,
  currentPath,
  onComplete,
}: MoveDialogProps) {
  const [selectedPath, setSelectedPath] = useState("/");
  const [isMoving, setIsMoving] = useState(false);

  // Reset path when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPath("/");
    }
  }, [open]);

  // Fetch directory contents
  const { data, isLoading } = useSWR<FileListingResponse>(
    open ? `move-dialog:${selectedPath}` : null,
    () => api.getResource(selectedPath),
    { revalidateOnFocus: false }
  );

  const folders = data?.items?.filter((item) => item.isDir) || [];

  // Build breadcrumb path
  const breadcrumbs = selectedPath.split("/").filter(Boolean);

  const handleMove = async () => {
    if (items.length === 0) return;

    // Check if moving to same location
    if (selectedPath === currentPath) {
      toast.error("Cannot move to the same location");
      return;
    }

    // Check if trying to move folder into itself
    const movingIntoSelf = items.some(
      (item) => item.isDir && selectedPath.startsWith(item.path)
    );
    if (movingIntoSelf) {
      toast.error("Cannot move a folder into itself");
      return;
    }

    setIsMoving(true);

    try {
      await Promise.all(
        items.map((item) => {
          const destination = joinPaths(selectedPath, item.name);
          return api.resourceAction(item.path, "move", destination);
        })
      );

      toast.success(
        items.length === 1
          ? `"${items[0].name}" moved successfully`
          : `${items.length} items moved successfully`
      );
      onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move items"
      );
    } finally {
      setIsMoving(false);
    }
  };

  const navigateTo = (path: string) => {
    setSelectedPath(path);
  };

  if (items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Move {items.length === 1 ? `"${items[0].name}"` : `${items.length} items`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => navigateTo("/")}
            >
              <Home className="h-4 w-4" />
            </Button>
            {breadcrumbs.map((crumb, index) => {
              const crumbPath = "/" + breadcrumbs.slice(0, index + 1).join("/");
              return (
                <div key={crumbPath} className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => navigateTo(crumbPath)}
                  >
                    {decodeURIComponent(crumb)}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Folder List */}
          <ScrollArea className="h-64 rounded-md border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No folders in this directory
              </div>
            ) : (
              <div className="p-2">
                {folders.map((folder) => {
                  // Disable folders that are being moved
                  const isItemBeingMoved = items.some(
                    (item) => item.path === folder.path
                  );
                  return (
                    <button
                      key={folder.path}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                        isItemBeingMoved && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => !isItemBeingMoved && navigateTo(folder.path)}
                      disabled={isItemBeingMoved}
                    >
                      <Folder className="h-5 w-5 text-primary" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Selected Path */}
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Move to: </span>
            <span className="font-medium">
              {selectedPath === "/" ? "Root" : selectedPath}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving}>
            {isMoving ? "Moving..." : "Move Here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
