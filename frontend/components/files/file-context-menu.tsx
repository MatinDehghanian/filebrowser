"use client";

import { useEffect, useRef } from "react";
import {
  FolderOpen,
  Download,
  Pencil,
  Trash2,
  Share2,
  Copy,
  Info,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/types";

interface FileContextMenuProps {
  x: number;
  y: number;
  item: FileItem;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCopy: () => void;
  canRename?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
}

export function FileContextMenu({
  x,
  y,
  item,
  onClose,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onShare,
  onCopy,
  canRename = true,
  canDelete = true,
  canShare = true,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    destructive,
    disabled,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem icon={FolderOpen} label="Open" onClick={onOpen} />
      
      {!item.isDir && (
        <MenuItem icon={Download} label="Download" onClick={onDownload} />
      )}
      
      <div className="my-1 h-px bg-border" />
      
      <MenuItem icon={Copy} label="Copy Link" onClick={onCopy} />
      
      {canShare && (
        <MenuItem icon={Share2} label="Share" onClick={onShare} />
      )}
      
      <div className="my-1 h-px bg-border" />
      
      {canRename && (
        <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
      )}
      
      {canDelete && (
        <MenuItem
          icon={Trash2}
          label="Delete"
          onClick={onDelete}
          destructive
        />
      )}
    </div>
  );
}
