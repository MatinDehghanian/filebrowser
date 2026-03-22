"use client";

import { X, Trash2, FolderInput, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
  onShare: () => void;
  onDownload?: () => void;
  canDelete?: boolean;
  canShare?: boolean;
  canDownload?: boolean;
}

export function SelectionBar({
  selectedCount,
  onClear,
  onDelete,
  onMove,
  onShare,
  onDownload,
  canDelete = true,
  canShare = true,
  canDownload = true,
}: SelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-2 right-2 z-50 sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <div className="flex justify-around items-center gap-1 overflow-x-auto rounded-lg border bg-background/95 px-2 py-2 shadow-lg backdrop-blur sm:gap-2 sm:px-4">
        <span className="shrink-0 text-xs font-medium sm:text-sm">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>

        <div className="mx-1 hidden h-6 w-px bg-border sm:mx-2 sm:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onMove}
          className="h-8 w-8 shrink-0 gap-2 sm:h-9 sm:w-auto sm:px-3"
        >
          <FolderInput className="h-4 w-4" />
          <span className="hidden sm:inline">Move</span>
        </Button>

        {canShare && selectedCount === 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            className="h-8 w-8 shrink-0 gap-2 sm:h-9 sm:w-auto sm:px-3"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}

        {canDownload && onDownload && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload}
            className="h-8 w-8 shrink-0 gap-2 sm:h-9 sm:w-auto sm:px-3"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 shrink-0 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-auto sm:px-3"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}

        <div className="mx-1 hidden h-6 w-px bg-border sm:mx-2 sm:block" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
