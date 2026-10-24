import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { basicSetup } from "codemirror";
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentUnit, LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import {
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "@/components/theme-provider";

export const EDITOR_LANGUAGES = [...languages].sort((a, b) =>
  a.name.localeCompare(b.name),
);
export function editorLanguage(filename: string, choice: string) {
  if (choice !== "auto")
    return languages.find((language) => language.name === choice);
  const matched = LanguageDescription.matchFilename(languages, filename);
  if (matched) return matched;
  const ext = filename.toLowerCase().split(".").pop() || "";
  const fallbacks: Record<string, string> = {
    jsonc: "JSON",
    json5: "JSON",
    prettierrc: "JSON",
    babelrc: "JSON",
    eslintrc: "JSON",
    stylelintrc: "JSON",
    mdx: "Markdown",
    env: "Shell",
    conf: "Shell",
    toml: "TOML",
  };
  return languages.find((language) => language.name === fallbacks[ext]);
}
export interface EditorStatus {
  line: number;
  column: number;
  lines: number;
  selected: number;
  undo: boolean;
  redo: boolean;
}
export interface CodeEditorHandle {
  snapshot: () => { code: string; cursorOffset: number };
  replace: (code: string, cursorOffset?: number) => void;
  undo: () => void;
  redo: () => void;
  search: () => void;
  focus: () => void;
}
interface CodeEditorProps {
  value: string;
  filename: string;
  language: string;
  readOnly: boolean;
  wordWrap: boolean;
  fontSize: number;
  tabWidth: number;
  useTabs: boolean;
  onChange: (code: string) => void;
  onStatus: (status: EditorStatus) => void;
  onSave: () => void;
  onFormat: () => void;
}

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-geist-mono)",
    lineHeight: "1.65",
  },
  ".cm-content": { padding: "12px 0", minHeight: "100%" },
  ".cm-line": { padding: "0 16px" },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted) / 0.45)",
    color: "hsl(var(--muted-foreground))",
    borderRight: "1px solid hsl(var(--border))",
  },
  ".cm-activeLineGutter, .cm-activeLine": {
    backgroundColor: "hsl(var(--primary) / 0.06)",
  },
  ".cm-panels": {
    backgroundColor: "hsl(var(--muted))",
    color: "hsl(var(--foreground))",
  },
  ".cm-panel.cm-search": {
    padding: "8px",
    fontFamily: "var(--font-geist-sans)",
  },
  ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search select":
    {
      color: "hsl(var(--foreground))",
      backgroundColor: "hsl(var(--background))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "4px",
      margin: "3px",
      padding: "3px 6px",
    },
  ".cm-focused": { outline: "none" },
});

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const current = useRef(props);
    current.current = props;
    const config = useRef(new Compartment());
    const syntax = useRef(new Compartment());
    const { theme } = useTheme();
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    useImperativeHandle(
      ref,
      () => ({
        snapshot: () => ({
          code: viewRef.current?.state.sliceDoc() || "",
          cursorOffset: viewRef.current
            ? viewRef.current.state.sliceDoc(
                0,
                viewRef.current.state.selection.main.head,
              ).length
            : 0,
        }),
        replace: (code, cursorOffset) => {
          const view = viewRef.current;
          if (!view) return;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: code },
            selection: EditorSelection.cursor(
              code
                .slice(
                  0,
                  Math.min(
                    cursorOffset ?? view.state.selection.main.head,
                    code.length,
                  ),
                )
                .replace(/\r\n|\r/g, "\n").length,
            ),
            annotations: Transaction.userEvent.of("input.format"),
            scrollIntoView: true,
          });
        },
        undo: () => {
          if (viewRef.current) {
            undo(viewRef.current);
            viewRef.current.focus();
          }
        },
        redo: () => {
          if (viewRef.current) {
            redo(viewRef.current);
            viewRef.current.focus();
          }
        },
        focus: () => {
          const view = viewRef.current;
          if (view?.dom.getClientRects().length) view.focus();
        },
        search: () => {
          if (viewRef.current) openSearchPanel(viewRef.current);
        },
      }),
      [],
    );

    useEffect(() => {
      if (!host.current) return;
      const view = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: current.current.value,
          extensions: [
            keymap.of([
              {
                key: "Mod-s",
                run: () => {
                  current.current.onSave();
                  return true;
                },
              },
              {
                key: "Mod-Shift-f",
                run: () => {
                  current.current.onFormat();
                  return true;
                },
              },
              {
                key: "Shift-Alt-f",
                run: () => {
                  current.current.onFormat();
                  return true;
                },
              },
              indentWithTab,
            ]),
            basicSetup,
            baseTheme,
            EditorState.lineSeparator.of(
              current.current.value.match(/\r\n|\r|\n/)?.[0] || "\n",
            ),
            syntax.current.of([]),
            config.current.of([]),
            EditorView.contentAttributes.of({
              "aria-label": "Code editor",
              spellcheck: "false",
              autocapitalize: "off",
              autocorrect: "off",
              "data-gramm": "false",
            }),
            EditorView.editorAttributes.of({ dir: "ltr" }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged)
                current.current.onChange(update.state.sliceDoc());
              const selection = update.state.selection.main;
              const line = update.state.doc.lineAt(selection.head);
              current.current.onStatus({
                line: line.number,
                column: selection.head - line.from + 1,
                lines: update.state.doc.lines,
                selected: selection.to - selection.from,
                undo: undoDepth(update.state) > 0,
                redo: redoDepth(update.state) > 0,
              });
            }),
          ],
        }),
      });
      viewRef.current = view;
      return () => {
        viewRef.current = null;
        view.destroy();
      };
    }, []);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: config.current.reconfigure([
          dark ? oneDark : [],
          baseTheme,
          EditorState.readOnly.of(props.readOnly),
          EditorView.editable.of(!props.readOnly),
          EditorState.tabSize.of(props.tabWidth),
          indentUnit.of(props.useTabs ? "\t" : " ".repeat(props.tabWidth)),
          props.wordWrap ? EditorView.lineWrapping : [],
          EditorView.theme({ "&": { fontSize: `${props.fontSize}px` } }),
        ]),
      });
    }, [
      dark,
      props.readOnly,
      props.wordWrap,
      props.fontSize,
      props.tabWidth,
      props.useTabs,
    ]);

    useEffect(() => {
      let active = true;
      const description = editorLanguage(props.filename, props.language);
      const view = viewRef.current;
      if (!description || props.value.length > 1024 * 1024) {
        view?.dispatch({ effects: syntax.current.reconfigure([]) });
        return;
      }
      description
        .load()
        .then((support) => {
          if (active)
            view?.dispatch({ effects: syntax.current.reconfigure(support) });
        })
        .catch(() => {
          /* Plain text remains usable if a language module cannot load. */
        });
      return () => {
        active = false;
      };
    }, [props.filename, props.language]);

    return <div ref={host} className="h-full min-h-0 w-full overflow-hidden" />;
  },
);
