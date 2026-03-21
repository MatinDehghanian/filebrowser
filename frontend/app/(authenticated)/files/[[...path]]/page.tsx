"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { FileItem, FileListingResponse, ViewMode, Sorting } from "@/types";

interface FilesPageProps {
  params: Promise<{ path?: string[] }>;
}

export default function FilesPage({ params }: FilesPageProps) {
  const resolvedParams = use(params);
  const pathSegments = resolvedParams.path || [];
  const path = "/" + pathSegments.join("/");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>(user?.viewMode || "list");
  const [sorting, setSorting] = useState<Sorting>(
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

  // Fetch data
  const { data, error, isLoading, mutate } = useSWR<FileListingResponse>(
    path ? `resource:${path}` : null,
    () => api.getResource(path),
    { revalidateOnFocus: false }
  );

  // Search handling
  const searchQuery = searchParams.get("search");
  const { data: searchResults } = useSWR(
    searchQuery ? `search:${path}:${searchQuery}` : null,
    () => api.search(path, searchQuery!),
    { revalidateOnFocus: false }
  );

  const items = searchQuery ? (searchResults?.items || []) : (data?.items || []);

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

  const handleContextMenu = useCallback((item: FileItem, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ item, x: event.clientX, y: event.clientY });
    if (!selectedItems.some((i) => i.path === item.path)) {
      setSelectedItems([item]);
    }
  }, [selectedItems]);

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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load files</p>
        <button
          onClick={() => mutate()}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" onClick={closeContextMenu}>
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
      
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Breadcrumbs path={path} />
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.numDirs} folders, {data.numFiles} files
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <FileList
          items={items}
          viewMode={viewMode}
          path={path}
          sorting={sorting}
          onSortChange={setSorting}
          onContextMenu={handleContextMenu}
          onPreview={handlePreview}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
        />
      )}

      {/* Selection Bar */}
      {selectedItems.length > 0 && (
        <SelectionBar
          selectedCount={selectedItems.length}
          onClear={() => setSelectedItems([])}
          onDelete={() => setDeleteOpen(true)}
          onMove={() => setMoveOpen(true)}
          onShare={() => setShareOpen(true)}
          canDelete={canDelete}
          canShare={canShare}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={closeContextMenu}
          onOpen={() => {
            if (contextMenu.item.isDir) {
              router.push(`/files${contextMenu.item.path}/`);
            } else {
              handlePreview(contextMenu.item);
            }
            closeContextMenu();
          }}
          onDownload={() => {
            window.open(api.getDownloadUrl(contextMenu.item.path), "_blank");
            closeContextMenu();
          }}
          onRename={() => {
            setRenameOpen(true);
            closeContextMenu();
          }}
          onDelete={() => {
            setDeleteOpen(true);
            closeContextMenu();
          }}
          onShare={() => {
            setShareOpen(true);
            closeContextMenu();
          }}
          onCopy={() => {
            // Copy to clipboard
            navigator.clipboard.writeText(window.location.origin + `/files${contextMenu.item.path}`);
            toast.success("Link copied to clipboard");
            closeContextMenu();
          }}
          canRename={canRename}
          canDelete={canDelete}
          canShare={canShare}
        />
      )}

      {/* Dialogs */}
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
        items={items.filter((i) => !i.isDir)}
        onNavigate={(item) => setPreviewItem(item)}
      />
    </div>
  );
}
