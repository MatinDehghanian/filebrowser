import type { FileItem } from "@/types";

export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
export const MAX_FORMAT_BYTES = 1024 * 1024;
export type PreviewKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "markdown"
  | "html"
  | "table"
  | "code"
  | "unsupported";
const extensions = (values: string) => new Set(values.split(" "));
const images = extensions(
  "jpg jpeg png gif webp avif svg bmp ico tif tiff heic heif",
);
const videos = extensions("mp4 webm mkv avi mov wmv flv m4v ogv");
const audio = extensions("mp3 wav ogg flac aac m4a opus aiff");
const text = extensions(
  "js mjs cjs jsx ts mts cts tsx json jsonc json5 css scss less html htm vue svelte astro md markdown mdx yaml yml graphql gql txt log conf ini toml env sh bash zsh fish py go rs java kt kts cpp cc c h hpp cs php rb sql xml csv tsv dockerfile makefile gitignore gitconfig properties bat ps1 r lua tex",
);
const binary = extensions(
  "doc docx xls xlsx ppt pptx odt ods odp rtf zip tar gz bz2 xz rar 7z exe dll bin sqlite db woff woff2 ttf otf",
);
export function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}
export function previewKind(
  item: Pick<FileItem, "name" | "type" | "isDir">,
): PreviewKind {
  if (item.isDir) return "unsupported";
  const ext = extensionOf(item.name);
  if (images.has(ext) || item.type === "image") return "image";
  if (videos.has(ext) || item.type === "video") return "video";
  if (audio.has(ext) || item.type === "audio") return "audio";
  if (ext === "pdf" || item.type === "pdf") return "pdf";
  if (["md", "markdown", "mdx"].includes(ext)) return "markdown";
  if (["html", "htm"].includes(ext)) return "html";
  if (["csv", "tsv"].includes(ext)) return "table";
  if (binary.has(ext)) return "unsupported";
  if (text.has(ext) || item.type === "text" || item.type === "textImmutable")
    return "code";
  return "unsupported";
}
export const isTextKind = (kind: PreviewKind) =>
  ["code", "markdown", "html", "table"].includes(kind);

// Read shared text with a byte limit, including chunked responses with no length header.
export async function readPreviewText(response: Response): Promise<string> {
  if (!response.ok)
    throw new Error(`Could not load preview (${response.status}).`);
  if (Number(response.headers.get("Content-Length")) > MAX_TEXT_BYTES) {
    await response.body?.cancel();
    throw new Error(
      "Text preview is limited to 10 MB. Download the file to open it.",
    );
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  const parts: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_TEXT_BYTES) {
        await reader.cancel();
        throw new Error(
          "Text preview is limited to 10 MB. Download the file to open it.",
        );
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

export function htmlPreviewDocument(source: string): string {
  // The sandbox also disables scripts, forms, same-origin access and navigation.
  const policy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${source}</body></html>`;
}

export interface DelimitedPreview {
  rows: string[][];
  truncated: boolean;
  error?: string;
}
export function parseDelimited(
  source: string,
  delimiter = ",",
  maxRows = 201,
  maxColumns = 50,
): DelimitedPreview {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    truncated = false;
  const addCell = () => {
    if (row.length < maxColumns) row.push(cell);
    else truncated = true;
    cell = "";
  };
  const addRow = () => {
    addCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) addCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      addRow();
      if (rows.length >= maxRows)
        return { rows, truncated: i < source.length - 1 || truncated };
    } else cell += char;
  }
  if (quoted)
    return {
      rows,
      truncated,
      error: "A quoted field is incomplete. Open Source to inspect the file.",
    };
  if (cell || row.length) addRow();
  return { rows, truncated };
}
