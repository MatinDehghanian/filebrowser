import api, { ApiRequestError } from "@/lib/api";
import { encodePath, isWithinPath } from "@/lib/paths";
import { appURL } from "@/lib/runtime";
import type { FileItem } from "../types";

export type ConflictChoice = "replace" | "keep" | "skip" | "resume" | "cancel";
export type Conflict = {
  name: string;
  canResume?: boolean;
  canReplace?: boolean;
};
export type ConflictResolver = (conflict: Conflict) => Promise<ConflictChoice>;
export const INTERNAL_DRAG_TYPE = "application/x-filebrowser-items";

export function transferRoots(items: FileItem[]) {
  const unique = Array.from(
    new Map(items.map((item) => [item.path, item])).values(),
  );
  return unique.filter(
    (item) =>
      !unique.some(
        (parent) =>
          parent !== item &&
          parent.isDir &&
          isWithinPath(parent.path, item.path),
      ),
  );
}
export async function transferItems(
  items: FileItem[],
  destination: string,
  action: "move" | "copy",
  resolve: ConflictResolver,
  canReplace = true,
) {
  let completed = 0,
    skipped = 0;
  const errors: string[] = [];
  for (const item of transferRoots(items)) {
    const target = `${destination.replace(/\/+$/, "")}/${item.name}`;
    if (item.isDir && isWithinPath(item.path, destination)) {
      errors.push(`${item.name}: a folder cannot contain itself`);
      continue;
    }
    if (action === "move" && target === item.path) {
      skipped++;
      continue;
    }
    try {
      try {
        await api.resourceAction(
          item.path,
          action,
          target,
          false,
          action === "copy" && target === item.path,
        );
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 409)
          throw error;
        const choice = await resolve({ name: item.name, canReplace });
        if (choice === "cancel") break;
        if (choice === "skip") {
          skipped++;
          continue;
        }
        await api.resourceAction(
          item.path,
          action,
          target,
          choice === "replace",
          choice === "keep",
        );
      }
      completed++;
    } catch (error) {
      errors.push(
        `${item.name}: ${error instanceof Error ? error.message : "Transfer failed"}`,
      );
    }
  }
  return { completed, skipped, errors };
}

