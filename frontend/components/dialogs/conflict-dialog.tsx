import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Conflict, ConflictChoice } from "@/lib/transfers";

export function useConflictResolver() {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const pending = useRef<((choice: ConflictChoice) => void) | null>(null);
  const saved = useRef<ConflictChoice | null>(null);
  const reset = useCallback(() => {
    saved.current = null;
    setApplyAll(false);
  }, []);
  useEffect(
    () => () => {
      pending.current?.("cancel");
    },
    [],
  );
  const resolve = useCallback((next: Conflict): Promise<ConflictChoice> => {
    const choice = saved.current;
    if (
      choice &&
      choice !== "resume" &&
      (choice !== "replace" || next.canReplace !== false)
    )
      return Promise.resolve(choice);
    setConflict(next);
    return new Promise((done) => {
      pending.current = done;
    });
  }, []);
  const choose = (choice: ConflictChoice) => {
    if (applyAll && choice !== "cancel" && choice !== "resume")
      saved.current = choice;
    const done = pending.current;
    pending.current = null;
    setConflict(null);
    done?.(choice);
  };
  const dialog = (
    <Dialog
      open={!!conflict}
      onOpenChange={(open) => !open && choose("cancel")}
    >
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>File already exists</DialogTitle>
        </DialogHeader>
        <p className="break-words text-sm">
          Choose what to do with <strong>{conflict?.name}</strong>.
        </p>
        {conflict?.canResume && (
          <p className="text-sm text-muted-foreground">
            An unfinished upload of this file is available.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {conflict?.canResume && (
            <Button onClick={() => choose("resume")}>Resume</Button>
          )}
          {conflict?.canReplace !== false && (
            <Button variant="outline" onClick={() => choose("replace")}>
              Replace
            </Button>
          )}
          <Button variant="outline" onClick={() => choose("keep")}>
            Keep both
          </Button>
          <Button variant="outline" onClick={() => choose("skip")}>
            Skip
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyAll}
            onChange={(event) => setApplyAll(event.target.checked)}
          />
          Use this choice for remaining conflicts
        </label>
        <Button variant="ghost" onClick={() => choose("cancel")}>
          Stop this batch
        </Button>
      </DialogContent>
    </Dialog>
  );
  return { resolve, reset, dialog };
}
