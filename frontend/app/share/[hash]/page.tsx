"use client";

import { useState, useEffect, use } from "react";
import {
  Download,
  FolderOpen,
  Lock,
  Eye,
  EyeOff,
  FileText,
  X,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import ShareClient from "./share-client";

const PLACEHOLDER_HASH = "placeholder";

export function generateStaticParams() {
  return [{ hash: PLACEHOLDER_HASH }];
}

interface SharePageProps {
  params: { hash: string };
}

export default function SharePage({ params }: SharePageProps) {
  return <ShareClient initialHash={params.hash} />;
}
    <div className="min-h-screen flex justify-center bg-background">
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>
                    {currentPath
                      ? currentPath.split("/").pop()
                      : "Shared Folder"}
                  </CardTitle>
                  <CardDescription>
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => handleDownload(currentPath)}>
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
              <Button variant="outline" onClick={() => setIsShareQrOpen(true)}>
                <QrCode className="mr-2 h-4 w-4" />
                QR Code
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Breadcrumb */}
            {currentPath && (
              <div className="mb-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleNavigateUp}>
                  .. Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPath}
                </span>
              </div>
            )}

            {sortedItems.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={(value) => handleSelectAll(Boolean(value))}
                  />
                  <Label
                    htmlFor="select-all"
                    className="cursor-pointer text-sm"
                  >
                    Select all
                  </Label>
                  {selectedPaths.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({selectedPaths.length} selected)
                    </span>
                  )}
                </div>

                <Button onClick={handleDownloadSelected}>
                  <Download className="mr-2 h-4 w-4" />
                  {selectedPaths.length > 0
                    ? "Download Selected"
                    : "Download All"}
                </Button>
              </div>
            )}

            {/* File List */}
            <ScrollArea className="h-[60vh]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">This folder is empty</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedItems.map((item) => (
                    <div
                      key={item.path}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                      onClick={() => handleNavigate(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleNavigate(item);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                    >
                      <Checkbox
                        checked={selectedPaths.includes(item.path)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(value) =>
                          toggleSelectItem(item.path, Boolean(value))
                        }
                      />
                      <FileIcon name={item.name} isDir={item.isDir} size="md" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="truncate font-medium">{item.name}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.isDir ? "-" : formatBytes(item.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-5xl">
          {previewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">
                  {previewItem.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/10 p-2">
                  {renderFilePreview(previewItem)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    {formatBytes(previewItem.size)} •{" "}
                    {formatDate(previewItem.modified)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Close
                    </Button>
                    <Button
                      onClick={() =>
                        handleDownload(previewItem.path, previewItem)
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ShareQrDialog
        open={isShareQrOpen}
        onOpenChange={setIsShareQrOpen}
        url={getShareUrl()}
        title="Share Link QR Code"
      />
    </div>
  );
}
