import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { appURL } from "@/lib/runtime";
import { Button } from "@/components/ui/button";
GlobalWorkerOptions.workerSrc = workerURL;
const assets = import.meta.env.PROD ? appURL("/static/pdfjs/") : "/pdfjs/";

export default function PdfPreview({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState(800);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    submit: (password: string) => void;
    incorrect: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const previousRender = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setPdf(null);
    setPage(1);
    setError("");
    setLoading(true);
    setPasswordPrompt(null);
    const task = getDocument({
      url,
      cMapUrl: `${assets}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`,
      wasmUrl: `${assets}wasm/`,
      enableXfa: false,
    });
    task.onPassword = (submit: (password: string) => void, reason: number) => {
      if (active) setPasswordPrompt({ submit, incorrect: reason === 2 });
    };
    task.promise
      .then((document) => {
        if (active) {
          setPdf(document);
          setPasswordPrompt(null);
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not open this PDF.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      void task.destroy().catch(() => {});
    };
  }, [url, revision]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let task: RenderTask | undefined;
    setRendering(true);
    setError("");
    pdf
      .getPage(page)
      .then(async (documentPage) => {
        await previousRender.current.catch(() => {});
        if (!active || !canvas.current) return;
        const viewport = documentPage.getViewport({
          scale: 1,
          rotation: (documentPage.rotate + rotation) % 360,
        });
        const scale =
          Math.min(2, Math.max(0.1, (width - 40) / viewport.width)) * zoom;
        const sized = documentPage.getViewport({
          scale,
          rotation: (documentPage.rotate + rotation) % 360,
        });
        const outputScale = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(12_000_000 / (sized.width * sized.height)),
        );
        const element = canvas.current;
        element.width = Math.max(1, Math.floor(sized.width * outputScale));
        element.height = Math.max(1, Math.floor(sized.height * outputScale));
        element.style.width = `${sized.width}px`;
        element.style.height = `${sized.height}px`;
        task = documentPage.render({
          canvas: element,
          viewport: sized,
          transform:
            outputScale === 1
              ? undefined
              : [outputScale, 0, 0, outputScale, 0, 0],
        });
        previousRender.current = task.promise;
        await task.promise;
      })
      .catch((reason) => {
        if (active && reason?.name !== "RenderingCancelledException")
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not render this page.",
          );
      })
      .finally(() => {
        if (active) setRendering(false);
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [pdf, page, zoom, rotation, width]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous PDF page"
            disabled={!pdf || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <label className="flex items-center gap-2 text-xs">
            Page
            <input
              aria-label="PDF page number"
              type="number"
              min={1}
              max={pdf?.numPages || 1}
              value={page}
              className="h-8 w-16 rounded border bg-background px-2"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (
                  pdf &&
                  Number.isInteger(value) &&
                  value >= 1 &&
                  value <= pdf.numPages
                )
                  setPage(value);
              }}
            />
            of {pdf?.numPages || "…"}
          </label>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next PDF page"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out PDF"
            onClick={() => setZoom((value) => Math.max(0.25, value / 1.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
            {zoom === 1 ? "Fit width" : `${Math.round(zoom * 100)}%`}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in PDF"
            onClick={() => setZoom((value) => Math.min(4, value * 1.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rotate PDF page"
            onClick={() => setRotation((value) => (value + 90) % 360)}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={host}
        className="relative min-h-0 flex-1 overflow-auto bg-neutral-200 p-5 dark:bg-neutral-900"
      >
        {passwordPrompt ? (
          <form
            className="mx-auto flex max-w-sm flex-col gap-3 rounded-lg border bg-background p-6"
            onSubmit={(event) => {
              event.preventDefault();
              passwordPrompt.submit(password);
              setPassword("");
            }}
          >
            <p>This PDF is password protected.</p>
            {passwordPrompt.incorrect && (
              <p role="alert" className="text-sm text-destructive">
                Incorrect PDF password. Try again.
              </p>
            )}
            <input
              aria-label="PDF password"
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9 rounded border bg-background px-3"
            />
            <Button type="submit" disabled={!password}>
              Open PDF
            </Button>
          </form>
        ) : error ? (
          <div
            role="alert"
            className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border bg-background p-6 text-center"
          >
            <p className="break-words text-sm">{error}</p>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry PDF
            </Button>
          </div>
        ) : (
          <>
            <canvas
              ref={canvas}
              role="img"
              aria-label={`${name}, page ${page}`}
              className="mx-auto max-w-none bg-white shadow-lg"
              style={{ opacity: loading || rendering ? 0.35 : 1 }}
            />
            {(loading || rendering) && (
              <div
                role="status"
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="rounded-lg border bg-background px-4 py-3 text-sm">
                  {loading ? "Opening PDF…" : "Rendering page…"}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
