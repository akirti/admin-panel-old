import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Tag, ChevronDown } from 'lucide-react';

// --- Helper functions ---

const isClickInside = (event, ...refs) =>
  refs.some((ref) => ref.current?.contains(event.target));

const applyPositionStyle = (el, style) => {
  if (!el || !style) return;
  el.style.top = style.top != null ? `${style.top}px` : '';
  el.style.bottom = style.bottom != null ? `${style.bottom}px` : '';
  el.style.left = `${style.left}px`;
  el.style.width = `${style.width}px`;
};

// --- Sub-components ---

const SourceBadge = ({ source }) => {
  const isDirect = source === 'direct';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${
        isDirect ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700 truncate max-w-[100px]'
      }`}
      title={isDirect ? undefined : source}
    >
      {isDirect ? 'Direct' : source}
    </span>
  );
};

const CustomerListItem = ({ cust, isSelected, onSelect }) => (
  <li
    className={`px-3 py-2 cursor-pointer text-sm hover:bg-surface-hover transition-colors ${
      isSelected ? 'bg-primary-50' : ''
    }`}
    onClick={() => onSelect(cust)}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-content">{cust.customerId}</span>
        {cust.name && (
          <span className="text-content-muted ml-1.5">— {cust.name}</span>
        )}
      </div>
      <SourceBadge source={cust.source} />
    </div>
    {cust.tags?.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-1">
        {cust.tags.map((t) => (
          <span key={t} className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-base-secondary text-content-muted rounded">
            {t}
          </span>
        ))}
      </div>
    )}
  </li>
);

const CustomerList = ({ loading, customers, inputValue, onSelect }) => {
  if (loading) {
    return (
      <li className="px-3 py-4 text-center">
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
      </li>
    );
  }
  if (customers.length === 0) {
    return (
      <li className="px-3 py-3 text-sm text-content-muted text-center">
        {inputValue ? 'No matching customers' : 'No assigned customers'}
      </li>
    );
  }
  return customers.map((cust) => (
    <CustomerListItem key={cust.customerId} cust={cust} isSelected={inputValue === cust.customerId} onSelect={onSelect} />
  ));
};

const TagFilterBar = ({ tags, selectedTag, tagBtnRef, onToggle, onClear }) => {
  if (tags.length === 0) return null;
  return (
    <div className="px-3 py-2 border-b border-edge-light flex items-center gap-2">
      <button
        ref={tagBtnRef}
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
          selectedTag
            ? 'bg-primary-50 border-primary-300 text-primary-700'
            : 'bg-surface-secondary border-edge text-content-secondary hover:bg-surface-hover'
        }`}
      >
        <Tag size={12} />
        {selectedTag || 'Filter by tag'}
        <ChevronDown size={12} />
      </button>
      {selectedTag && (
        <button type="button" onClick={onClear} className="text-xs text-content-muted hover:text-content-secondary">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// --- Main component ---

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
      if (!isClickInside(event, inputRef, menuRef, tagMenuRef, tagBtnRef)) {
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
    const reposition = () => applyPositionStyle(menuRef.current, computePosition());
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

  const suggestionMenu = isOpen && menuStyleRef.current
    ? createPortal(
        <div ref={menuRef} style={menuStyleRef.current} className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden">
          <TagFilterBar tags={tags} selectedTag={selectedTag} tagBtnRef={tagBtnRef} onToggle={handleToggleTagFilter} onClear={() => handleTagSelect('')} />
          <ul className="max-h-52 overflow-auto">
            <CustomerList loading={loading} customers={customers} inputValue={inputValue} onSelect={handleSelect} />
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
          className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden"
        >
          <ul className="max-h-40 overflow-auto">
            {tags.map((t) => (
              <li
                key={t}
                className={`px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                  selectedTag === t ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-surface-hover text-content-secondary'
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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-8 pr-8 h-10 text-sm border border-edge rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors hover:border-neutral-400"
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
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
