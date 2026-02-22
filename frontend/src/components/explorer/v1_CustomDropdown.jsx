import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search, Check } from 'lucide-react';

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

  // Compute position from button rect — returns style object
  const computePosition = useCallback(() => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
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
  }, [upward]);

  // Toggle handler — compute position before opening so the first paint is correct
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        menuStyleRef.current = computePosition();
      }
      return !prev;
    });
  }, [computePosition]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (
        btnRef.current && !btnRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Reposition on scroll / resize while open (useLayoutEffect to avoid flash)
  useLayoutEffect(() => {
    if (!open) return;
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
  }, [open, computePosition]);

  // Focus search input after menu is painted (preventScroll avoids container jump)
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const selected = options.find((opt) => opt.value === value) || null;

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.name || '').toLowerCase().includes(term) ||
        (opt.value || '').toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const handleSelect = (val) => {
    setOpen(false);
    setSearchTerm('');
    if (val !== value) onChange?.(val);
  };

  const dropdownMenu = open && menuStyleRef.current
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyleRef.current}
          className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
        >
          {options.length > 5 && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          )}
          <ul className="max-h-48 overflow-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-2 text-sm text-gray-400 select-none">
                No results found
              </li>
            ) : (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  className={`px-4 py-2 cursor-pointer text-sm flex items-center justify-between transition-colors ${
                    opt.value === value
                      ? 'bg-red-50 text-red-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span>{opt.name}</span>
                  {opt.value === value && (
                    <Check className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className={`relative ${className}`}
      style={{ minWidth: width }}
    >
      <button
        ref={btnRef}
        type="button"
        className="border border-gray-300 rounded-md h-10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white flex items-center w-full justify-between hover:border-gray-400 shadow-sm transition-colors"
        onClick={handleToggle}
      >
        <span className="truncate text-gray-900">
          {selected ? selected.name : placeholder}
        </span>
        {open ? (
          <ChevronUp className="ml-2 w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="ml-2 w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {dropdownMenu}
    </div>
  );
};

export default V1CustomDropdown;
