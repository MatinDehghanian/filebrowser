import { lazy, Suspense } from "react";
import { FileQuestion, LockKeyhole } from "lucide-react";
import { isTextKind, previewKind } from "@/lib/preview";
import type { FileItem } from "@/types";

const TextPreview = lazy(() => import("./text-preview"));
const ImagePreview = lazy(() => import("./image-preview"));
const MediaPreview = lazy(() => import("./media-preview"));
const PdfPreview = lazy(() => import("./pdf-preview"));
interface FilePreviewProps {
  item: FileItem;
  url: string;
  canDownload: boolean;
  canEdit?: boolean;
  loadText: (signal: AbortSignal) => Promise<string>;
  onSave?: (content: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  subtitleURL?: (path: string) => string;
}
export function FilePreview({
  item,
  url,
  canDownload,
  canEdit = false,
  loadText,
  onSave,
  onDirtyChange,
  onBusyChange,
  subtitleURL,
}: FilePreviewProps) {
  const kind = previewKind(item);
  if (!canDownload)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <LockKeyhole className="h-10 w-10 text-muted-foreground" />
        <p>You need download permission to preview this file.</p>
      </div>
    );
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex h-full items-center justify-center gap-3 p-8"
        >
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Preparing preview…
        </div>
      }
    >
      {isTextKind(kind) ? (
        <TextPreview
          key={item.path}
          item={item}
          kind={kind}
          loadText={loadText}
          canEdit={canEdit}
          onSave={onSave}
          onDirtyChange={onDirtyChange}
          onBusyChange={onBusyChange}
        />
      ) : kind === "image" ? (
        <ImagePreview key={url} url={url} name={item.name} />
      ) : kind === "video" || kind === "audio" ? (
        <MediaPreview
          key={url}
          item={item}
          kind={kind}
          url={url}
          subtitleURL={subtitleURL}
        />
      ) : kind === "pdf" ? (
        <PdfPreview key={url} url={url} name={item.name} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <FileQuestion className="h-14 w-14 text-muted-foreground" />
          <div>
            <p className="font-medium">
              Preview is not available for this file type.
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Use Download original to open it with a compatible application.
            </p>
          </div>
        </div>
      )}
    </Suspense>
  );
}
