"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = React.createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;

    if (disableTransitionOnChange) {
      root.classList.add("[&_*]:!transition-none");
      window.setTimeout(() => {
        root.classList.remove("[&_*]:!transition-none");
      }, 0);
    }

    root.classList.remove("light", "dark");

    let resolvedTheme = theme;
    if (theme === "system" && enableSystem) {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    if (attribute === "class") {
      root.classList.add(resolvedTheme);
    } else {
      root.setAttribute(attribute, resolvedTheme);
    }
  }, [theme, attribute, enableSystem, disableTransitionOnChange, mounted]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    localStorage.setItem("theme", newTheme);
    setThemeState(newTheme);
  }, []);

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <ThemeProviderContext.Provider value={{ theme, setTheme }}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const theme = stored || '${defaultTheme}';
                const resolved = theme === 'system' 
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : theme;
                document.documentElement.classList.add(resolved);
              })();
            `,
          }}
        />
        {children}
      </ThemeProviderContext.Provider>
    );
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
