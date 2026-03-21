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
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur shadow-lg px-4 py-2">
        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>
        
        <div className="mx-2 h-6 w-px bg-border" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onMove}
          className="gap-2"
        >
          <FolderInput className="h-4 w-4" />
          Move
        </Button>
        
        {canShare && selectedCount === 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}

        {canDownload && onDownload && (
          <Button variant="ghost" size="sm" onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        )}
        
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        
        <div className="mx-2 h-6 w-px bg-border" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
