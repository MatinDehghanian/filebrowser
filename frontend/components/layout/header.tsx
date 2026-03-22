"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Upload,
  FolderPlus,
  FilePlus,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types";

interface HeaderProps {
  path: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onRefresh: () => void;
  canCreate?: boolean;
}

export function Header({
  path,
  viewMode,
  onViewModeChange,
  onUpload,
  onNewFolder,
  onNewFile,
  onRefresh,
  canCreate = true,
}: HeaderProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const currentSearch =
      searchParams.get("search") ?? searchParams.get("query") ?? "";
    setSearchQuery(currentSearch);
  }, [searchParams]);

  useEffect(() => {
    const currentSearch =
      (searchParams.get("search") ?? searchParams.get("query") ?? "").trim();
    const normalizedSearch = searchQuery.trim();

    if (normalizedSearch === currentSearch) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!normalizedSearch) {
        navigate(`/files${path}`, { replace: true });
        return;
      }

      navigate(`/files${path}?search=${encodeURIComponent(normalizedSearch)}`, {
        replace: true,
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [navigate, path, searchParams, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedSearch = searchQuery.trim();

    if (!normalizedSearch) {
      navigate(`/files${path}`);
      return;
    }

    navigate(`/files${path}?search=${encodeURIComponent(normalizedSearch)}`);
  };


  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex flex-col gap-2 border-b bg-background px-3 py-2 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-0">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex w-full min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
          {canCreate && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onUpload}>
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <FilePlus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>New</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onNewFolder}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onNewFile}>
                    <FilePlus className="mr-2 h-4 w-4" />
                    New File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="mx-1 h-6 w-px bg-border sm:mx-2" />

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border bg-muted p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    viewMode === "list" && "bg-background shadow-sm"
                  )}
                  onClick={() => onViewModeChange("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>List View</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    viewMode === "mosaic" && "bg-background shadow-sm"
                  )}
                  onClick={() => onViewModeChange("mosaic")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grid View</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRefresh} className="shrink-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
