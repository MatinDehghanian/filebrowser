export interface EditorPreferences {
  wordWrap: boolean;
  fontSize: number;
  indentation: "auto" | "2" | "4" | "tabs";
  formatOnSave: boolean;
}
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  wordWrap: false,
  fontSize: 14,
  indentation: "auto",
  formatOnSave: false,
};
export function parseEditorPreferences(raw: string | null): EditorPreferences {
  try {
    const value = JSON.parse(raw || "{}");
    return {
      wordWrap: typeof value.wordWrap === "boolean" ? value.wordWrap : false,
      fontSize:
        Number.isInteger(value.fontSize) &&
        value.fontSize >= 11 &&
        value.fontSize <= 22
          ? value.fontSize
          : 14,
      indentation: ["auto", "2", "4", "tabs"].includes(value.indentation)
        ? value.indentation
        : "auto",
      formatOnSave: value.formatOnSave === true,
    };
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}
export function indentationFor(
  language: string,
  preference: EditorPreferences["indentation"],
) {
  if (preference === "tabs" || (preference === "auto" && language === "Go"))
    return { tabWidth: 4, useTabs: true };
  return {
    tabWidth:
      preference === "4" ||
      (preference === "auto" &&
        ["Python", "Java", "C", "C++", "C#", "Rust"].includes(language))
        ? 4
        : 2,
    useTabs: false,
  };
}
