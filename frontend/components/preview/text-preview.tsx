import DOMPurify from "dompurify";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Undo2,
  WrapText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CodeEditor,
  editorLanguage,
  EDITOR_LANGUAGES,
  type CodeEditorHandle,
  type EditorStatus,
} from "./code-editor";
import { formatterParser } from "@/lib/formatter";
import { formatInWorker } from "@/lib/format-client";
import {
  indentationFor,
  parseEditorPreferences,
  type EditorPreferences,
} from "@/lib/editor-options";
import {
  htmlPreviewDocument,
  MAX_TEXT_BYTES,
  type PreviewKind,
} from "@/lib/preview";
import { cn, formatBytes } from "@/lib/utils";
import type { FileItem } from "@/types";

const MarkdownPreview = lazy(() => import("./markdown-preview"));
const TablePreview = lazy(() => import("./table-preview"));
const PREF_KEY = "filebrowser_editor_preferences";
interface TextPreviewProps {
  item: FileItem;
  kind: PreviewKind;
  canEdit: boolean;
  loadText: (signal: AbortSignal) => Promise<string>;
  onSave?: (content: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}
const initialStatus: EditorStatus = {
  line: 1,
  column: 1,
  lines: 1,
  selected: 0,
  undo: false,
  redo: false,
};

export default function TextPreview({
  item,
  kind,
  canEdit,
  loadText,
  onSave,
  onDirtyChange,
  onBusyChange,
}: TextPreviewProps) {
  const [original, setOriginal] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState(kind === "code" ? "source" : "preview");
  const [language, setLanguage] = useState("auto");
  const [preferences, setPreferences] = useState<EditorPreferences>(() => {
    try {
      return parseEditorPreferences(localStorage.getItem(PREF_KEY));
    } catch {
      return parseEditorPreferences(null);
    }
  });
  const [operation, setOperation] = useState<"save" | "format" | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const activeFormat = useRef<ReturnType<typeof formatInWorker> | null>(null);
  const callbacks = useRef({ loadText, onDirtyChange, onBusyChange });
  callbacks.current = { loadText, onDirtyChange, onBusyChange };
  const languageName =
    editorLanguage(item.name, language)?.name || "Plain text";
  const indentation = indentationFor(languageName, preferences.indentation);
  const supportsFormatting = Boolean(formatterParser(item.name, language));
  const dirty = original !== null && draft !== original;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeFormat.current?.cancel();
      callbacks.current.onDirtyChange?.(false);
      callbacks.current.onBusyChange?.(false);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setOriginal(null);
    setDraft("");
    setLoadError("");
    if (item.size > MAX_TEXT_BYTES) {
      setLoadError(
        "Text preview is limited to 10 MB. Download this file to open it.",
      );
      return;
    }
    callbacks.current
      .loadText(controller.signal)
      .then((content) => {
        if (active) {
          setOriginal(content);
          setDraft(content);
        }
      })
      .catch((reason) => {
        if (active)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Could not load the file.",
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [item.path, revision]);
  useEffect(() => {
    callbacks.current.onDirtyChange?.(dirty);
  }, [dirty]);
  useEffect(() => {
    callbacks.current.onBusyChange?.(operation !== null);
  }, [operation]);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }, [preferences]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const getFormatted = async (code: string, cursorOffset: number) => {
    const request = formatInWorker({
      filename: item.name,
      code,
      cursorOffset,
      language,
      ...indentation,
    });
    activeFormat.current = request;
    try {
      return await request.promise;
    } finally {
      if (activeFormat.current === request) activeFormat.current = null;
    }
  };
  const handleFormat = async () => {
    if (!canEdit || !supportsFormatting || busy.current || !editor.current)
      return;
    busy.current = true;
    setOperation("format");
    setError("");
    try {
      const snapshot = editor.current.snapshot();
      const result = await getFormatted(snapshot.code, snapshot.cursorOffset);
      if (!mounted.current) return;
      editor.current?.replace(result.formatted, result.cursorOffset);
      setDraft(result.formatted);
      setSaved(false);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not format the code.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setOperation(null);
        requestAnimationFrame(() => editor.current?.focus());
      }
    }
  };
  const handleSave = async () => {
    if (!canEdit || !onSave || !dirty || busy.current || !editor.current)
      return;
    busy.current = true;
    setOperation("save");
    setError("");
    try {
      const snapshot = editor.current.snapshot();
      let content = snapshot.code;
      if (preferences.formatOnSave && supportsFormatting) {
        const result = await getFormatted(content, snapshot.cursorOffset);
        if (!mounted.current) return;
        content = result.formatted;
        editor.current?.replace(content, result.cursorOffset);
        setDraft(content);
      }
      await onSave(content);
      if (mounted.current) {
        setOriginal(content);
        setSaved(true);
      }
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : "Could not save the file.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setOperation(null);
        requestAnimationFrame(() => editor.current?.focus());
      }
    }
  };
  const updateDraft = useCallback((content: string) => {
    setDraft(content);
    setError("");
    setSaved(false);
  }, []);
  const updatePreference = <K extends keyof EditorPreferences>(
    key: K,
    value: EditorPreferences[K],
  ) => setPreferences((current) => ({ ...current, [key]: value }));

  if (loadError)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p role="alert" className="max-w-lg text-sm">
          {loadError}
        </p>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Retry preview
        </Button>
      </div>
    );
  if (original === null)
    return (
      <div
        role="status"
        className="flex h-full items-center justify-center gap-3 p-8"
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading file…
      </div>
    );

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDownCapture={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          event.stopPropagation();
          void handleSave();
        }
        if (event.shiftKey && event.key.toLowerCase() === "f") {
          event.preventDefault();
          event.stopPropagation();
          void handleFormat();
        }
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background p-2">
        <div className="flex flex-wrap items-center gap-1">
          {kind !== "code" && (
            <div
              className="mr-2 flex rounded-md border p-0.5"
              role="group"
              aria-label="File view"
            >
              <Button
                variant={mode === "preview" ? "secondary" : "ghost"}
                size="sm"
                className="h-7"
                onClick={() => setMode("preview")}
              >
                Preview
              </Button>
              <Button
                variant={mode === "source" ? "secondary" : "ghost"}
                size="sm"
                className="h-7"
                onClick={() => setMode("source")}
              >
                {canEdit ? "Edit source" : "Source"}
              </Button>
            </div>
          )}
          <select
            aria-label="Code language"
            className="h-8 max-w-40 rounded border bg-background px-2 text-xs"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="auto">
              Auto · {editorLanguage(item.name, "auto")?.name || "Plain text"}
            </option>
            <option value="Plain text">Plain text</option>
            {EDITOR_LANGUAGES.map((entry) => (
              <option value={entry.name} key={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          <Button
            title="Find / replace (Ctrl/Cmd+F)"
            aria-label="Find or replace"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setMode("source");
              requestAnimationFrame(() => editor.current?.search());
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            title="Toggle line wrapping"
            aria-label="Toggle line wrapping"
            aria-pressed={preferences.wordWrap}
            variant={preferences.wordWrap ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => updatePreference("wordWrap", !preferences.wordWrap)}
          >
            <WrapText className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                aria-label="Undo"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={operation !== null || !status.undo}
                onClick={() => editor.current?.undo()}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Redo"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={operation !== null || !status.redo}
                onClick={() => editor.current?.redo()}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draft);
                setCopied(true);
                setTimeout(() => {
                  if (mounted.current) setCopied(false);
                }, 2000);
              } catch {
                setError(
                  "Could not copy the text. Select it in the editor and copy manually.",
                );
              }
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                title={
                  supportsFormatting
                    ? "Format with Prettier (Shift+Alt+F or Ctrl/Cmd+Shift+F)"
                    : "Prettier is unavailable for this language"
                }
                disabled={operation !== null || !supportsFormatting}
                onClick={() => {
                  setMode("source");
                  void handleFormat();
                }}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {operation === "format" ? "Formatting…" : "Prettier"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Discard changes"
                aria-label="Reset changes"
                disabled={!dirty || operation !== null}
                onClick={() => {
                  if (window.confirm("Discard all unsaved changes?")) {
                    editor.current?.replace(original);
                    setDraft(original);
                    setError("");
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                disabled={!dirty || operation !== null}
                onClick={() => void handleSave()}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {operation === "save" ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">{languageName}</span>
          <span>{formatBytes(new TextEncoder().encode(draft).byteLength)}</span>
          {dirty ? (
            <span className="text-amber-600 dark:text-amber-400">
              ● Unsaved changes
            </span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" />
              Saved
            </span>
          ) : (
            <span>{canEdit ? "Ready" : "Read only"}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1">
            Indent
            <select
              aria-label="Indentation"
              className="rounded border bg-background px-2 py-0.5 text-foreground"
              value={preferences.indentation}
              onChange={(event) =>
                updatePreference(
                  "indentation",
                  event.target.value as EditorPreferences["indentation"],
                )
              }
            >
              <option value="auto">Auto</option>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tabs">Tabs</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Font
            <select
              aria-label="Editor font size"
              className="rounded border bg-background px-2 py-0.5 text-foreground"
              value={preferences.fontSize}
              onChange={(event) =>
                updatePreference("fontSize", Number(event.target.value))
              }
            >
              {[11, 12, 13, 14, 16, 18, 20, 22].map((size) => (
                <option value={size} key={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>
          {canEdit && supportsFormatting && (
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={preferences.formatOnSave}
                onChange={(event) =>
                  updatePreference("formatOnSave", event.target.checked)
                }
              />
              Format on save
            </label>
          )}
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex max-h-36 shrink-0 items-start justify-between gap-3 overflow-auto border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
          <button
            aria-label="Dismiss editor error"
            onClick={() => setError("")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {kind === "html" && mode === "preview" && (
        <p className="shrink-0 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Safe HTML preview · scripts, links and external resources are
          disabled.
        </p>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className={cn("h-full", mode !== "source" && "hidden")}>
          <CodeEditor
            ref={editor}
            value={draft}
            filename={item.name}
            language={language}
            readOnly={!canEdit || operation !== null}
            wordWrap={preferences.wordWrap}
            fontSize={preferences.fontSize}
            {...indentation}
            onChange={updateDraft}
            onStatus={setStatus}
            onSave={() => void handleSave()}
            onFormat={() => void handleFormat()}
          />
        </div>
        {mode === "preview" && (
          <div className="h-full overflow-auto">
            <Suspense
              fallback={
                <p role="status" className="p-6">
                  Preparing preview…
                </p>
              }
            >
              {kind === "markdown" ? (
                <MarkdownPreview content={draft} />
              ) : kind === "table" ? (
                <TablePreview
                  content={draft}
                  delimiter={
                    item.name.toLowerCase().endsWith(".tsv") ? "\t" : ","
                  }
                />
              ) : (
                <iframe
                  title={`HTML preview: ${item.name}`}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={htmlPreviewDocument(
                    DOMPurify.sanitize(draft, {
                      WHOLE_DOCUMENT: true,
                      ADD_TAGS: ["style"],
                      FORBID_TAGS: [
                        "script",
                        "iframe",
                        "object",
                        "embed",
                        "meta",
                        "base",
                        "link",
                      ],
                      FORBID_ATTR: ["href", "action", "formaction", "srcset"],
                    }),
                  )}
                  className="h-full min-h-80 w-full bg-white"
                />
              )}
            </Suspense>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          Ln {status.line}, Col {status.column} · {status.lines} lines
          {status.selected ? ` · ${status.selected} selected` : ""}
        </span>
        <span>
          {operation === "format" ? (
            <button
              className="text-primary underline"
              onClick={() => activeFormat.current?.cancel()}
            >
              Cancel formatting
            </button>
          ) : draft.length > 1024 * 1024 ? (
            "Large file · plain-text mode"
          ) : canEdit && !supportsFormatting ? (
            "Syntax highlighting · no Prettier formatter for this language"
          ) : canEdit ? (
            "UTF-8 · Ctrl/Cmd+S save · Ctrl/Cmd+F find"
          ) : (
            "UTF-8 · Read only · Ctrl/Cmd+F find"
          )}
        </span>
      </div>
    </div>
  );
}
