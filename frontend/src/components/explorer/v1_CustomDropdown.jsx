import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search, Check } from 'lucide-react';

// --- Extracted helpers (reduce cognitive complexity) ---

const isClickInside = (event, ...refs) =>
  refs.some((ref) => ref.current?.contains(event.target));

const applyPositionStyle = (el, style) => {
  if (!el || !style) return;
  el.style.top = style.top != null ? `${style.top}px` : '';
  el.style.bottom = style.bottom != null ? `${style.bottom}px` : '';
  el.style.left = `${style.left}px`;
  el.style.width = `${style.width}px`;
};

// --- Extracted sub-component ---

const DropdownOption = ({ opt, isSelected, onSelect }) => (
  <li
    className={`px-4 py-2 cursor-pointer text-sm flex items-center justify-between transition-colors ${
      isSelected
        ? 'bg-primary-50 text-primary-700 font-medium'
        : 'hover:bg-surface-hover text-content-secondary'
    }`}
    onClick={() => onSelect(opt.value)}
  >
    <span>{opt.name}</span>
    {isSelected && (
      <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
    )}
  </li>
);

// --- Extracted sub-components for reduced cognitive complexity ---

const DropdownSearchBox = ({ searchInputRef, searchTerm, onSearchChange }) => (
  <div className="p-2 border-b border-edge-light">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
      <input
        ref={searchInputRef}
        type="text"
        className="w-full pl-8 pr-3 py-1.5 text-sm border border-edge rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  </div>
);

const DropdownMenu = ({ menuRef, style, showSearch, searchInputRef, searchTerm, onSearchChange, filteredOptions, value, onSelect }) => (
  <div
    ref={menuRef}
    style={style}
    className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden"
  >
    {showSearch && (
      <DropdownSearchBox searchInputRef={searchInputRef} searchTerm={searchTerm} onSearchChange={onSearchChange} />
    )}
    <ul className="max-h-48 overflow-auto">
      {filteredOptions.length === 0 ? (
        <li className="px-4 py-2 text-sm text-content-muted select-none">
          No results found
        </li>
      ) : (
        filteredOptions.map((opt) => (
          <DropdownOption
            key={opt.value}
            opt={opt}
            isSelected={opt.value === value}
            onSelect={onSelect}
          />
        ))
      )}
    </ul>
  </div>
);

const DropdownButton = ({ btnRef, onClick, label, isOpen }) => (
  <button
    ref={btnRef}
    type="button"
    className="border border-edge rounded-md h-10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-surface flex items-center w-full justify-between hover:border-neutral-400 shadow-sm transition-colors"
    onClick={onClick}
  >
    <span className="truncate text-content">{label}</span>
    {isOpen ? (
      <ChevronUp className="ml-2 w-4 h-4 text-content-muted flex-shrink-0" />
    ) : (
      <ChevronDown className="ml-2 w-4 h-4 text-content-muted flex-shrink-0" />
    )}
  </button>
);

// --- Helpers for computing dropdown position and filtering ---

const computeDropdownPosition = (btnEl, upward) => {
  if (!btnEl) return null;
  const rect = btnEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = upward || spaceBelow < 220;
  return {
    position: 'fixed',
    zIndex: 9999,
    width: rect.width,
    left: rect.left,
    ...(openUp
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };
};

const filterOptionsByTerm = (options, searchTerm) => {
  if (!searchTerm.trim()) return options;
  const term = searchTerm.toLowerCase();
  return options.filter(
    (opt) =>
      (opt.name || '').toLowerCase().includes(term) ||
      (opt.value || '').toLowerCase().includes(term)
  );
};

const getSelectedLabel = (options, value, placeholder) => {
  const selected = options.find((opt) => opt.value === value);
  return selected ? selected.name : placeholder;
};

// --- Hooks for dropdown lifecycle ---

const useOutsideClickClose = (open, setOpen, setSearchTerm, btnRef, menuRef) => {
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (!isClickInside(event, btnRef, menuRef)) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen, setSearchTerm, btnRef, menuRef]);
};

const useRepositionOnScroll = (open, computePosition, menuRef) => {
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => applyPositionStyle(menuRef.current, computePosition());
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, computePosition, menuRef]);
};

const useFocusOnOpen = (open, searchInputRef) => {
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [open, searchInputRef]);
};

// --- Main component ---

const V1CustomDropdown = ({
  options = [],
  value,
  onChange,
  className = '',
  width = '100%',
  upward = false,
  placeholder = 'Select',
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const menuStyleRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const computePosition = useCallback(
    () => computeDropdownPosition(btnRef.current, upward),
    [upward]
  );

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) menuStyleRef.current = computePosition();
      return !prev;
    });
  }, [computePosition]);

  useOutsideClickClose(open, setOpen, setSearchTerm, btnRef, menuRef);
  useRepositionOnScroll(open, computePosition, menuRef);
  useFocusOnOpen(open, searchInputRef);

  const filteredOptions = useMemo(
    () => filterOptionsByTerm(options, searchTerm),
    [options, searchTerm]
  );

  const handleSelect = (val) => {
    setOpen(false);
    setSearchTerm('');
    if (val !== value) onChange?.(val);
  };

  const buttonLabel = getSelectedLabel(options, value, placeholder);

  const dropdownMenu = open && menuStyleRef.current
    ? createPortal(
        <DropdownMenu
          menuRef={menuRef}
          style={menuStyleRef.current}
          showSearch={options.length > 5}
          searchInputRef={searchInputRef}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filteredOptions={filteredOptions}
          value={value}
          onSelect={handleSelect}
        />,
        document.body
      )
    : null;

  return (
    <div
      className={`relative ${className}`}
      style={{ minWidth: width }}
    >
      <DropdownButton btnRef={btnRef} onClick={handleToggle} label={buttonLabel} isOpen={open} />
      {dropdownMenu}
    </div>
  );
};

export default V1CustomDropdown;
