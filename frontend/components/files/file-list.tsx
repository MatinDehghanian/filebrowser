"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileItem } from "./file-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FileItem as FileItemType, ViewMode, Sorting } from "@/types";

interface FileListProps {
  items: FileItemType[];
  viewMode: ViewMode;
  path: string;
  sorting: Sorting;
  onSortChange: (sorting: Sorting) => void;
  onContextMenu: (item: FileItemType, event: React.MouseEvent) => void;
  onPreview: (item: FileItemType) => void;
  selectedItems: FileItemType[];
  onSelectionChange: (items: FileItemType[]) => void;
}

export function FileList({
  items,
  viewMode,
  path,
  sorting,
  onSortChange,
  onContextMenu,
  onPreview,
  selectedItems,
  onSelectionChange,
}: FileListProps) {
  const router = useRouter();

  // Sort items - folders first, then by sorting criteria
  const sortedItems = useMemo(() => {
    const folders = items.filter((i) => i.isDir);
    const files = items.filter((i) => !i.isDir);

    const sortFn = (a: FileItemType, b: FileItemType) => {
      let comparison = 0;
      switch (sorting.by) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "modified":
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sorting.asc ? comparison : -comparison;
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [items, sorting]);

  const handleSelect = useCallback(
    (item: FileItemType, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        const isSelected = selectedItems.some((i) => i.path === item.path);
        if (isSelected) {
          onSelectionChange(selectedItems.filter((i) => i.path !== item.path));
        } else {
          onSelectionChange([...selectedItems, item]);
        }
      } else if (event.shiftKey && selectedItems.length > 0) {
        // Range selection
        const lastSelected = selectedItems[selectedItems.length - 1];
        const lastIndex = sortedItems.findIndex((i) => i.path === lastSelected.path);
        const currentIndex = sortedItems.findIndex((i) => i.path === item.path);
        const [start, end] = [lastIndex, currentIndex].sort((a, b) => a - b);
        const rangeItems = sortedItems.slice(start, end + 1);
        onSelectionChange(rangeItems);
      } else {
        // Single selection
        onSelectionChange([item]);
      }
    },
    [selectedItems, sortedItems, onSelectionChange]
  );

  const handleOpen = useCallback(
    (item: FileItemType) => {
      if (item.isDir) {
        router.push(`/files${item.path}/`);
      } else {
        onPreview(item);
      }
    },
    [router, onPreview]
  );

  const isSelected = useCallback(
    (item: FileItemType) => selectedItems.some((i) => i.path === item.path),
    [selectedItems]
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-muted p-6">
          <svg
            className="h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold">This folder is empty</h3>
          <p className="text-sm text-muted-foreground">
            Upload files or create a new folder to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      {viewMode === "list" ? (
        <div className="p-4">
          {/* List Header */}
          <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b mb-2">
            <div className="w-5" /> {/* Checkbox space */}
            <div className="w-6" /> {/* Icon space */}
            <div className="flex-1">Name</div>
            <div className="hidden sm:block w-24 text-right">Size</div>
            <div className="hidden md:block w-40 text-right">Modified</div>
          </div>
          <div className="space-y-1">
            {sortedItems.map((item) => (
              <FileItem
                key={item.path}
                item={item}
                viewMode={viewMode}
                selected={isSelected(item)}
                onSelect={handleSelect}
                onOpen={handleOpen}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 p-4",
            viewMode === "mosaic gallery"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
          )}
        >
          {sortedItems.map((item) => (
            <FileItem
              key={item.path}
              item={item}
              viewMode={viewMode}
              selected={isSelected(item)}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
