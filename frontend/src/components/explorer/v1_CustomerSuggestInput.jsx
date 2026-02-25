import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Tag, ChevronDown } from 'lucide-react';

const V1CustomerSuggestInput = ({
  value = '',
  onChange,
  customers = [],
  tags = [],
  loading = false,
  onSearch,
  onFilterByTag,
  placeholder = 'Type customer # or name...',
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [showTagFilter, setShowTagFilter] = useState(false);

  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const menuStyleRef = useRef(null);
  const tagMenuRef = useRef(null);
  const tagBtnRef = useRef(null);
  const tagMenuStyleRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Compute dropdown position from input rect
  const computePosition = useCallback(() => {
    if (!inputRef.current) return null;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280;
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

  // Open the suggestion dropdown
  const openDropdown = useCallback(() => {
    menuStyleRef.current = computePosition();
    setIsOpen(true);
  }, [computePosition]);

  // Handle input change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange?.(val);
    if (onSearch) onSearch(val);
    if (!isOpen) openDropdown();
  };

  // Handle selecting a customer from suggestions
  const handleSelect = (customer) => {
    setInputValue(customer.customerId);
    onChange?.(customer.customerId);
    setIsOpen(false);
  };

  // Handle clearing input
  const handleClear = () => {
    setInputValue('');
    onChange?.('');
    if (onSearch) onSearch('');
    inputRef.current?.focus();
  };

  // Handle tag filter selection
  const handleTagSelect = (tag) => {
    setSelectedTag(tag);
    setShowTagFilter(false);
    if (onFilterByTag) onFilterByTag(tag);
    if (!isOpen) openDropdown();
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInInput = inputRef.current?.contains(event.target);
      const clickedInMenu = menuRef.current?.contains(event.target);
      const clickedInTagMenu = tagMenuRef.current?.contains(event.target);
      const clickedInTagBtn = tagBtnRef.current?.contains(event.target);
      if (!clickedInInput && !clickedInMenu && !clickedInTagMenu && !clickedInTagBtn) {
        setIsOpen(false);
        setShowTagFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposition on scroll/resize
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

  // Tag filter button position
  const computeTagPosition = useCallback(() => {
    if (!tagBtnRef.current) return null;
    const rect = tagBtnRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      zIndex: 10000,
      width: 200,
      left: rect.left,
      top: rect.bottom + 4,
    };
  }, []);

  const handleToggleTagFilter = () => {
    if (!showTagFilter) {
      tagMenuStyleRef.current = computeTagPosition();
    }
    setShowTagFilter((prev) => !prev);
  };

  // Source badge color
  const getSourceBadge = (source) => {
    if (source === 'direct') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
          Direct
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded truncate max-w-[100px]" title={source}>
        {source}
      </span>
    );
  };

  const suggestionMenu = isOpen && menuStyleRef.current
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyleRef.current}
          className="bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden"
        >
          {/* Tag filter bar */}
          {tags.length > 0 && (
            <div className="px-3 py-2 border-b border-neutral-100 flex items-center gap-2">
              <button
                ref={tagBtnRef}
                type="button"
                onClick={handleToggleTagFilter}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
                  selectedTag
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Tag size={12} />
                {selectedTag || 'Filter by tag'}
                <ChevronDown size={12} />
              </button>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => handleTagSelect('')}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Customer list */}
          <ul className="max-h-52 overflow-auto">
            {loading ? (
              <li className="px-3 py-4 text-center">
                <div className="w-5 h-5 border-2 border-neutral-200 border-t-red-600 rounded-full animate-spin mx-auto" />
              </li>
            ) : customers.length === 0 ? (
              <li className="px-3 py-3 text-sm text-neutral-400 text-center">
                {inputValue ? 'No matching customers' : 'No assigned customers'}
              </li>
            ) : (
              customers.map((cust) => (
                <li
                  key={cust.customerId}
                  className={`px-3 py-2 cursor-pointer text-sm hover:bg-neutral-50 transition-colors ${
                    inputValue === cust.customerId ? 'bg-red-50' : ''
                  }`}
                  onClick={() => handleSelect(cust)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-neutral-900">{cust.customerId}</span>
                      {cust.name && (
                        <span className="text-neutral-500 ml-1.5">— {cust.name}</span>
                      )}
                    </div>
                    {getSourceBadge(cust.source)}
                  </div>
                  {cust.tags && cust.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cust.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-neutral-100 text-neutral-500 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )
    : null;

  // Tag filter dropdown portal
  const tagFilterMenu = showTagFilter && tagMenuStyleRef.current
    ? createPortal(
        <div
          ref={tagMenuRef}
          style={tagMenuStyleRef.current}
          className="bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden"
        >
          <ul className="max-h-40 overflow-auto">
            {tags.map((t) => (
              <li
                key={t}
                className={`px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                  selectedTag === t ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-neutral-50 text-neutral-700'
                }`}
                onClick={() => handleTagSelect(t)}
              >
                {t}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-8 pr-8 h-10 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors hover:border-neutral-400"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (customers.length > 0) openDropdown();
          }}
          autoComplete="off"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {suggestionMenu}
      {tagFilterMenu}
    </div>
  );
};

export default V1CustomerSuggestInput;
