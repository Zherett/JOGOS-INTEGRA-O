import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";

export interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  size = "md",
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const btnSizes = {
    sm: "h-9 w-9",
    md: "h-11 w-11",
  }[size];

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
  }[size];

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      aria-label={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      className={`grid ${btnSizes} place-items-center rounded-2xl border bg-card text-foreground shadow-sm transition-all hover:bg-secondary active:scale-95 ${className}`}
    >
      {isDark ? (
        <Sun className={`${iconSizes} text-amber-400 fill-amber-400/20 transition-transform duration-300 hover:rotate-45`} />
      ) : (
        <Moon className={`${iconSizes} text-indigo-500 fill-indigo-500/20 transition-transform duration-300 hover:-rotate-12`} />
      )}
    </button>
  );
};
