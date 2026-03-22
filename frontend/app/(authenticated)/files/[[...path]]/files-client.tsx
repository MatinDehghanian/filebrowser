"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FileList } from "@/components/files/file-list";
import { FileContextMenu } from "@/components/files/file-context-menu";
import { UploadDialog } from "@/components/dialogs/upload-dialog";
import { NewFolderDialog } from "@/components/dialogs/new-folder-dialog";
import { NewFileDialog } from "@/components/dialogs/new-file-dialog";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { MoveDialog } from "@/components/dialogs/move-dialog";
import { ShareDialog } from "@/components/dialogs/share-dialog";
import { PreviewDialog } from "@/components/dialogs/preview-dialog";
import { SelectionBar } from "@/components/files/selection-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { joinPaths } from "@/lib/utils";
import type { FileItem, FileListingResponse, ViewMode, Sorting } from "@/types";

interface FilesClientProps {
  params?: never;
}

export default function FilesClient({}: FilesClientProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPath = location.pathname.replace(/^\/files/, "") || "/";
  const path = rawPath.length > 1 && rawPath.endsWith("/")
    ? rawPath.slice(0, -1)
    : rawPath;

  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>(user?.viewMode || "list");
  const [sorting] = useState<Sorting>(
    user?.sorting || { by: "name", asc: true }
  );
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    item: FileItem;
    x: number;
    y: number;
  } | null>(null);

  // Dialog states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isPageDragging, setIsPageDragging] = useState(false);

  // Fetch data
  const { data, error, isLoading, mutate } = useSWR<FileListingResponse>(
    path ? `resource:${path}` : null,
    () => api.getResource(path),
    { revalidateOnFocus: false }
  );

  // Search handling
  const searchQuery =
    searchParams.get("search")?.trim() ||
    searchParams.get("query")?.trim() ||
    "";
  const isSearching = searchQuery.length > 0;

  const { data: searchResults, isLoading: isSearchLoading } = useSWR(
    isSearching ? `search:${path}:${searchQuery}` : null,
    () => api.search(path, searchQuery),
    { revalidateOnFocus: false },
  );

  const items = useMemo(
    () => (isSearching ? searchResults?.items || [] : data?.items || []),
    [data?.items, searchQuery, searchResults?.items],
  );

  // Clear selection on path change
  useEffect(() => {
    setSelectedItems([]);
    setContextMenu(null);
  }, [path]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Delete" && selectedItems.length > 0) {
        setDeleteOpen(true);
      }

      if (e.key === "F2" && selectedItems.length === 1) {
        setRenameOpen(true);
      }

      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedItems(items);
      }

      if (e.key === "Escape") {
        setSelectedItems([]);
        setContextMenu(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItems, items]);

  const handleContextMenu = useCallback(
    (item: FileItem, event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({ item, x: event.clientX, y: event.clientY });
      if (!selectedItems.some((i) => i.path === item.path)) {
        setSelectedItems([item]);
      }
    },
    [selectedItems]
  );

  const handlePreview = useCallback((item: FileItem) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const canCreate = user?.perm?.create ?? false;
  const canDelete = user?.perm?.delete ?? false;
  const canRename = user?.perm?.rename ?? false;
  const canShare = user?.perm?.share ?? false;
  const canDownload = user?.perm?.download ?? false;
  const canModify = user?.perm?.modify ?? false;

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChangeAll(items);
      return;
    }

    setSelectedItems([]);
  };

  const onSelectionChangeAll = (nextItems: FileItem[]) => {
    setSelectedItems(nextItems);
  };

  const handleDownloadSelected = () => {
    if (!canDownload) {
      return;
    }

    if (selectedItems.length === 0) {
      window.open(api.getDownloadUrl(path), "_blank");
      return;
    }

    if (selectedItems.length === 1) {
      window.open(api.getDownloadUrl(selectedItems[0].path), "_blank");
      return;
    }

    const baseUrl = api.getDownloadUrl(path);
    const url = new URL(baseUrl, window.location.origin);

    const relativePaths = selectedItems.map((item) => {
      if (!path || path === "/") {
        return item.path;
      }

      if (item.path.startsWith(`${path}/`)) {
        return item.path.slice(path.length);
      }

      return item.path;
    });

    const encodedPaths = relativePaths.map((itemPath) => encodeURIComponent(itemPath));
    url.searchParams.set("files", encodedPaths.join(","));
    window.open(url.toString(), "_blank");
  };

  const handleDropUpload = useCallback(
    async (filesToUpload: FileList | File[]) => {
      const files = Array.from(filesToUpload);
      if (files.length === 0) {
        return;
      }

      if (!canCreate) {
        toast.error("You don't have permission to upload files");
        return;
      }

      const token = api.getToken();
      let completedCount = 0;
      let errorCount = 0;

      for (const file of files) {
        const filePath = joinPaths(path, file.name);

        try {
          const response = await fetch(`/api/resources${filePath}?override=false`, {
            method: "POST",
            headers: token ? { "X-Auth": token } : undefined,
            body: file,
          });

          if (!response.ok) {
            throw new Error("Upload failed");
          }

          completedCount++;
        } catch {
          errorCount++;
        }
      }

      if (completedCount > 0) {
        toast.success(`${completedCount} file(s) uploaded successfully`);
        handleRefresh();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} file(s) failed to upload`);
      }
    },
    [canCreate, path, handleRefresh]
  );

  useEffect(() => {
    if (!canCreate) {
      return;
    }

    let dragDepth = 0;

    const hasFiles = (event: DragEvent) => {
      return Array.from(event.dataTransfer?.types || []).includes("Files");
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth += 1;
      setIsPageDragging(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);

      if (dragDepth === 0) {
        setIsPageDragging(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      dragDepth = 0;
      setIsPageDragging(false);

      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        void handleDropUpload(event.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [canCreate, handleDropUpload]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load files</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        path={path}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onUpload={() => setUploadOpen(true)}
        onNewFolder={() => setNewFolderOpen(true)}
        onNewFile={() => setNewFileOpen(true)}
        onRefresh={handleRefresh}
        canCreate={canCreate}
      />

      <Breadcrumbs path={path} />

      {selectedItems.length > 0 && (
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              id="admin-select-all"
              checked={allSelected}
              onCheckedChange={(value) => handleSelectAll(Boolean(value))}
            />
            <label
              htmlFor="admin-select-all"
              className="cursor-pointer text-sm"
            >
              Select all
            </label>
            {selectedItems.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({selectedItems.length} selected)
              </span>
            )}
          </div>

          {canDownload && (
            <Button
              size="sm"
              onClick={handleDownloadSelected}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              {selectedItems.length > 0 ? "Download Selected" : "Download All"}
            </Button>
          )}
        </div>
      )}

      {isLoading || (isSearching && isSearchLoading) ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {isSearching && (
            <div className="border-b bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:text-sm">
              {items.length} result{items.length !== 1 ? "s" : ""} for "
              {searchQuery}" in {path}
            </div>
          )}

          <FileList
            items={items}
            viewMode={viewMode}
            sorting={sorting}
            onContextMenu={handleContextMenu}
            onPreview={handlePreview}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            isSearching={isSearching}
            searchRootPath={path}
          />
        </>
      )}

      {selectedItems.length > 0 && (
        <SelectionBar
          selectedCount={selectedItems.length}
          onClear={() => setSelectedItems([])}
          onDelete={() => setDeleteOpen(true)}
          onMove={() => setMoveOpen(true)}
          onShare={() => setShareOpen(true)}
          onDownload={handleDownloadSelected}
          canDelete={canDelete}
          canShare={canShare}
          canDownload={canDownload}
        />
      )}

      {isPageDragging && canCreate && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="rounded-lg border border-dashed border-primary bg-background px-6 py-8 text-center shadow-lg">
            <p className="text-sm font-medium">Drop files to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files will be uploaded to this folder
            </p>
          </div>
        </div>
      )}

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={closeContextMenu}
          onOpen={() => {
            if (contextMenu.item.isDir) {
              navigate(`/files${contextMenu.item.path}/`);
            } else {
              handlePreview(contextMenu.item);
            }
            closeContextMenu();
          }}
          onDownload={() =>
            window.open(api.getDownloadUrl(contextMenu.item.path), "_blank")
          }
          onRename={() => setRenameOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onShare={() => setShareOpen(true)}
          onCopy={() => {
            navigator.clipboard
              .writeText(contextMenu.item.path)
              .then(() => toast.success("Path copied to clipboard"))
              .catch(() => toast.error("Failed to copy path"));
          }}
          canRename={canRename}
          canDelete={canDelete}
          canShare={canShare}
        />
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        path={path}
        onComplete={handleRefresh}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        path={path}
        onComplete={handleRefresh}
      />
      <NewFileDialog
        open={newFileOpen}
        onOpenChange={setNewFileOpen}
        path={path}
        onComplete={handleRefresh}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        items={selectedItems}
        onComplete={() => {
          setSelectedItems([]);
          handleRefresh();
        }}
      />
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        item={selectedItems[0]}
        onComplete={handleRefresh}
      />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        items={selectedItems}
        currentPath={path}
        onComplete={() => {
          setSelectedItems([]);
          handleRefresh();
        }}
      />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        item={selectedItems[0]}
      />
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        item={previewItem}
        items={items.filter((item) => !item.isDir)}
        onNavigate={(item) => setPreviewItem(item)}
        canEdit={canModify}
      />
    </div>
  );
}
