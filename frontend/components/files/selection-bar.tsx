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
  /** Icon only, for when the labeled bar does not fit. */
  compact?: boolean;
}

const Action = forwardRef<HTMLButtonElement, ActionProps>(function Action(
  { label, icon, title, destructive, compact, ...props },
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
        "h-9 shrink-0 gap-2",
        compact ? "w-8" : "w-auto px-3",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {icon}
      {!compact && <span>{label}</span>}
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const bounds = useMainBounds(containerRef);

  // Labels show only when the labeled bar fits the space next to the sidebar,
  // which a viewport breakpoint cannot tell (e.g. a narrow window with the
  // sidebar expanded). The labeled width is measured while labels are shown.
  const [labeledWidth, setLabeledWidth] = useState<number | null>(null);
  const available = typeof bounds?.width === "number" ? bounds.width - 32 : Infinity;
  const compact = labeledWidth !== null && labeledWidth > available;
  const actionsKey = [canMove, canCopy && !!onCopy, canShare, canDownload && !!onDownload, canDelete].join();

  useLayoutEffect(() => {
    setLabeledWidth(null);
  }, [actionsKey]);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (compact || !toolbar) return;
    const width = toolbar.scrollWidth + toolbar.offsetWidth - toolbar.clientWidth;
    setLabeledWidth((prev) => (prev === width ? prev : width));
  }, [compact, available, actionsKey]);

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
        ref={toolbarRef}
        role="toolbar"
        aria-label="Selection actions"
        className={cn(
          "pointer-events-auto flex max-w-full items-center overflow-x-auto rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur",
          compact ? "gap-0.5" : "gap-1"
        )}
      >
        {/* Fixed width so the bar does not resize as the count changes. */}
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            compact ? "px-1.5 text-xs" : "w-32 px-2 text-sm"
          )}
        >
          {selectedCount}
          {!compact && ` item${selectedCount !== 1 ? "s" : ""}`} selected
        </span>

        {!compact && <div className="mx-1 h-6 w-px shrink-0 bg-border" />}

        {canMove && <Action label="Move" icon={<FolderInput className="h-4 w-4" />} onClick={onMove} compact={compact} />}

        {canCopy && onCopy && <Action label="Copy" icon={<Copy className="h-4 w-4" />} onClick={onCopy} compact={compact} />}

        {/* Disabled rather than hidden for several items, so the other buttons stay put. */}
        {canShare && (
          <Action
            label="Share"
            icon={<Share2 className="h-4 w-4" />}
            onClick={onShare}
            disabled={selectedCount !== 1}
            title={selectedCount === 1 ? "Share" : "Select a single item to share"}
            compact={compact}
          />
        )}

        {canDownload && onDownload && (downloadIsArchive ? (
          <DownloadMenu onDownload={onDownload} allowSeparate={selectedCount > 1} align="center" side="top">
            <Action label="Download" icon={<Download className="h-4 w-4" />} compact={compact} />
          </DownloadMenu>
        ) : (
          <Action label="Download" icon={<Download className="h-4 w-4" />} onClick={() => onDownload()} compact={compact} />
        ))}

        {canDelete && (
          <Action label="Delete" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} destructive compact={compact} />
        )}

        {!compact && <div className="mx-1 h-6 w-px shrink-0 bg-border" />}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={onClear}
          className={cn("h-9 shrink-0", compact ? "w-8" : "w-9")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
