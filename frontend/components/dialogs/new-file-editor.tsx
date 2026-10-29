"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeEditor, editorLanguage, type CodeEditorHandle } from "@/components/preview/code-editor";
import { joinPaths } from "@/lib/utils";
import api from "@/lib/api";
import { validateName } from "@/lib/paths";

const COMMON_EXTENSIONS = [
  "txt", "md", "json", "yaml", "yml", "toml", "ini", "env", "csv", "xml", "html", "css",
  "js", "ts", "jsx", "tsx", "py", "sh", "go", "rs", "java", "php", "sql", "conf",
];

interface NewFileEditorProps {
  path: string;
  onCreated: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

// Loaded lazily by NewFileDialog so CodeMirror is only downloaded when needed.
export default function NewFileEditor({ path, onCreated, onCancel, onDirtyChange }: NewFileEditorProps) {
  const [name, setName] = useState("untitled");
  const [extension, setExtension] = useState("txt");
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const editorRef = useRef<CodeEditorHandle>(null);

  const ext = extension.trim().replace(/^\.+/, "");
  const fileName = name.trim() + (ext ? `.${ext}` : "");
  const language = editorLanguage(fileName, "auto")?.name ?? "Plain text";

  const handleCreate = async () => {
    if (isCreating) return;
    if (!name.trim()) {
      toast.error("Please enter a file name");
      return;
    }
    const nameError = validateName(fileName);
    if (nameError) {
      toast.error(nameError);
      return;
    }

    setIsCreating(true);
    try {
      await api.createFile(joinPaths(path, fileName), editorRef.current?.snapshot().code ?? content);
      toast.success(`${fileName} created`);
      onDirtyChange(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create file");
    } finally {
      setIsCreating(false);
    }
  };

  const focusEditorOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editorRef.current?.focus();
    }
  };

  return (
    <>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="new-file-name">File name</Label>
          <Input
            id="new-file-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={focusEditorOnEnter}
            placeholder="untitled"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
        <div className="space-y-1.5 sm:w-36">
          <Label htmlFor="new-file-extension">Extension</Label>
          <Input
            id="new-file-extension"
            list="new-file-extensions"
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            onKeyDown={focusEditorOnEnter}
            placeholder="none"
          />
          <datalist id="new-file-extensions">
            {COMMON_EXTENSIONS.map((item) => <option key={item} value={item} />)}
          </datalist>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate" dir="ltr">{fileName || "—"}</span>
        <span className="shrink-0">{language}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <CodeEditor
          ref={editorRef}
          value=""
          filename={fileName}
          language="auto"
          readOnly={false}
          wordWrap
          fontSize={14}
          tabWidth={2}
          useTabs={false}
          onChange={(code) => {
            setContent(code);
            onDirtyChange(code.length > 0);
          }}
          onStatus={() => {}}
          onSave={() => void handleCreate()}
          onFormat={() => {}}
        />
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <span className="hidden text-xs text-muted-foreground sm:mr-auto sm:inline">Ctrl/⌘ + S to create</span>
        <Button variant="outline" onClick={onCancel} disabled={isCreating}>
          Cancel
        </Button>
        <Button onClick={() => void handleCreate()} disabled={isCreating || !name.trim()}>
          {isCreating ? "Creating..." : "Create"}
        </Button>
      </div>
    </>
  );
}
