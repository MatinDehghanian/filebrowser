"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import api from "@/lib/api";
import { INTERNAL_DRAG_TYPE, transferItems } from "@/lib/transfers";
import { useConflictResolver } from "@/components/dialogs/conflict-dialog";
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
import { DownloadMenu, type DownloadFormat } from "@/components/files/download-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown, Download } from "lucide-react";
import { decodePath, encodePath } from "@/lib/paths";
import { joinPaths } from "@/lib/utils";
import type { FileItem, FileListingResponse, ViewMode, Sorting, User } from "@/types";

interface FilesClientProps {
  params?: never;
}

// Rendering thousands of results freezes the page, so searches stop here.
const SEARCH_RESULT_LIMIT = 500;

interface SearchState {
  items: FileItem[];
  loading: boolean;
  truncated: boolean;
  error: Error | null;
}

const IDLE_SEARCH: SearchState = { items: [], loading: false, truncated: false, error: null };

export default function FilesClient({}: FilesClientProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPath = decodePath(location.pathname.replace(/^\/files/, "") || "/");
  const path = rawPath.length > 1 && rawPath.endsWith("/")
    ? rawPath.slice(0, -1)
    : rawPath;

  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuth();

  const conflict = useConflictResolver();
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [transferring, setTransferring] = useState(false);
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
  const [transferAction, setTransferAction] = useState<"move" | "copy">("move");
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

  const [search, setSearch] = useState<SearchState>(IDLE_SEARCH);
  const [searchRun, setSearchRun] = useState(0);

  // A new query, folder or refresh cancels the running search, which also
  // stops the server from walking the rest of the tree.
  useEffect(() => {
    if (!isSearching) {
      setSearch(IDLE_SEARCH);
      return;
    }
    const controller = new AbortController();
    let frame = 0;
    setSearch({ items: [], loading: true, truncated: false, error: null });
    api
      .search(path, searchQuery, {
        signal: controller.signal,
        limit: SEARCH_RESULT_LIMIT,
        // Batch streamed results into one render per frame.
        onProgress: (found) => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => setSearch((prev) => ({ ...prev, items: found })));
        },
      })
      .then((result) => {
        cancelAnimationFrame(frame);
        setSearch({ items: result.items, loading: false, truncated: Boolean(result.truncated), error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        cancelAnimationFrame(frame);
        setSearch((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err : new Error("Search failed") }));
      });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
    };
  }, [isSearching, path, searchQuery, searchRun]);

  const searchError = search.error;
  const isSearchLoading = search.loading && search.items.length === 0;

  const items = useMemo(
    () => (isSearching ? search.items : data?.items || []),
    [data?.items, isSearching, search.items],
  );

  // Clear selection on path change
  useEffect(() => {
    setSelectedItems([]);
    setContextMenu(null);
  }, [path, searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest("[role=dialog], [role=alertdialog]")))
      ) {
        return;
      }

      if (e.key === "Delete" && user?.perm.delete && selectedItems.length > 0) {
        setDeleteOpen(true);
      }

      if (e.key === "F2" && user?.perm.rename && selectedItems.length === 1) {
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
  }, [selectedItems, items, user]);

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
    void mutate();
    if (isSearching) setSearchRun((run) => run + 1);
  }, [mutate, isSearching]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const canCreate = user?.perm?.create ?? false;
  const canDelete = user?.perm?.delete ?? false;
  const canRename = user?.perm?.rename ?? false;
  const canShare = Boolean(user?.perm?.share && user?.perm?.download);
  const canDownload = user?.perm?.download ?? false;
  const canModify = user?.perm?.modify ?? false;

  const allSelected = items.length > 0 && selectedItems.length === items.length;
  // A single file downloads as is; anything else becomes an archive.
  const singleFileSelected = selectedItems.length === 1 && !selectedItems[0].isDir;

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

  // Folders and multiple items are downloaded as one archive in `format`.
  const handleDownloadSelected = (format: DownloadFormat = "zip") => {
    if (!canDownload) {
      return;
    }

    const archiveUrl = (itemPath: string) => {
      const url = new URL(api.getDownloadUrl(itemPath), window.location.origin);
      if (format !== "separate") url.searchParams.set("algo", format);
      return url;
    };

    // While searching, "Download Results" means the results, not the folder.
    const targets = selectedItems.length > 0 || !isSearching ? selectedItems : items;

    if (targets.length === 0) {
      window.open(archiveUrl(path).toString(), "_blank");
      return;
    }

    if (targets.length === 1) {
      const [item] = targets;
      window.open(item.isDir ? archiveUrl(item.path).toString() : api.getDownloadUrl(item.path), "_blank");
      return;
    }

    if (format === "separate") {
      // Browsers may ask once to allow several downloads from this site.
      targets.forEach((item, index) => {
        window.setTimeout(() => {
          const link = document.createElement("a");
          link.href = item.isDir ? archiveUrl(item.path).toString() : api.getDownloadUrl(item.path);
          link.download = "";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, index * 400);
      });
      return;
    }

    const url = archiveUrl(path);

    const relativePaths = targets.map((item) => {
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

  const handleDropUpload = useCallback((files: FileList | File[]) => {
    if (!canCreate) { toast.error("You don't have permission to upload files"); return; }
    setDroppedFiles(Array.from(files)); setUploadOpen(true);
  }, [canCreate]);

  const handleInternalDrop = async (event: React.DragEvent, destination: string) => {
    if (!event.dataTransfer.types.includes(INTERNAL_DRAG_TYPE)) return;
    event.preventDefault(); event.stopPropagation();
    if (transferring) return;
    const action = event.ctrlKey || event.metaKey || !canRename ? "copy" : "move";
    if ((action === "copy" && !canCreate) || (action === "move" && !canRename)) { toast.error("You don't have permission for this transfer"); return; }
    let dragged: FileItem[];
    try { dragged = JSON.parse(event.dataTransfer.getData(INTERNAL_DRAG_TYPE)); if (!Array.isArray(dragged) || !dragged.length || dragged.some((item) => typeof item.path !== "string" || typeof item.name !== "string")) return; } catch { return; }
    setTransferring(true); conflict.reset();
    try {
      const result = await transferItems(dragged, destination, action, conflict.resolve, canModify);
      if (result.completed) { toast.success(`${result.completed} item(s) ${action === "copy" ? "copied" : "moved"}`); handleRefresh(); setSelectedItems([]); }
      if (result.errors.length) toast.error(result.errors.join("; "));
    } finally { setTransferring(false); }
  };

  useEffect(() => {
    if (!canCreate || uploadOpen || previewOpen || moveOpen || renameOpen || newFileOpen || newFolderOpen || deleteOpen || shareOpen) {
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
  }, [canCreate, handleDropUpload, uploadOpen, previewOpen, moveOpen, renameOpen, newFileOpen, newFolderOpen, deleteOpen, shareOpen]);

  const saveDisplayPreference = async (preference: Partial<User>) => {
    if (!user) return;
    try { updateUser(await api.updateUser(user.id, preference)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save display preferences"); }
  };

  return (
    <div
      onDragOver={(event) => { if (event.dataTransfer.types.includes(INTERNAL_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey || !canRename ? "copy" : "move"; } }}
      onDrop={(event) => void handleInternalDrop(event, path)} className="flex h-full flex-col">
      <Header
        path={path}
        viewMode={viewMode}
        onViewModeChange={(mode) => { setViewMode(mode); void saveDisplayPreference({ viewMode: mode }); }}
        sorting={sorting}
        onSortingChange={(next) => { setSorting(next); void saveDisplayPreference({ sorting: next }); }}
        onUpload={() => setUploadOpen(true)}
        onNewFolder={() => setNewFolderOpen(true)}
        onNewFile={() => setNewFileOpen(true)}
        onRefresh={handleRefresh}
        canCreate={canCreate}
      />

      <Breadcrumbs path={path} />
      {transferring && <p role="status" className="px-4 py-2 text-sm text-muted-foreground">Transferring files…</p>}
      {conflict.dialog}

      {items.length > 0 && (
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
            singleFileSelected ? (
              <Button size="sm" onClick={() => handleDownloadSelected()} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Download Selected
              </Button>
            ) : (
              <DownloadMenu
                onDownload={handleDownloadSelected}
                allowSeparate={selectedItems.length > 1 || (isSearching && selectedItems.length === 0 && items.length > 1)}
              >
                <Button size="sm" className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  {selectedItems.length > 0 ? "Download Selected" : isSearching ? "Download Results" : "Download All"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DownloadMenu>
            )
          )}
        </div>
      )}

      {error || searchError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-destructive">{(error || searchError)?.message || "Failed to load files"}</p>
          <Button onClick={handleRefresh}>Retry</Button>
          <Button variant="outline" onClick={() => navigate("/files/")}>Go to root</Button>
        </div>
      ) : isLoading || (isSearching && isSearchLoading) ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {isSearching && (
            <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:text-sm">
              {search.loading && (
                <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              <span>
                {search.truncated ? `First ${items.length}` : items.length} result{items.length !== 1 ? "s" : ""} for "
                {searchQuery}" in {path}
                {search.loading && " — searching…"}
                {search.truncated && " — add more words to narrow the search"}
              </span>
            </div>
          )}

          <FileList
            items={items}
            canDrag={canRename || canCreate}
            onDropItems={(event, destination) => void handleInternalDrop(event, destination)}
            singleClick={user?.singleClick}
            dateFormat={user?.dateFormat}
            locale={user?.locale}
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
          onMove={() => { setTransferAction("move"); setMoveOpen(true); }}
          onCopy={() => { setTransferAction("copy"); setMoveOpen(true); }}
          canMove={canRename}
          canCopy={canCreate}
          onShare={() => setShareOpen(true)}
          onDownload={handleDownloadSelected}
          downloadIsArchive={!singleFileSelected}
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
              navigate(`/files${encodePath(contextMenu.item.path)}/`);
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
          onCopyFiles={() => { setTransferAction("copy"); setMoveOpen(true); }}
          onMove={() => { setTransferAction("move"); setMoveOpen(true); }}
          canCopy={canCreate}
          canDownload={canDownload}
          canRename={canRename}
          canDelete={canDelete}
          canShare={canShare}
        />
      )}

      <UploadDialog
        open={uploadOpen}
        initialFiles={droppedFiles}
        onOpenChange={(open) => { setUploadOpen(open); if (!open) setDroppedFiles([]); }}
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
        onComplete={() => { setSelectedItems([]); handleRefresh(); }}
      />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        items={selectedItems}
        action={transferAction}
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
        canDownload={canDownload}
        onSaved={handleRefresh}
      />
    </div>
  );
}
