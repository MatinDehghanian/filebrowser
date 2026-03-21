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

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  onComplete: () => void;
}

export function NewFileDialog({
  open,
  onOpenChange,
  path,
  onComplete,
}: NewFileDialogProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a file name");
      return;
    }

    // Validate file name
    if (name.includes("/") || name.includes("\\")) {
      toast.error("File name cannot contain slashes");
      return;
    }

    setIsCreating(true);

    try {
      const filePath = joinPaths(path, name.trim());
      await api.createFile(filePath);
      toast.success("File created successfully");
      onComplete();
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create file"
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
          <DialogTitle>New File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-name">File Name</Label>
            <Input
              id="file-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter file name (e.g., document.txt)"
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
