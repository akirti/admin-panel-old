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

// --- Extracted sub-components for reduced cognitive complexity ---

const TagFilterItem = ({ tag, isSelected, onSelect }) => (
  <li
    className={`px-3 py-1.5 cursor-pointer text-sm transition-colors ${
      isSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-surface-hover text-content-secondary'
    }`}
    onClick={() => onSelect(tag)}
  >
    {tag}
  </li>
);

const SuggestionPortal = ({ menuRef, style, tags, selectedTag, tagBtnRef, onToggleTagFilter, onClearTag, loading, customers, inputValue, onSelect }) => (
  <div ref={menuRef} style={style} className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden">
    <TagFilterBar tags={tags} selectedTag={selectedTag} tagBtnRef={tagBtnRef} onToggle={onToggleTagFilter} onClear={onClearTag} />
    <ul className="max-h-52 overflow-auto">
      <CustomerList loading={loading} customers={customers} inputValue={inputValue} onSelect={onSelect} />
    </ul>
  </div>
);

const TagFilterPortal = ({ tagMenuRef, style, tags, selectedTag, onTagSelect }) => (
  <div
    ref={tagMenuRef}
    style={style}
    className="bg-surface border border-edge rounded-md shadow-lg overflow-hidden"
  >
    <ul className="max-h-40 overflow-auto">
      {tags.map((t) => (
        <TagFilterItem key={t} tag={t} isSelected={selectedTag === t} onSelect={onTagSelect} />
      ))}
    </ul>
  </div>
);

const InputField = ({ inputRef, placeholder, inputValue, onChange, onFocus, onClear }) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
    <input
      ref={inputRef}
      type="text"
      className="w-full pl-8 pr-8 h-10 text-sm border border-edge rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors hover:border-neutral-400"
      placeholder={placeholder}
      value={inputValue}
      onChange={onChange}
      onFocus={onFocus}
      autoComplete="off"
    />
    {inputValue && (
      <button
        type="button"
        onClick={onClear}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
      >
        <X size={16} />
      </button>
    )}
  </div>
);

// --- Position helpers ---

const computeSuggestPosition = (el, spaceThreshold = 280) => {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const openUp = window.innerHeight - rect.bottom < spaceThreshold;
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

const computeTagMenuPosition = (el) => {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { position: 'fixed', zIndex: 10000, width: 200, left: rect.left, top: rect.bottom + 4 };
};

// --- Lifecycle hooks ---

const useOutsideClickClose = (setIsOpen, setShowTagFilter, refs) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isClickInside(event, ...refs)) {
        setIsOpen(false);
        setShowTagFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen, setShowTagFilter, refs]);
};

const useRepositionOnScroll = (isOpen, computePosition, menuRef) => {
  useLayoutEffect(() => {
    if (!isOpen) return;
    const reposition = () => applyPositionStyle(menuRef.current, computePosition());
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, computePosition, menuRef]);
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
  const outsideClickRefs = useRef([inputRef, menuRef, tagMenuRef, tagBtnRef]);

  useEffect(() => { setInputValue(value || ''); }, [value]);

  const computePosition = useCallback(
    () => computeSuggestPosition(inputRef.current),
    []
  );

  const openDropdown = useCallback(() => {
    menuStyleRef.current = computePosition();
    setIsOpen(true);
  }, [computePosition]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange?.(val);
    onSearch?.(val);
    if (!isOpen) openDropdown();
  };

  const handleSelect = (customer) => {
    setInputValue(customer.customerId);
    onChange?.(customer.customerId);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue('');
    onChange?.('');
    onSearch?.('');
    inputRef.current?.focus();
  };

  const handleTagSelect = (tag) => {
    setSelectedTag(tag);
    setShowTagFilter(false);
    onFilterByTag?.(tag);
    if (!isOpen) openDropdown();
  };

  useOutsideClickClose(setIsOpen, setShowTagFilter, outsideClickRefs.current);
  useRepositionOnScroll(isOpen, computePosition, menuRef);

  const handleToggleTagFilter = () => {
    if (!showTagFilter) tagMenuStyleRef.current = computeTagMenuPosition(tagBtnRef.current);
    setShowTagFilter((prev) => !prev);
  };

  const handleFocus = () => {
    if (customers.length > 0) openDropdown();
  };

  const handleClearTag = () => handleTagSelect('');

  const suggestionMenu = isOpen && menuStyleRef.current
    ? createPortal(
        <SuggestionPortal
          menuRef={menuRef}
          style={menuStyleRef.current}
          tags={tags}
          selectedTag={selectedTag}
          tagBtnRef={tagBtnRef}
          onToggleTagFilter={handleToggleTagFilter}
          onClearTag={handleClearTag}
          loading={loading}
          customers={customers}
          inputValue={inputValue}
          onSelect={handleSelect}
        />,
        document.body
      )
    : null;

  const tagFilterMenu = showTagFilter && tagMenuStyleRef.current
    ? createPortal(
        <TagFilterPortal
          tagMenuRef={tagMenuRef}
          style={tagMenuStyleRef.current}
          tags={tags}
          selectedTag={selectedTag}
          onTagSelect={handleTagSelect}
        />,
        document.body
      )
    : null;

  return (
    <div className="relative w-full">
      <InputField
        inputRef={inputRef}
        placeholder={placeholder}
        inputValue={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onClear={handleClear}
      />
      {suggestionMenu}
      {tagFilterMenu}
    </div>
  );
};

export default V1CustomerSuggestInput;
