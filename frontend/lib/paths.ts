// Paths passed to the API are decoded filesystem paths. Encode each segment
// exactly once at the URL boundary, preserving directory separators.
export function encodePath(path: string): string {
  return (path.startsWith("/") ? path : `/${path}`)
    .split("/").map(encodeURIComponent).join("/");
}

export function decodePath(path: string): string {
  return path.split("/").map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  }).join("/");
}

export function validateName(name: string): string | null {
  if (!name.trim() || name.trim() === "." || name.trim() === "..") {
    return "Please enter a valid name";
  }
  if (/[\\/\x00-\x1f\x7f]/.test(name)) {
    return "Names cannot contain slashes or control characters";
  }
  return null;
}

export function isWithinPath(parent: string, child: string): boolean {
  const base = parent.replace(/\/+$/, "");
  return child === base || child.startsWith(`${base}/`);
}
