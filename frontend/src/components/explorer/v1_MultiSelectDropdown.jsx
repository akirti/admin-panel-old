import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

const V1MultiSelectDropdown = ({
  options = [],
  selectedOptions = [],
  onChange,
  placeholder = 'Select...',
  label,
  allSelected = false,
  handleToggleSelectAll,
  multiSelectFooter = false,
}) => {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const menuStyleRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Compute position from button rect — returns style object
  const computePosition = useCallback(() => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260;
    return {
      position: 'fixed',
      zIndex: 9999,
      width: rect.width,
      left: rect.left,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }, []);

  // Toggle handler — compute position before opening so first paint is correct
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        menuStyleRef.current = computePosition();
      }
      return !prev;
    });
  }, [computePosition]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        btnRef.current && !btnRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposition on scroll / resize while open (useLayoutEffect to avoid flash)
  useLayoutEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const style = computePosition();
      if (style && menuRef.current) {
        Object.assign(menuRef.current.style, {
          top: style.top != null ? `${style.top}px` : '',
          bottom: style.bottom != null ? `${style.bottom}px` : '',
          left: `${style.left}px`,
          width: `${style.width}px`,
        });
      }
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, computePosition]);

  // Focus search input after menu is painted (preventScroll avoids container jump)
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const handleOptionClick = (option) => {
    if (selectedOptions.includes(option.value)) {
      onChange(selectedOptions.filter((item) => item !== option.value));
    } else {
      onChange([...selectedOptions, option.value]);
    }
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.name || '').toLowerCase().includes(term) ||
        (opt.value || '').toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const selectedLabel = () => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length === options.length && options.length > 0) {
      return `All selected (${options.length})`;
    }
    const names = selectedOptions
      .map((val) => {
        const opt = options.find((o) => o.value === val);
        return opt ? opt.name : val;
      });
    const text = names.join(', ');
    return text || placeholder;
  };

  const trimLabel = (value, maxLength = 45) => {
    if (typeof value === 'string' && value.length > maxLength) {
      return (
        <span title={value}>
          {value.slice(0, maxLength)}&hellip;
        </span>
      );
    }
    return value;
  };

  const dropdownMenu = isOpen && menuStyleRef.current
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyleRef.current}
          className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden"
        >
          {options.length > 5 && (
            <div className="p-2 border-b border-edge-light">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-edge rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          )}
          <ul className="max-h-48 overflow-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-content-muted select-none">
                No results found
              </li>
            ) : (
              filteredOptions.map((option, idx) => {
                const key = option.value || option.id || idx;
                const isChecked = selectedOptions.includes(option.value);
                return (
                  <li
                    key={key}
                    className={`px-3 py-2 cursor-pointer flex items-center text-sm transition-colors ${
                      isChecked ? 'bg-primary-50' : 'hover:bg-surface-hover'
                    }`}
                    onClick={() => handleOptionClick(option)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mr-2.5 accent-primary-600 w-4 h-4 rounded cursor-pointer"
                    />
                    <span
                      className={
                        isChecked
                          ? 'font-medium text-content'
                          : 'text-content-secondary'
                      }
                    >
                      {option.name || option.label || option.value}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
          {multiSelectFooter && handleToggleSelectAll && (
            <div className="border-t border-edge px-3 py-2 bg-surface-secondary flex items-center">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className={`w-full px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  allSelected
                    ? 'bg-surface text-content-secondary hover:bg-surface-hover border-edge'
                    : 'bg-primary-600 text-white hover:bg-primary-700 border-primary-600'
                }`}
              >
                {allSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full">
      {label && (
        <label className="font-medium text-content-secondary mb-1 block text-sm">
          {label}
        </label>
      )}
      <button
        ref={btnRef}
        type="button"
        className="border border-edge rounded-md h-10 px-3 py-2 text-left bg-surface flex items-center justify-between w-full hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors"
        onClick={handleToggle}
      >
        <span className="flex-1 text-left text-sm text-content truncate">
          {trimLabel(selectedLabel())}
        </span>
        <span className="ml-2 flex-shrink-0">
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-content-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-content-muted" />
          )}
        </span>
      </button>
      {dropdownMenu}
    </div>
  );
};

export default V1MultiSelectDropdown;
