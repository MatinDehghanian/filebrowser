import { useRef, useState, type SyntheticEvent } from "react";
import { AlertCircle, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileItem } from "@/types";

export default function MediaPreview({
  item,
  url,
  kind,
  subtitleURL,
}: {
  item: FileItem;
  url: string;
  kind: "audio" | "video";
  subtitleURL?: (path: string) => string;
}) {
  const media = useRef<HTMLMediaElement | null>(null);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [duration, setDuration] = useState(0);
  const [revision, setRevision] = useState(0);
  const metadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    element.playbackRate = Number(speed);
    if (Number.isFinite(element.duration)) setDuration(element.duration);
  };
  const tracks =
    subtitleURL &&
    item.subtitles?.map((path, index) => (
      <track
        key={path}
        kind="subtitles"
        label={path.split("/").pop()}
        src={subtitleURL(path)}
        default={index === 0}
      />
    ));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-2 text-xs text-muted-foreground">
        <span>
          {duration
            ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")} duration`
            : "Media preview"}
        </span>
        <label className="flex items-center gap-2">
          Playback speed
          <select
            aria-label="Playback speed"
            className="h-8 rounded border bg-background px-2 text-foreground"
            value={speed}
            onChange={(event) => {
              setSpeed(event.target.value);
              if (media.current)
                media.current.playbackRate = Number(event.target.value);
            }}
          >
            {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
        >
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="max-w-md">
            This browser cannot play the file, or the media could not be loaded.
            Download the original to open it in a media player.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setError(false);
              setRevision((value) => value + 1);
            }}
          >
            Retry playback
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-auto bg-black/90 p-4">
          {kind === "audio" ? (
            <>
              <div className="flex h-32 w-32 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/30 to-violet-600/30">
                <Music2 className="h-16 w-16 text-blue-300" />
              </div>
              <p className="max-w-full truncate text-sm text-white">
                {item.name}
              </p>
              <audio
                key={revision}
                ref={(element) => {
                  media.current = element;
                }}
                src={url}
                controls
                preload="metadata"
                onLoadedMetadata={metadata}
                onDurationChange={metadata}
                onPlay={metadata}
                onError={() => setError(true)}
                className="w-full max-w-xl"
              />
            </>
          ) : (
            <video
              key={revision}
              ref={(element) => {
                media.current = element;
              }}
              src={url}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={metadata}
              onDurationChange={metadata}
              onPlay={metadata}
              onError={() => setError(true)}
              className="max-h-full w-full object-contain"
            >
              {tracks}
            </video>
          )}
        </div>
      )}
    </div>
  );
}
