"use client";

import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X, Trash2, FolderInput, Share2, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadMenu, type DownloadFormat } from "@/components/files/download-menu";
import { cn } from "@/lib/utils";

interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
  onShare: () => void;
  onDownload?: (format?: DownloadFormat) => void;
  /** Download opens a menu of archive formats instead of downloading directly. */
  downloadIsArchive?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  canDownload?: boolean;
  canMove?: boolean;
  canCopy?: boolean;
  onCopy?: () => void;
}

// Extra button props let a menu trigger (DownloadMenu) wrap an action.
interface ActionProps extends Omit<React.ComponentPropsWithoutRef<"button">, "children"> {
  label: string;
  icon: ReactNode;
  destructive?: boolean;
}

const Action = forwardRef<HTMLButtonElement, ActionProps>(function Action(
  { label, icon, title, destructive, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      {...props}
      variant="ghost"
      size="icon"
      aria-label={label}
      title={title ?? label}
      className={cn(
        "h-9 w-8 shrink-0 gap-2 sm:w-auto sm:px-3",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
});

// Keeps the fixed bar over the main content area, so it is centered next to
// the sidebar rather than in the whole window, including while the sidebar
// collapses or the window resizes.
function useMainBounds(ref: React.RefObject<HTMLElement | null>) {
  const [bounds, setBounds] = useState<CSSProperties>();

  useLayoutEffect(() => {
    const main = ref.current?.closest("main");
    if (!main) return;

    const update = () => {
      const rect = main.getBoundingClientRect();
      setBounds({ left: rect.left, width: rect.width, right: "auto" });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(main);
    window.addEventListener("resize", update);
    // The sidebar animates its width; measure again once it settles.
    document.addEventListener("transitionend", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("transitionend", update);
    };
  }, [ref]);

  return bounds;
}

export function SelectionBar({
  selectedCount,
  onClear,
  onDelete,
  onMove,
  onShare,
  onDownload,
  downloadIsArchive = false,
  canDelete = true,
  canShare = true,
  canDownload = true,
  canMove = false,
  canCopy = false,
  onCopy,
}: SelectionBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bounds = useMainBounds(containerRef);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={bounds}
      className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 sm:bottom-4 sm:px-4"
    >
      <div
        role="toolbar"
        aria-label="Selection actions"
        className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur sm:gap-1"
      >
        {/* Fixed width so the bar does not resize as the count changes. */}
        <span className="shrink-0 px-1.5 text-xs font-medium tabular-nums sm:w-32 sm:px-2 sm:text-sm">
          {selectedCount}
          <span className="hidden sm:inline"> item{selectedCount !== 1 ? "s" : ""}</span> selected
        </span>

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" />

        {canMove && <Action label="Move" icon={<FolderInput className="h-4 w-4" />} onClick={onMove} />}

        {canCopy && onCopy && <Action label="Copy" icon={<Copy className="h-4 w-4" />} onClick={onCopy} />}

        {/* Disabled rather than hidden for several items, so the other buttons stay put. */}
        {canShare && (
          <Action
            label="Share"
            icon={<Share2 className="h-4 w-4" />}
            onClick={onShare}
            disabled={selectedCount !== 1}
            title={selectedCount === 1 ? "Share" : "Select a single item to share"}
          />
        )}

        {canDownload && onDownload && (downloadIsArchive ? (
          <DownloadMenu onDownload={onDownload} allowSeparate={selectedCount > 1} align="center" side="top">
            <Action label="Download" icon={<Download className="h-4 w-4" />} />
          </DownloadMenu>
        ) : (
          <Action label="Download" icon={<Download className="h-4 w-4" />} onClick={() => onDownload()} />
        ))}

        {canDelete && (
          <Action label="Delete" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} destructive />
        )}

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" />

        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={onClear}
          className="h-9 w-8 shrink-0 sm:w-9"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
