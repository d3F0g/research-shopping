import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";
const storageKey = "fieldnote-theme";
const ThemeContext = createContext<
  { theme: Theme; setTheme: (theme: Theme) => void } | undefined
>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#181818" : "#fafafa");
  }, [theme]);
  function setTheme(next: Theme) {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Storage may be unavailable in private browser contexts. */
    }
    updateTheme(next);
  }
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
