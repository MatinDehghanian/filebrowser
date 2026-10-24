import type {
  User,
  FileListingResponse,
  FileItem,
  Share,
  Settings,
  PublicSettings,
  LoginCredentials,
  AuthResponse,
  SearchResult,
  ResourceAction,
  ApiError,
  DeepPartial,
} from "@/types";
import { getFileExtension, getFileName, getFileType } from "@/lib/utils";
import { encodePath } from "@/lib/paths";
import { appURL } from "@/lib/runtime";

const API_BASE = appURL("/api");

export class ApiRequestError extends Error implements ApiError {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

class ApiClient {
  private token: string | null = null;

  private toAbsoluteSearchPath(scope: string, itemPath: string): string {
    if (!itemPath) {
      return scope || "/";
    }

    if (itemPath.startsWith("/")) {
      return itemPath;
    }

    const cleanScope = scope && scope !== "/" ? scope.replace(/\/+$/, "") : "";
    const combinedPath = cleanScope ? `${cleanScope}/${itemPath}` : `/${itemPath}`;
    return combinedPath.startsWith("/") ? combinedPath : `/${combinedPath}`;
  }

  private normalizeAuthResponse(response: AuthResponse | string): AuthResponse {
    if (typeof response === "string") {
      return { token: response };
    }

    if (response && typeof response.token === "string") {
      return response;
    }

    throw new Error("Invalid authentication response");
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowText = false,
  ): Promise<T> {
    const headers = new Headers(options.headers);

    if (this.token) {
      headers.set("X-Auth", this.token);
    }

    const hasContentTypeHeader = headers.has("Content-Type");

    if (options.body && typeof options.body === "string" && !hasContentTypeHeader) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      let message = body.trim() || response.statusText || "An error occurred";
      try {
        const errorData = JSON.parse(body);
        message = errorData.message || errorData.error || message;
      } catch {
        // The Go API also returns useful plain-text error messages.
      }
      if (response.status === 409) message = "An item with this name already exists. Choose another name.";
      if (response.status === 401 && !endpoint.startsWith("/public/")) {
        window.dispatchEvent(new Event("filebrowser:unauthorized"));
      }
      throw new ApiRequestError(message, response.status);
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    // Return text for non-JSON responses
    const text = await response.text();
    if (text && !allowText) {
      throw new ApiRequestError("The server returned an unexpected response. Check the server address and try again.", response.status);
    }
    return text as unknown as T;
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse | string>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }, true);

