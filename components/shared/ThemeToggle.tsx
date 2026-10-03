"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`app-icon-button relative border border-[var(--shell-border)] hover:text-[var(--shell-text)] ${className}`}
    >
      <Sun
        className={`h-4 w-4 transition-all ${isDark ? "absolute scale-0 opacity-0" : "scale-100 opacity-100"}`}
      />
      <Moon
        className={`h-4 w-4 transition-all ${isDark ? "scale-100 opacity-100" : "absolute scale-0 opacity-0"}`}
      />
    </button>
  );
}
