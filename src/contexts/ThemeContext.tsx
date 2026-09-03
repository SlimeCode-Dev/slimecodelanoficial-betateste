import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AppTheme = 'cyber' | 'classic';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'codeschool_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'cyber';
    return (localStorage.getItem(STORAGE_KEY) as AppTheme) || 'cyber';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'cyber') {
      root.classList.add('theme-cyber');
    } else {
      root.classList.remove('theme-cyber');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: AppTheme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'cyber' ? 'classic' : 'cyber'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
