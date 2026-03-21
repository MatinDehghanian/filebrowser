"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getParentPath, joinPaths } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem } from "@/types";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | undefined;
  onComplete: () => void;
}

export function RenameDialog({
  open,
  onOpenChange,
  item,
  onComplete,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
    }
  }, [item, open]);

  const handleRename = async () => {
    if (!item || !name.trim()) return;

    if (name.trim() === item.name) {
      onOpenChange(false);
      return;
    }

    // Validate name
    if (name.includes("/") || name.includes("\\")) {
      toast.error("Name cannot contain slashes");
      return;
    }

    setIsRenaming(true);

    try {
      const parentPath = getParentPath(item.path);
      const newPath = joinPaths(parentPath, name.trim());
      
      await api.resourceAction(item.path, "rename", newPath);
      
      toast.success("Renamed successfully");
      onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rename"
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRenaming) {
      handleRename();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename {item.isDir ? "Folder" : "File"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              onFocus={(e) => {
                // Select filename without extension for files
                if (!item.isDir) {
                  const lastDot = name.lastIndexOf(".");
                  if (lastDot > 0) {
                    e.target.setSelectionRange(0, lastDot);
                  } else {
                    e.target.select();
                  }
                } else {
                  e.target.select();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={isRenaming || !name.trim() || name.trim() === item.name}
          >
            {isRenaming ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
