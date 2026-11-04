// Gerenciador de Tema (Modo Escuro e Modo Claro)
// Persiste a preferência em localStorage e sincroniza a classe 'dark' no elemento raiz (<html>).

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "desafios-theme-v1";
export type ThemeMode = "light" | "dark";

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    // Caso não tenha preferência salva, verifica a do sistema ou padrão 'dark'
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    /* ignore */
  }
  return "dark";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("desafios:theme-changed", { detail: theme }));
  } catch {
    /* ignore */
  }
}

export function useTheme(): {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
} {
  const [theme, setLocalTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ThemeMode>;
      if (custom.detail && (custom.detail === "light" || custom.detail === "dark")) {
        setLocalTheme(custom.detail);
      }
    };
    window.addEventListener("desafios:theme-changed", handler);
    return () => window.removeEventListener("desafios:theme-changed", handler);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setLocalTheme(next);
    applyTheme(next);
  };

  const setTheme = (mode: ThemeMode) => {
    setLocalTheme(mode);
    applyTheme(mode);
  };

  return { theme, toggleTheme, setTheme };
}
