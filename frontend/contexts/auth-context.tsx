"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import type { User, LoginCredentials } from "@/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  signup: (credentials: LoginCredentials) => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "filebrowser_token";
const USER_KEY = "filebrowser_user";

// Token renewal interval (14 minutes, assuming 15 min token expiry)
const TOKEN_RENEWAL_INTERVAL = 14 * 60 * 1000;

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/share"];

function parseJWT(token: string): { exp?: number; user?: User } | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload?.exp) return true;
  // Add 30 second buffer
  return Date.now() >= payload.exp * 1000 - 30000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const saveAuth = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    api.setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const renewToken = useCallback(async () => {
    if (!token) return;

    try {
      const response = await api.renewToken();
      const payload = parseJWT(response.token);
      if (payload?.user) {
        saveAuth(response.token, payload.user);
      }
    } catch (error) {
      console.error("Token renewal failed:", error);
      clearAuth();
      router.push("/login");
    }
  }, [token, saveAuth, clearAuth, router]);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        if (isTokenExpired(storedToken)) {
          // Try to renew
          api.setToken(storedToken);
          try {
            const response = await api.renewToken();
            const payload = parseJWT(response.token);
            if (payload?.user) {
              saveAuth(response.token, payload.user);
            }
          } catch {
            clearAuth();
          }
        } else {
          const parsedUser = JSON.parse(storedUser) as User;
          setToken(storedToken);
          setUser(parsedUser);
          api.setToken(storedToken);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [clearAuth, saveAuth]);

  // Set up token renewal interval
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(renewToken, TOKEN_RENEWAL_INTERVAL);
    return () => clearInterval(interval);
  }, [token, renewToken]);

  // Redirect to login if not authenticated and not on public route
  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (!token && !isPublicRoute) {
      router.push("/login");
    }
  }, [token, isLoading, pathname, router]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await api.login(credentials);
      const payload = parseJWT(response.token);

      if (!payload?.user) {
        throw new Error("Invalid token received");
      }

      saveAuth(response.token, payload.user);
      router.push("/files/");
    },
    [saveAuth, router]
  );

  const logout = useCallback(() => {
    clearAuth();
    router.push("/login");
  }, [clearAuth, router]);

  const signup = useCallback(
    async (credentials: LoginCredentials) => {
      await api.signup(credentials);
      // After signup, log in automatically
      await login(credentials);
    },
    [login]
  );

  const updateUser = useCallback(
    (updatedUser: User) => {
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        signup,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useUser() {
  const { user } = useAuth();
  if (!user) {
    throw new Error("useUser must be used when user is authenticated");
  }
  return user;
}

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.perm?.admin ?? false;
}
