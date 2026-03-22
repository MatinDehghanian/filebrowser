import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

export function getFileType(filename: string, isDir: boolean): string {
  if (isDir) return "folder";
  
  const ext = getFileExtension(filename);
  
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"];
  const videoExts = ["mp4", "webm", "mkv", "avi", "mov", "wmv", "flv"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
  const codeExts = ["js", "ts", "jsx", "tsx", "py", "go", "rs", "java", "cpp", "c", "h", "css", "scss", "html", "json", "xml", "yaml", "yml", "md", "sql"];
  const archiveExts = ["zip", "tar", "gz", "rar", "7z", "bz2"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf"];
  
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (codeExts.includes(ext)) return "code";
  if (archiveExts.includes(ext)) return "archive";
  if (docExts.includes(ext)) return "document";
  
  return "file";
}

export function joinPaths(...paths: string[]): string {
  return paths
    .map((p, i) => {
      if (i === 0) return p.replace(/\/+$/, "");
      return p.replace(/^\/+|\/+$/g, "");
    })
    .filter(Boolean)
    .join("/");
}

export function getParentPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

export function getFileName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}
