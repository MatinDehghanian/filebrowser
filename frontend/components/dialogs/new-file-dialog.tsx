"use client";

import { lazy, Suspense, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NewFileEditor = lazy(() => import("./new-file-editor"));

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  onComplete: () => void;
}

export function NewFileDialog({
  open,
  onOpenChange,
  path,
  onComplete,
}: NewFileDialogProps) {
  const [dirty, setDirty] = useState(false);

  const close = () => {
    setDirty(false);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (dirty && !window.confirm("Discard this new file?")) return;
    close();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85dvh] max-h-[calc(100dvh-2rem)] w-[96vw] max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>New File</DialogTitle>
          <DialogDescription>Choose a name and extension, write the content, then create it.</DialogDescription>
        </DialogHeader>

        {/* Remounted on every open, so each new file starts empty. */}
        {open && (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            <NewFileEditor
              path={path}
              onDirtyChange={setDirty}
              onCancel={() => handleOpenChange(false)}
              onCreated={() => {
                onComplete();
                close();
              }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
