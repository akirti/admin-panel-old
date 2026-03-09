import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme, THEMES } from './ThemeContext';

// Helper wrapper
function wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
    // Reset data-theme attribute
    document.documentElement.removeAttribute('data-theme');
  });

  // -------------------------------------------------------------------
  // 1. THEMES export structure
  // -------------------------------------------------------------------
  describe('THEMES export', () => {
    it('exports an array of theme objects with correct structure', () => {
      expect(Array.isArray(THEMES)).toBe(true);
      expect(THEMES.length).toBeGreaterThanOrEqual(2);

      for (const theme of THEMES) {
        expect(theme).toHaveProperty('id');
        expect(theme).toHaveProperty('label');
        expect(theme).toHaveProperty('description');
        expect(theme).toHaveProperty('colors');
        expect(theme.colors).toHaveProperty('primary');
        expect(theme.colors).toHaveProperty('bg');
        expect(theme.colors).toHaveProperty('accent');
      }
    });

    it('includes the "original" and "dark" themes', () => {
      const ids = THEMES.map((t) => t.id);
      expect(ids).toContain('original');
      expect(ids).toContain('dark');
    });
  });

  // -------------------------------------------------------------------
  // 2. Default theme
  // -------------------------------------------------------------------
  describe('default theme', () => {
    it('provides "original" as the default theme', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('original');
      expect(result.current.currentTheme.id).toBe('original');
    });

    it('exposes the full THEMES array via themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.themes).toBe(THEMES);
      expect(result.current.themes.length).toBe(THEMES.length);
    });
  });

  // -------------------------------------------------------------------
  // 3. setTheme changes theme
  // -------------------------------------------------------------------
  describe('setTheme', () => {
    it('changes the active theme when given a valid theme ID', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.currentTheme.id).toBe('dark');
      expect(result.current.currentTheme.label).toBe('Dark');
    });

    it('can switch between multiple themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('ocean');
      });
      expect(result.current.theme).toBe('ocean');

      act(() => {
        result.current.setTheme('forest');
      });
      expect(result.current.theme).toBe('forest');
      expect(result.current.currentTheme.label).toBe('Forest');
    });
  });

  // -------------------------------------------------------------------
  // 4. Invalid theme ID is ignored
  // -------------------------------------------------------------------
  describe('invalid theme', () => {
    it('ignores setTheme with an invalid theme ID', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('nonexistent-theme');
      });

      // Should still be the default
      expect(result.current.theme).toBe('original');
    });

    it('ignores setTheme with an empty string', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('');
      });

      expect(result.current.theme).toBe('original');
    });
  });

  // -------------------------------------------------------------------
  // 5. Theme persists to localStorage
  // -------------------------------------------------------------------
  describe('localStorage persistence', () => {
    it('saves the selected theme to localStorage', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(localStorage.getItem('easylife-theme')).toBe('dark');
    });

    it('updates localStorage when theme changes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('ocean');
      });
      expect(localStorage.getItem('easylife-theme')).toBe('ocean');

      act(() => {
        result.current.setTheme('sunset');
      });
      expect(localStorage.getItem('easylife-theme')).toBe('sunset');
    });
  });

  // -------------------------------------------------------------------
  // 6. Reads theme from localStorage on init
  // -------------------------------------------------------------------
  describe('localStorage initialization', () => {
    it('reads a previously saved theme from localStorage', () => {
      localStorage.setItem('easylife-theme', 'lavender');

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('lavender');
      expect(result.current.currentTheme.id).toBe('lavender');
    });

    it('falls back to "original" when localStorage has an invalid theme ID', () => {
      localStorage.setItem('easylife-theme', 'invalid-id');

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('original');
    });
  });

  // -------------------------------------------------------------------
  // 7. Sets data-theme attribute on document.documentElement
  // -------------------------------------------------------------------
  describe('data-theme attribute', () => {
    it('sets data-theme on document.documentElement for the default theme', () => {
      renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.getAttribute('data-theme')).toBe('original');
    });

    it('updates data-theme when theme changes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  // -------------------------------------------------------------------
  // 8. useTheme without provider
  // -------------------------------------------------------------------
  describe('useTheme without provider', () => {
    it('throws an error when used outside ThemeProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(Function.prototype);

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      spy.mockRestore();
    });
  });
});
