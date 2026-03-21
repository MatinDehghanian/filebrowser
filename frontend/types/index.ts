// User types
export interface User {
  id: number;
  username: string;
  password?: string;
  scope: string;
  locale: string;
  lockPassword: boolean;
  viewMode: ViewMode;
  singleClick: boolean;
  perm: Permissions;
  commands: string[];
  sorting: Sorting;
  rules: Rule[];
  hideDotfiles: boolean;
  dateFormat: boolean;
}

export interface Permissions {
  admin: boolean;
  execute: boolean;
  create: boolean;
  rename: boolean;
  modify: boolean;
  delete: boolean;
  share: boolean;
  download: boolean;
}

export interface Sorting {
  by: string;
  asc: boolean;
}

export interface Rule {
  allow: boolean;
  regex: boolean;
  regexp?: {
    raw: string;
  };
  path?: string;
}

export type ViewMode = "list" | "mosaic" | "mosaic gallery";

// File types
export interface FileItem {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
  mode: number;
  isDir: boolean;
  isSymlink: boolean;
  type: string;
  subtitles?: string[];
  content?: string;
  checksums?: Record<string, string>;
  token?: string;
}

export interface FileListingResponse {
  items: FileItem[];
  numDirs: number;
  numFiles: number;
  sorting: Sorting;
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
  mode: number;
  isDir: boolean;
  isSymlink: boolean;
  type: string;
}

// Share types
export interface Share {
  hash: string;
  path: string;
  userID: number;
  expire: number;
  unit: "hours" | "days" | "seconds";
  token?: string;
  password?: string;
}

export interface ShareDeleteResponse {
  hash: string;
}

// Auth types
export interface AuthResponse {
  token: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  recaptcha?: string;
}

export type DeepPartial<T> = T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// Settings types
export interface Settings {
  signup: boolean;
  createUserDir: boolean;
  userHomeBasePath: string;
  defaults: UserDefaults;
  rules: Rule[];
  branding: Branding;
  tus: TusSettings;
  commands: Record<string, string[]>;
  shell: string[];
  authMethod: string;
}

export interface PublicSettings {
  signup: boolean;
  hideLoginButton: boolean;
  minimumPasswordLength: number;
  authMethod: string;
  branding: Branding;
}

export interface UserDefaults {
  scope: string;
  locale: string;
  viewMode: ViewMode;
  singleClick: boolean;
  sorting: Sorting;
  perm: Permissions;
  commands: string[];
  hideDotfiles: boolean;
  dateFormat: boolean;
}

export interface Branding {
  name: string;
  disableExternal: boolean;
  disableUsedPercentage: boolean;
  files: string;
  theme: string;
  color: string;
}

export interface TusSettings {
  chunkSize: number;
  retryCount: number;
}

// Search types
export interface SearchResult {
  items: FileItem[];
}

// Upload types
export interface UploadProgress {
  file: File;
  path: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

// Resource action types
export type ResourceAction = "copy" | "rename" | "move";

export interface ResourceActionRequest {
  action: ResourceAction;
  destination: string;
  overwrite?: boolean;
  rename?: boolean;
}

// API Error type
export interface ApiError {
  message: string;
  status?: number;
}

// Public share page types
export interface PublicShareData {
  hash: string;
  items: FileItem[];
  isDir: boolean;
  path: string;
}