    return this.normalizeAuthResponse(response);
  }

  async signup(credentials: LoginCredentials): Promise<void> {
    return this.request("/signup", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async renewToken(): Promise<AuthResponse> {
    const response = await this.request<AuthResponse | string>("/renew", {
      method: "POST",
    }, true);

    return this.normalizeAuthResponse(response);
  }

  // Resources (Files/Folders)
  async getResource(path: string): Promise<FileListingResponse> {
    return this.request<FileListingResponse>(
      `/resources${encodePath(path)}`,
    );
  }

  async deleteResource(path: string): Promise<void> {
    return this.request(`/resources${encodePath(path)}`, {
      method: "DELETE",
    });
  }

  async createFolder(path: string): Promise<void> {
    return this.request(`/resources${encodePath(path).replace(/\/+$/, "")}/`, {
      method: "POST",
    });
  }

  async createFile(path: string, content: string = ""): Promise<void> {
    return this.request(`/resources${encodePath(path)}`, {
      method: "POST",
      body: content,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  async updateFile(path: string, content: string): Promise<void> {
    return this.request(`/resources${encodePath(path)}`, {
      method: "PUT",
      body: content,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  async resourceAction(
    path: string,
    action: ResourceAction,
    destination: string,
    overwrite = false,
    rename = false,
  ): Promise<void> {
    const params = new URLSearchParams({
      action,
      destination,
      override: String(overwrite),
      rename: String(rename),
    });
    return this.request(`/resources${encodePath(path)}?${params.toString()}`, {
      method: "PATCH",
    });
  }

  async getFileContent(path: string, signal?: AbortSignal): Promise<string> {
    const file = await this.request<FileItem>(`/resources${encodePath(path)}`, { signal });
    if (file.type !== "text" && file.type !== "textImmutable") {
      throw new ApiRequestError("This file is binary or too large for the text editor (10 MB limit).");
    }
    return file.content || "";
  }

  getDownloadUrl(path: string, inline = false): string {
    const params = new URLSearchParams();
    if (inline) params.set("inline", "true");
    return `${API_BASE}/raw${encodePath(path)}?${params.toString()}`;
  }

  getPreviewUrl(path: string, size: "thumb" | "big" = "thumb"): string {
    const params = new URLSearchParams();
    return `${API_BASE}/preview/${size}${encodePath(path)}?${params.toString()}`;
  }

  getSubtitleUrl(path: string): string {
    return `${API_BASE}/subtitle${encodePath(path)}`;
  }

  // Search
  async search(path: string, query: string): Promise<SearchResult> {
    const params = new URLSearchParams({ query });
    const headers: HeadersInit = {};

    if (this.token) {
      (headers as Record<string, string>)["X-Auth"] = this.token;
    }

    const response = await fetch(`${API_BASE}/search${encodePath(path)}?${params.toString()}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new ApiRequestError((await response.text()).trim() || "Search failed", response.status);
    }

    const text = await response.text();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const items = lines
      .map((line) => {
        try {
          return JSON.parse(line) as { path?: string; dir?: boolean; size?: number; modified?: string; mode?: number };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { path: string; dir?: boolean; size?: number; modified?: string; mode?: number } => Boolean(entry?.path))
      .map((entry) => {
        const absolutePath = this.toAbsoluteSearchPath(path, entry.path);
        const name = getFileName(absolutePath);
        const isDir = Boolean(entry.dir);

        return {
          path: absolutePath,
          name,
          size: entry.size ?? 0,
          extension: getFileExtension(name),
          modified: entry.modified || "",
          mode: entry.mode ?? 0,
          isDir,
          isSymlink: false,
          type: getFileType(name, isDir),
        };
      });

    return { items };
  }

  // Shares
  async getAllShares(): Promise<Share[]> {
    try {
      return await this.request<Share[]>("/shares/");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 404) {
        try {
          return await this.request<Share[]>("/shares");
        } catch (fallbackError) {
          const fallbackApiError = fallbackError as ApiError;
          if (fallbackApiError?.status === 404) {
            return this.request<Share[]>("/share/");
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  async getShares(path: string): Promise<Share[]> {
    return this.request<Share[]>(`/share${encodePath(path)}`);
  }

  async createShare(
    path: string,
    options: { password?: string; expires?: string; unit?: string } = {},
  ): Promise<Share> {
    return this.request<Share>(`/share${encodePath(path)}`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  async deleteShare(hash: string): Promise<void> {
    return this.request(`/share/${hash}`, {
      method: "DELETE",
    });
  }

  // Public share access
  async getPublicShare(
    hash: string,
    path = "",
    password?: string,
  ): Promise<FileItem | FileListingResponse> {
    const headers: HeadersInit = {};

    if (password) {
      (headers as Record<string, string>)["X-SHARE-PASSWORD"] =
        encodeURIComponent(password);
    }

    return this.request(`/public/share/${encodeURIComponent(hash)}${path ? encodePath(path) : ""}`, {
      headers,
    });
  }

  getPublicDownloadUrl(
    hash: string,
    path = "",
    inline = false,
    token?: string,
  ): string {
    const params = new URLSearchParams();
    if (inline) params.set("inline", "true");
    if (token) params.set("token", token);
    return `${API_BASE}/public/dl/${encodeURIComponent(hash)}${path ? encodePath(path) : ""}?${params.toString()}`;
  }

  // Users
  async getUsers(): Promise<User[]> {
    return this.request<User[]>("/users");
  }

  async getUser(id: number | string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  async createUser(
    user: Partial<User>,
    options?: { currentPassword?: string },
  ): Promise<void> {
    await this.request<void>("/users", {
      method: "POST",
      body: JSON.stringify({
        what: "user",
        current_password: options?.currentPassword,
        data: user,
      }),
    });
  }

  async updateUser(
    id: number | string,
    user: Partial<User>,
    options?: { currentPassword?: string },
  ): Promise<User> {
    const fields = Object.keys(user);

    await this.request<void>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        what: "user",
        which: fields,
        current_password: options?.currentPassword,
        data: {
          id: typeof id === "number" ? id : Number(id),
          ...user,
        },
      }),
    });

    return this.getUser(id);
  }

  async deleteUser(
    id: number,
    options?: { currentPassword?: string },
  ): Promise<void> {
    return this.request<void>(`/users/${id}`, {
      method: "DELETE",
      body: JSON.stringify({
        current_password: options?.currentPassword,
      }),
    });
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return this.request<Settings>("/settings");
  }

  async updateSettings(settings: DeepPartial<Settings>): Promise<void> {
    return this.request("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async getPublicSettings(): Promise<PublicSettings> {
    return this.request<PublicSettings>("/public/settings");
  }

  // Usage
  async getUsage(): Promise<{ used: number; total: number }> {
    return this.request("/usage/");
  }

  // Commands
  async runCommand(path: string, command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/command${encodePath(path)}`);
      const output: string[] = [];

      ws.onopen = () => {
        ws.send(command);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          output.push(event.data);
        }
      };

      ws.onerror = () => {
        reject(new Error("Command execution failed"));
      };

      ws.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          reject(new Error(event.reason || "Command execution failed"));
          return;
        }
        resolve(output.join("\n").trim());
      };
    });
  }

  // Checksums
  async getChecksums(
    path: string,
    algo = "md5",
  ): Promise<Record<string, string>> {
    const file = await this.request<FileItem>(`/resources${encodePath(path)}?checksum=${encodeURIComponent(algo)}`);
    return file.checksums || {};
  }

  getUploadUrl(path: string): string {
    return `${API_BASE}/resources${encodePath(path)}?override=false`;
  }

  async uploadFile(path: string, file: File): Promise<void> {
    return this.request(`/resources${encodePath(path)}?override=false`, { method: "POST", body: file });
  }
}

export const api = new ApiClient();
export default api;
