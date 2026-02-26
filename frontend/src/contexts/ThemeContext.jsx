import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEMES = [
  {
    id: 'original',
    label: 'Original',
    description: 'Classic red theme',
    colors: { primary: '#dc2626', bg: '#ffffff', accent: '#fef2f2' },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Easy on the eyes',
    colors: { primary: '#818cf8', bg: '#0f0f1a', accent: '#1e1e2e' },
  },
  {
    id: 'ocean',
    label: 'Ocean Breeze',
    description: 'Cool teal tones',
    colors: { primary: '#0891b2', bg: '#f0f9ff', accent: '#ecfeff' },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Natural green earth',
    colors: { primary: '#059669', bg: '#faf5f0', accent: '#ecfdf5' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm orange glow',
    colors: { primary: '#ea580c', bg: '#fef3e2', accent: '#fff7ed' },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Soft purple elegance',
    colors: { primary: '#7c3aed', bg: '#faf5ff', accent: '#f5f3ff' },
  },
];

const STORAGE_KEY = 'easylife-theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some((t) => t.id === stored)) {
        return stored;
      }
    } catch (e) {
      // localStorage not available
    }
    return 'original';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // localStorage not available
    }
  }, [theme]);

  const setTheme = useCallback((themeId) => {
    if (THEMES.some((t) => t.id === themeId)) {
      setThemeState(themeId);
    }
  }, []);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
