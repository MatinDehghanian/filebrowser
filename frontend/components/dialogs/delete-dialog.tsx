"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isWithinPath } from "@/lib/paths";
import api from "@/lib/api";
import type { FileItem } from "@/types";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FileItem[];
  onComplete: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  items,
  onComplete,
}: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (items.length === 0) return;

    setIsDeleting(true);

    try {
      const topLevel = items.filter((item) => !items.some((other) => other !== item && other.isDir && isWithinPath(other.path, item.path)));
      const results = await Promise.allSettled(topLevel.map((item) => api.deleteResource(item.path)));
      const failures = results.filter((result) => result.status === "rejected");
      const completed = results.length - failures.length;
      if (completed) toast.success(`${completed} item(s) deleted successfully`);
      if (failures.length) toast.error(`${failures.length} failed: ${(failures[0] as PromiseRejectedResult).reason?.message || "Please retry"}`);
      if (completed) {
        onComplete();
        onOpenChange(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (items.length === 0) return null;

  const isSingleItem = items.length === 1;
  const hasFolders = items.some((item) => item.isDir);

  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {isSingleItem ? (hasFolders ? "Folder" : "File") : "Items"}
          </DialogTitle>
          <DialogDescription>
            {isSingleItem ? (
              <>
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  &quot;{items[0].name}&quot;
                </span>
                ?
                {items[0].isDir && " All contents will be permanently deleted."}
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  {items.length} items
                </span>
                ? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isSingleItem && (
          <div className="max-h-32 overflow-y-auto rounded-md border p-2">
            <ul className="space-y-1 text-sm">
              {items.slice(0, 10).map((item) => (
                <li key={item.path} className="truncate text-muted-foreground">
                  {item.isDir ? "📁" : "📄"} {item.name}
                </li>
              ))}
              {items.length > 10 && (
                <li className="text-muted-foreground">
                  ... and {items.length - 10} more
                </li>
              )}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