function nextName(path: string, index: number) {
  const slash = path.lastIndexOf("/"),
    dot = path.lastIndexOf(".");
  const split = dot > slash + 1 ? dot : path.length;
  return `${path.slice(0, split)} (${index})${path.slice(split)}`;
}
export async function availableUploadPath(
  path: string,
  signal?: AbortSignal,
  unavailable: Set<string> = new Set(),
) {
  for (let i = 1; i <= 10000; i++) {
    const candidate = nextName(path, i);
    if (unavailable.has(candidate)) continue;
    const response = await fetch(
      appURL(`/api/resources${encodePath(candidate)}?metadata=true`),
      { headers: authHeaders(), signal },
    );
    if (response.status === 404) return candidate;
    if (!response.ok)
      throw new Error(`Could not check destination (${response.status})`);
  }
  throw new Error("No available filename found");
}
function authHeaders(extra: Record<string, string> = {}) {
  const token = api.getToken();
  return { ...(token ? { "X-Auth": token } : {}), ...extra };
}
type UploadRecord = {
  fingerprint: string;
  destination: string;
  overwrite: boolean;
};
const memoryRecords = new Map<string, UploadRecord>();
function record(key: string, value?: UploadRecord | null): UploadRecord | null {
  try {
    if (value === null) {
      memoryRecords.delete(key);
      localStorage.removeItem(key);
      return null;
    }
    if (value) {
      memoryRecords.set(key, value);
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    }
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (
      parsed &&
      typeof parsed.destination === "string" &&
      typeof parsed.fingerprint === "string"
    )
      return parsed;
  } catch {
    /* Private browsing can disable storage; resume still works in this page. */
  }
  return memoryRecords.get(key) || null;
}
export async function uploadFingerprint(file: File) {
  const metadata = new TextEncoder().encode(
    `${file.name}\0${file.size}\0${file.lastModified}\0`,
  );
  const first = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const last = new Uint8Array(
    await file.slice(Math.max(65536, file.size - 65536)).arrayBuffer(),
  );
  const data = new Uint8Array(metadata.length + first.length + last.length);
  data.set(metadata);
  data.set(first, metadata.length);
  data.set(last, metadata.length + first.length);
  if (globalThis.crypto?.subtle)
    return Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
  // File identity, not authentication: support LAN installs served over plain HTTP.
  const hashes = [2166136261, 3339675911, 2286329941, 3266489917];
  for (const byte of data)
    for (let i = 0; i < hashes.length; i++)
      hashes[i] = Math.imul(hashes[i] ^ byte, 16777619 + i * 2) >>> 0;
  return (
    "sample-" +
    hashes.map((value) => value.toString(16).padStart(8, "0")).join("")
  );
}
export type UploadOptions = {
  ownerId: number;
  signal: AbortSignal;
  resolve: ConflictResolver;
  onProgress: (progress: number) => void;
  chunkSize?: number;
  retries?: number;
  canReplace?: boolean;
};
export async function uploadResumable(
  file: File,
  path: string,
  options: UploadOptions,
): Promise<"completed" | "skipped"> {
  const fingerprint = await uploadFingerprint(file);
  const key = `fb-upload:${options.ownerId}:${appURL(path)}`;
  let saved = record(key);
  const url = (destination: string) =>
    appURL(`/api/tus${encodePath(destination)}`);
  const send = (
    destination: string,
    method: string,
    headers: Record<string, string> = {},
    body?: Blob,
  ) =>
    fetch(url(destination), {
      method,
      headers: authHeaders(headers),
      body,
      signal: options.signal,
    });
  let destination =
    saved?.fingerprint === fingerprint ? saved.destination : path;
  let overwrite = saved?.fingerprint === fingerprint ? saved.overwrite : false;
  let offset = 0;
  const unavailable = new Set<string>();
  const head = async () => {
    const response = await send(destination, "HEAD");
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Cannot resume upload (${response.status})`);
    const position = Number(response.headers.get("Upload-Offset"));
    if (
      response.headers.get("Upload-Fingerprint") !== fingerprint ||
      Number(response.headers.get("Upload-Length")) !== file.size
    )
      throw new ApiRequestError(
        "A different upload is already in progress at this destination. Keep both to use another name.",
        409,
      );
    if (!Number.isSafeInteger(position) || position < 0 || position > file.size)
      throw new Error("Server returned an invalid upload position");
    return position;
  };
  const active = await head().catch((error) => {
    if (
      options.signal.aborted ||
      !(error instanceof ApiRequestError) ||
      error.status !== 409
    )
      throw error;
    return -1;
  });
  if (active !== null) {
    const choice = await options.resolve({
      name: file.name,
      canResume: active >= 0,
      canReplace: false,
    });
    if (choice === "cancel")
      throw new DOMException("Upload paused", "AbortError");
    if (choice === "skip") return "skipped";
    if (choice === "keep") {
      unavailable.add(destination);
      destination = await availableUploadPath(
        path,
        options.signal,
        unavailable,
      );
      saved = null;
    } else if (choice === "resume" && active >= 0) offset = active;
    else
      throw new Error("Choose Resume, Keep both or Skip for an active upload");
  } else {
    saved = null;
    overwrite = false;
  }
  if (active === null || destination !== (saved?.destination || path)) {
    for (;;) {
      const response = await fetch(
        `${url(destination)}?override=${overwrite}`,
        {
          method: "POST",
          headers: authHeaders({
            "Upload-Length": String(file.size),
            "Upload-Fingerprint": fingerprint,
          }),
          signal: options.signal,
        },
      );
      if (response.status === 409) {
        const choice = await options.resolve({
          name: file.name,
          canReplace:
            options.canReplace !== false &&
            !["directory", "upload"].includes(
              response.headers.get("X-Conflict-Type") || "",
            ),
        });
        if (choice === "cancel")
          throw new DOMException("Upload paused", "AbortError");
        if (choice === "skip") return "skipped";
        if (choice === "keep") {
          unavailable.add(destination);
          destination = await availableUploadPath(
            path,
            options.signal,
            unavailable,
          );
          overwrite = false;
        } else if (choice === "replace" && options.canReplace !== false)
          overwrite = true;
        else continue;
        continue;
      }
      if (!response.ok)
        throw new Error(
          (await response.text()).trim() ||
            `Upload failed (${response.status})`,
        );
      break;
    }
  }
  record(key, { fingerprint, destination, overwrite });
  const chunkSize = Math.max(
    256 * 1024,
    Math.min(options.chunkSize || 10 * 1024 * 1024, 32 * 1024 * 1024),
  );
  let failures = 0;
  let needsCommit = active !== null && file.size > 0;
  while (offset < file.size || needsCommit) {
    options.signal.throwIfAborted();
    try {
      const chunk = file.slice(offset, offset + chunkSize);
      const response = await send(
        destination,
        "PATCH",
        {
          "Content-Type": "application/offset+octet-stream",
          "Upload-Offset": String(offset),
        },
        chunk,
      );
      if (!response.ok)
        throw new ApiRequestError(
          (await response.text()).trim() || "Upload failed",
          response.status,
        );
      const acknowledged = Number(response.headers.get("Upload-Offset"));
      if (acknowledged !== offset + chunk.size)
        throw new Error("Server returned an unexpected upload position");
      offset = acknowledged;
      failures = 0;
      needsCommit = false;
      options.onProgress(Math.round((offset / file.size) * 100));
    } catch (error) {
      if (options.signal.aborted) throw error;
      if (
        error instanceof ApiRequestError &&
        error.status &&
        ![409, 500, 502, 503, 504].includes(error.status)
      )
        throw error;
      if (++failures > (options.retries ?? 3)) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Upload paused", "AbortError"));
        };
        const timer = setTimeout(
          () => {
            options.signal.removeEventListener("abort", abort);
            resolve();
          },
          Math.min(1000 * failures, 5000),
        );
        options.signal.addEventListener("abort", abort, { once: true });
      });
      const position = await head();
      if (position === null)
        throw new Error(
          "The upload expired or finished while the connection was lost. Refresh the folder to check the file.",
        );
      offset = position;
      needsCommit = position === file.size;
    }
  }
  record(key, null);
  options.onProgress(100);
  return "completed";
}
