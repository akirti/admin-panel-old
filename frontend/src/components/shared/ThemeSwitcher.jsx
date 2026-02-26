import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-surface-hover transition-colors text-content-secondary"
        title="Switch theme"
      >
        <Palette size={20} />
        {!compact && <span className="text-sm">Theme</span>}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface rounded-xl shadow-lg border border-edge py-2 z-50">
          <p className="px-3 py-1.5 text-xs font-semibold text-content-muted uppercase tracking-wider">
            Choose Theme
          </p>
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors ${
                theme === t.id ? 'bg-primary-50' : ''
              }`}
            >
              <div className="flex gap-1 shrink-0">
                <span
                  className="w-4 h-4 rounded-full border border-edge"
                  style={{ backgroundColor: t.colors.primary }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-edge"
                  style={{ backgroundColor: t.colors.bg }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-edge"
                  style={{ backgroundColor: t.colors.accent }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    theme === t.id ? 'text-primary-600' : 'text-content'
                  }`}
                >
                  {t.label}
                </p>
                <p className="text-xs text-content-muted truncate">{t.description}</p>
              </div>
              {theme === t.id && <Check size={14} className="text-primary-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
