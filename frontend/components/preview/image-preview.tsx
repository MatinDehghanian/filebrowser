import { useEffect, useRef, useState } from "react";
import { AlertCircle, Maximize, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImagePreview({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const sideways = rotation % 180 !== 0;
  const fit = dimensions.width
    ? Math.min(
        1,
        Math.max(1, viewport.width - 48) /
          (sideways ? dimensions.height : dimensions.width),
        Math.max(1, viewport.height - 48) /
          (sideways ? dimensions.width : dimensions.height),
      )
    : 1;
  const changeZoom = (next: number) =>
    setZoom(Math.max(0.1, Math.min(Math.max(20, 8 / fit), next)));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out image"
            onClick={() => changeZoom(zoom / 1.25)}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center font-mono text-xs">
            {Math.round(fit * zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in image"
            onClick={() => changeZoom(zoom * 1.25)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <Maximize className="mr-1 h-3.5 w-3.5" />
            Fit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setZoom(1 / fit);
              setPan({ x: 0, y: 0 });
            }}
          >
            100%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rotate image"
            onClick={() => {
              setRotation((value) => (value + 90) % 360);
              reset();
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {dimensions.width
            ? `${dimensions.width} × ${dimensions.height} px · Drag to pan`
            : "Loading image…"}
        </span>
      </div>
      <div
        ref={host}
        className="image-preview-canvas relative min-h-0 flex-1 overflow-hidden"
        style={{
          touchAction: "none",
          cursor: drag.current ? "grabbing" : "grab",
        }}
        onDoubleClick={reset}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setPan({
              x: drag.current.panX + event.clientX - drag.current.x,
              y: drag.current.panY + event.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {error ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p>
              The image could not be displayed. It may be damaged or use an
              unsupported format.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError(false);
                setRevision((value) => value + 1);
              }}
            >
              Retry image
            </Button>
          </div>
        ) : (
          <img
            key={revision}
            src={url}
            alt={name}
            draggable={false}
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            onError={() => setError(true)}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: dimensions.width || undefined,
              height: dimensions.height || undefined,
              opacity: dimensions.width ? 1 : 0,
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${fit * zoom})`,
              transformOrigin: "center",
            }}
          />
        )}
      </div>
    </div>
  );
}
