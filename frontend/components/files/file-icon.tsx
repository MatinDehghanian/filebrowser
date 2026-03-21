"use client";

import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  FileSpreadsheet,
  FileType,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileType } from "@/lib/utils";

interface FileIconProps {
  name: string;
  isDir: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-12 w-12",
};

export function FileIcon({ name, isDir, className, size = "md" }: FileIconProps) {
  const type = getFileType(name, isDir);
  const sizeClass = sizeClasses[size];

  const iconProps = {
    className: cn(sizeClass, className),
  };

  switch (type) {
    case "folder":
      return <Folder {...iconProps} className={cn(iconProps.className, "text-primary")} />;
    case "image":
      return <FileImage {...iconProps} className={cn(iconProps.className, "text-emerald-500")} />;
    case "video":
      return <FileVideo {...iconProps} className={cn(iconProps.className, "text-rose-500")} />;
    case "audio":
      return <FileAudio {...iconProps} className={cn(iconProps.className, "text-amber-500")} />;
    case "code":
      return <FileCode {...iconProps} className={cn(iconProps.className, "text-cyan-500")} />;
    case "archive":
      return <FileArchive {...iconProps} className={cn(iconProps.className, "text-orange-500")} />;
    case "document":
      const ext = name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") {
        return <FileText {...iconProps} className={cn(iconProps.className, "text-red-500")} />;
      }
      if (["xls", "xlsx", "csv"].includes(ext || "")) {
        return <FileSpreadsheet {...iconProps} className={cn(iconProps.className, "text-green-600")} />;
      }
      if (["ppt", "pptx"].includes(ext || "")) {
        return <Presentation {...iconProps} className={cn(iconProps.className, "text-orange-600")} />;
      }
      if (["doc", "docx", "rtf", "txt"].includes(ext || "")) {
        return <FileType {...iconProps} className={cn(iconProps.className, "text-blue-600")} />;
      }
      return <FileText {...iconProps} className={cn(iconProps.className, "text-muted-foreground")} />;
    default:
      return <File {...iconProps} className={cn(iconProps.className, "text-muted-foreground")} />;
  }
}
