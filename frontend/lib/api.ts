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

const API_BASE = "/api";

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
  ): Promise<T> {
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)["X-Auth"] = this.token;
    }

    if (options.body && typeof options.body === "string") {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = "An error occurred";
      try {
        const errorData = await response.json();
        message = errorData.message || errorData.error || message;
      } catch {
        message = response.statusText || message;
      }
      const error: ApiError = { message, status: response.status };
      throw error;
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    // Return text for non-JSON responses
    const text = await response.text();
    return text as unknown as T;
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse | string>("/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

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
    });

    return this.normalizeAuthResponse(response);
  }

  // Resources (Files/Folders)
  async getResource(path: string): Promise<FileListingResponse> {
    const encodedPath = encodeURIComponent(path);
    return this.request<FileListingResponse>(
      `/resources${path}?path=${encodedPath}`,
    );
  }

  async deleteResource(path: string): Promise<void> {
    return this.request(`/resources${path}`, {
      method: "DELETE",
    });
  }

  async createFolder(path: string): Promise<void> {
    return this.request(`/resources${path}/`, {
      method: "POST",
    });
  }

  async createFile(path: string, content: string = ""): Promise<void> {
    return this.request(`/resources${path}`, {
      method: "POST",
      body: content,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  async updateFile(path: string, content: string): Promise<void> {
    return this.request(`/resources${path}`, {
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
      overwrite: String(overwrite),
      rename: String(rename),
    });
    return this.request(`/resources${path}?${params.toString()}`, {
      method: "PATCH",
    });
  }

  async getFileContent(path: string): Promise<string> {
    return this.request<string>(`/raw${path}`);
  }

  getDownloadUrl(path: string, inline = false): string {
    const params = new URLSearchParams();
    if (this.token) params.set("auth", this.token);
    if (inline) params.set("inline", "true");
    return `${API_BASE}/raw${path}?${params.toString()}`;
  }

  getPreviewUrl(path: string, size: "thumb" | "big" = "thumb"): string {
    const params = new URLSearchParams();
    if (this.token) params.set("auth", this.token);
    params.set("size", size);
    return `${API_BASE}/preview${path}?${params.toString()}`;
  }

  // Search
  async search(path: string, query: string): Promise<SearchResult> {
    const params = new URLSearchParams({ query });
    const headers: HeadersInit = {};

    if (this.token) {
      (headers as Record<string, string>)["X-Auth"] = this.token;
    }

    const response = await fetch(`${API_BASE}/search${path}?${params.toString()}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw {
        message: response.statusText || "Search failed",
        status: response.status,
      } as ApiError;
    }

    const text = await response.text();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const items = lines
      .map((line) => {
        try {
          return JSON.parse(line) as { path?: string; dir?: boolean };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { path: string; dir?: boolean } => Boolean(entry?.path))
      .map((entry) => {
        const absolutePath = this.toAbsoluteSearchPath(path, entry.path);
        const name = getFileName(absolutePath);
        const isDir = Boolean(entry.dir);

        return {
          path: absolutePath,
          name,
          size: 0,
          extension: getFileExtension(name),
          modified: new Date(0).toISOString(),
          mode: 0,
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
    return this.request<Share[]>(`/share${path}`);
  }

  async createShare(
    path: string,
    options: { password?: string; expires?: string; unit?: string } = {},
  ): Promise<Share> {
    return this.request<Share>(`/share${path}`, {
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

    return this.request(`/public/share/${hash}${path}`, {
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
    return `${API_BASE}/public/dl/${hash}${path}?${params.toString()}`;
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

  async deleteUser(id: number): Promise<void> {
    return this.request(`/users/${id}`, {
      method: "DELETE",
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
    return this.request("/usage");
  }

  // Commands
  async runCommand(path: string, command: string): Promise<string> {
    return this.request(`/command${path}`, {
      method: "POST",
      body: command,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  // Checksums
  async getChecksums(
    path: string,
    algo = "md5",
  ): Promise<Record<string, string>> {
    return this.request(`/checksum${path}?algo=${algo}`);
  }
}

export const api = new ApiClient();
export default api;
