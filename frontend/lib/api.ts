import type {
  User,
  FileListingResponse,
  FileItem,
  Share,
  Settings,
  LoginCredentials,
  AuthResponse,
  SearchResult,
  ResourceAction,
  ApiError,
  DeepPartial,
} from "@/types";

const API_BASE = "/api";

class ApiClient {
  private token: string | null = null;

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
    return this.request<SearchResult>(`/search${path}?${params.toString()}`);
  }

  // Shares
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

  getPublicDownloadUrl(hash: string, path = "", inline = false): string {
    const params = new URLSearchParams();
    if (inline) params.set("inline", "true");
    return `${API_BASE}/public/dl/${hash}${path}?${params.toString()}`;
  }

  // Users
  async getUsers(): Promise<User[]> {
    return this.request<User[]>("/users");
  }

  async getUser(id: number | string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  async createUser(user: Partial<User>): Promise<User> {
    return this.request<User>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: number | string, user: Partial<User>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(user),
    });
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
