"use client";

import { useState } from "react";
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
import { joinPaths } from "@/lib/utils";
import api from "@/lib/api";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  onComplete: () => void;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  path,
  onComplete,
}: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    // Validate folder name
    if (name.includes("/") || name.includes("\\")) {
      toast.error("Folder name cannot contain slashes");
      return;
    }

    setIsCreating(true);

    try {
      const folderPath = joinPaths(path, name.trim());
      await api.createFolder(folderPath);
      toast.success("Folder created successfully");
      onComplete();
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create folder"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter folder name"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
