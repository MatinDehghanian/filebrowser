"use client";

import type { ReactNode } from "react";
import { FileArchive, Files } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// "zip" and "targz" are the backend's `algo` values for archive downloads.
export type DownloadFormat = "zip" | "targz" | "separate";

interface DownloadMenuProps {
  /** The button that opens the menu. */
  children: ReactNode;
  onDownload: (format: DownloadFormat) => void;
  /** Offer downloading each selected item on its own instead of one archive. */
  allowSeparate?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}

export function DownloadMenu({ children, onDownload, allowSeparate, align = "end", side }: DownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side}>
        <DropdownMenuItem onSelect={() => onDownload("zip")}>
          <FileArchive className="mr-2 h-4 w-4" />
          Download as ZIP
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDownload("targz")}>
          <FileArchive className="mr-2 h-4 w-4" />
          Download as TAR.GZ
        </DropdownMenuItem>
        {allowSeparate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDownload("separate")}>
              <Files className="mr-2 h-4 w-4" />
              Download separately
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
