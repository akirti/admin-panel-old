import { memo, useState, useEffect, useCallback } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

const FONT_SCALES = [
  { key: 'small', label: 'A-', scale: 0.875, description: 'Small (87.5%)' },
  { key: 'default', label: 'A', scale: 1, description: 'Default (100%)' },
  { key: 'large', label: 'A+', scale: 1.125, description: 'Large (112.5%)' },
  { key: 'x-large', label: 'A++', scale: 1.25, description: 'Extra Large (125%)' },
];

const STORAGE_KEY = 'easylife-font-scale';

function getInitialScale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FONT_SCALES.some((s) => s.key === stored)) return stored;
  } catch { /* ignore */ }
  return 'default';
}

function applyFontScale(scaleKey) {
  document.documentElement.setAttribute('data-font-scale', scaleKey);
  try { localStorage.setItem(STORAGE_KEY, scaleKey); } catch { /* ignore */ }
}

// Apply on first load (before React hydrates)
applyFontScale(getInitialScale());

const FontSizeControl = memo(function FontSizeControl({ compact = false }) {
  const [currentScale, setCurrentScale] = useState(getInitialScale);

  useEffect(() => {
    applyFontScale(currentScale);
  }, [currentScale]);

  const currentIndex = FONT_SCALES.findIndex((s) => s.key === currentScale);

  const decrease = useCallback(() => {
    if (currentIndex > 0) setCurrentScale(FONT_SCALES[currentIndex - 1].key);
  }, [currentIndex]);

  const increase = useCallback(() => {
    if (currentIndex < FONT_SCALES.length - 1) setCurrentScale(FONT_SCALES[currentIndex + 1].key);
  }, [currentIndex]);

  const reset = useCallback(() => {
    setCurrentScale('default');
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Font size control">
        <button
          onClick={decrease}
          disabled={currentIndex === 0}
          className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 text-content-muted"
          aria-label="Decrease font size"
          title="Decrease font size"
        >
          <Minus size={14} />
        </button>
        <span className="text-xs text-content-muted font-medium w-5 text-center" aria-live="polite">
          {FONT_SCALES[currentIndex].label}
        </span>
        <button
          onClick={increase}
          disabled={currentIndex === FONT_SCALES.length - 1}
          className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 text-content-muted"
          aria-label="Increase font size"
          title="Increase font size"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Font size control">
      <span className="text-xs text-content-muted">Text:</span>
      <div className="flex items-center border border-edge rounded-lg overflow-hidden">
        <button
          onClick={decrease}
          disabled={currentIndex === 0}
          className="px-2 py-1 hover:bg-surface-hover disabled:opacity-30 text-content-muted border-r border-edge"
          aria-label="Decrease font size"
          title="Decrease font size"
        >
          <Minus size={14} />
        </button>
        <span className="px-2 py-1 text-xs text-content font-medium min-w-[2.5rem] text-center" aria-live="polite">
          {FONT_SCALES[currentIndex].description}
        </span>
        <button
          onClick={increase}
          disabled={currentIndex === FONT_SCALES.length - 1}
          className="px-2 py-1 hover:bg-surface-hover disabled:opacity-30 text-content-muted border-l border-edge"
          aria-label="Increase font size"
          title="Increase font size"
        >
          <Plus size={14} />
        </button>
      </div>
      {currentScale !== 'default' && (
        <button
          onClick={reset}
          className="p-1 rounded hover:bg-surface-hover text-content-muted"
          aria-label="Reset font size to default"
          title="Reset to default"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
});

export default FontSizeControl;
