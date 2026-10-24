"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilePreview } from "@/components/preview/file-preview";
import { previewKind } from "@/lib/preview";
import { cn, formatBytes } from "@/lib/utils";
import api from "@/lib/api";
import type { FileItem } from "@/types";

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | null;
  items: FileItem[];
  onNavigate: (item: FileItem) => void;
  canEdit: boolean;
  canDownload: boolean;
  onSaved?: () => void;
}
export function PreviewDialog({
  open,
  onOpenChange,
  item,
  items,
  onNavigate,
  canEdit,
  canDownload,
  onSaved,
}: PreviewDialogProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displaySize, setDisplaySize] = useState(item?.size || 0);
  useEffect(() => setDisplaySize(item?.size || 0), [item?.path]);
  const state = useRef({ dirty, busy });
  state.current = { dirty, busy };
  const currentIndex = item
    ? items.findIndex((entry) => entry.path === item.path)
    : -1;
  const canLeave = useCallback(
    () =>
      !state.current.busy &&
      (!state.current.dirty ||
        window.confirm("Discard unsaved changes before leaving this file?")),
    [],
  );
  const changeOpen = (next: boolean) => {
    if (next || canLeave()) onOpenChange(next);
  };
  const move = useCallback(
    (direction: number) => {
      const next = currentIndex + direction;
      if (currentIndex >= 0 && next >= 0 && next < items.length && canLeave())
        onNavigate(items[next]);
    },
    [currentIndex, items, onNavigate, canLeave],
  );
  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      setDirty(false);
      setBusy(false);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input,textarea,select,button,a,.cm-editor,video,audio",
          ))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, move]);
  const loadText = useCallback(
    (signal: AbortSignal) => api.getFileContent(item!.path, signal),
    [item?.path],
  );
  if (!item) return null;
  const kind = previewKind(item);
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showClose={false}
        className={cn(
          "flex max-h-none min-w-0 flex-col gap-0 overflow-hidden p-0",
          fullscreen
            ? "h-[100dvh] w-screen max-w-none rounded-none"
            : "h-[92dvh] w-[96vw] max-w-7xl sm:rounded-xl",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden rounded-lg border bg-muted p-2 sm:block">
              <File className="h-5 w-5 text-primary" />
            </span>
            <div className="min-w-0">
              <DialogTitle
                className="truncate text-sm sm:text-base"
                title={item.name}
              >
                {item.name}
                {dirty && <span className="ml-2 text-amber-500">●</span>}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {formatBytes(displaySize)} ·{" "}
                {kind === "code" ? "Code / text" : kind.toUpperCase()} ·{" "}
                {item.path}
              </DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!canDownload}
              onClick={() =>
                window.open(
                  api.getDownloadUrl(item.path),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Download original</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                fullscreen ? "Exit full screen preview" : "Full screen preview"
              }
              onClick={() => setFullscreen((value) => !value)}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close preview"
              disabled={busy}
              onClick={() => changeOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-muted/20">
          <FilePreview
            key={item.path}
            item={item}
            url={api.getDownloadUrl(item.path, true)}
            canEdit={canEdit}
            canDownload={canDownload}
            loadText={loadText}
            onSave={async (content) => {
              await api.updateFile(item.path, content);
              setDisplaySize(new TextEncoder().encode(content).byteLength);
              onSaved?.();
            }}
            onDirtyChange={(value) => {
              state.current.dirty = value;
              setDirty(value);
            }}
            onBusyChange={(value) => {
              state.current.busy = value;
              setBusy(value);
            }}
            subtitleURL={(path) => api.getSubtitleUrl(path)}
          />
        </div>
        {items.length > 1 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || currentIndex <= 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous file
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIndex >= 0 ? currentIndex + 1 : "—"} of {items.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={
                busy || currentIndex < 0 || currentIndex >= items.length - 1
              }
              onClick={() => move(1)}
            >
              Next file
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
