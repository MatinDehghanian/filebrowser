"use client";

import { useEffect, useState } from "react";
import { formatBytes, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getParentPath } from "@/lib/utils";
import { FileIcon } from "./file-icon";
import { Checkbox } from "@/components/ui/checkbox";
import type { FileItem as FileItemType, ViewMode } from "@/types";

interface FileItemProps {
  item: FileItemType;
  viewMode: ViewMode;
  selected: boolean;
  onSelect: (item: FileItemType, event: React.MouseEvent) => void;
  onToggleSelect: (item: FileItemType, checked: boolean) => void;
  onOpen: (item: FileItemType) => void;
  onContextMenu: (item: FileItemType, event: React.MouseEvent) => void;
  showParentPath?: boolean;
  searchRootPath?: string;
}

export function FileItem({
  item,
  viewMode,
  selected,
  onSelect,
  onToggleSelect,
  onOpen,
  onContextMenu,
  showParentPath = false,
  searchRootPath = "/",
}: FileItemProps) {
  const getDisplayParentPath = () => {
    const parentPath = getParentPath(item.path);
    const normalizedRoot =
      searchRootPath && searchRootPath !== "/"
        ? searchRootPath.replace(/\/+$/, "")
        : "";

    if (normalizedRoot && parentPath.startsWith(normalizedRoot)) {
      const relativeParent = parentPath.slice(normalizedRoot.length);
      return relativeParent.startsWith("/") ? relativeParent : `/${relativeParent}`;
    }

    return parentPath || "/";
  };

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateDeviceType = () => setIsTouchDevice(mediaQuery.matches);

    updateDeviceType();
    mediaQuery.addEventListener("change", updateDeviceType);

    return () => {
      mediaQuery.removeEventListener("change", updateDeviceType);
    };
  }, []);

  const parentPath = getDisplayParentPath();

  const handleClick = (e: React.MouseEvent) => {
    if (isTouchDevice) {
      onOpen(item);
      return;
    }

    if (e.detail === 2) {
      onOpen(item);
    } else {
      onSelect(item, e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onOpen(item);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-accent cursor-pointer",
          selected && "border-primary/50 bg-primary/5"
        )}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(item, e)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
      >
        <Checkbox
          checked={selected}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onCheckedChange={(value) => onToggleSelect(item, Boolean(value))}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=checked]:opacity-100"
        />
        
        <FileIcon name={item.name} isDir={item.isDir} size="md" />
        
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{item.name}</p>
          {showParentPath && (
            <p className="truncate text-xs text-muted-foreground">{parentPath}</p>
          )}
        </div>
        
        <div className="hidden sm:block w-24 text-right text-sm text-muted-foreground">
          {item.isDir ? "-" : formatBytes(item.size)}
        </div>
        
        <div className="hidden md:block w-40 text-right text-sm text-muted-foreground">
          {formatDate(item.modified)}
        </div>
      </div>
    );
  }

  // Grid/Mosaic view
  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-lg border border-transparent p-4 transition-colors hover:bg-accent cursor-pointer",
        selected && "border-primary/50 bg-primary/5"
      )}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(item, e)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
    >
      <Checkbox
        checked={selected}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onCheckedChange={(value) => onToggleSelect(item, Boolean(value))}
        className="absolute top-2 left-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=checked]:opacity-100"
      />
      
      <div className="flex h-16 w-16 items-center justify-center">
        <FileIcon name={item.name} isDir={item.isDir} size="lg" />
      </div>
      
      <div className="w-full text-center">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {showParentPath && (
          <p className="truncate text-[11px] text-muted-foreground">{parentPath}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {item.isDir ? "Folder" : formatBytes(item.size)}
        </p>
      </div>
    </div>
  );
}
