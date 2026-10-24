declare global {
  interface Window {
    __FILEBROWSER_CONFIG__?: { BaseURL?: string };
  }
}

export const baseURL = typeof window === "undefined" ? "" :
  (window.__FILEBROWSER_CONFIG__?.BaseURL || "").replace(/\/+$/, "");

export const appURL = (path: string) => `${baseURL}${path}`;
