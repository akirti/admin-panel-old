import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

// --- Extracted helpers ---

const isClickInside = (event, ...refs) =>
  refs.some((ref) => ref.current?.contains(event.target));

const applyPositionStyle = (el, style) => {
  if (!el || !style) return;
  el.style.top = style.top != null ? `${style.top}px` : '';
  el.style.bottom = style.bottom != null ? `${style.bottom}px` : '';
  el.style.left = `${style.left}px`;
  el.style.width = `${style.width}px`;
};

const getSelectedLabel = (selectedOptions, options, placeholder) => {
  if (selectedOptions.length === 0) return placeholder;
  if (selectedOptions.length === options.length && options.length > 0) {
    return `All selected (${options.length})`;
  }
  return selectedOptions
    .map((val) => {
      const opt = options.find((o) => o.value === val);
      return opt ? opt.name : val;
    })
    .join(', ') || placeholder;
};

const trimLabel = (value, maxLength = 45) => {
  if (typeof value === 'string' && value.length > maxLength) {
    return <span title={value}>{value.slice(0, maxLength)}&hellip;</span>;
  }
  return value;
};

// --- Extracted sub-components ---

const MultiSelectOption = ({ option, idx, isChecked, onClick }) => (
  <li
    key={option.value || option.id || idx}
    className={`px-3 py-2 cursor-pointer flex items-center text-sm transition-colors ${
      isChecked ? 'bg-primary-50' : 'hover:bg-surface-hover'
    }`}
    onClick={() => onClick(option)}
  >
    <input
      type="checkbox"
      checked={isChecked}
      readOnly
      className="mr-2.5 accent-primary-600 w-4 h-4 rounded cursor-pointer"
    />
    <span className={isChecked ? 'font-medium text-content' : 'text-content-secondary'}>
      {option.name || option.label || option.value}
    </span>
  </li>
);

// Trigger button for the multi-select dropdown
const MultiSelectButton = ({ btnRef, isOpen, onClick, selectedOptions, options, placeholder }) => (
  <button
    ref={btnRef}
    type="button"
    className="border border-edge rounded-md h-10 px-3 py-2 text-left bg-surface flex items-center justify-between w-full hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors"
    onClick={onClick}
  >
    <span className="flex-1 text-left text-sm text-content truncate">
      {trimLabel(getSelectedLabel(selectedOptions, options, placeholder))}
    </span>
    <span className="ml-2 flex-shrink-0">
      {isOpen ? (
        <ChevronUp className="w-4 h-4 text-content-muted" />
      ) : (
        <ChevronDown className="w-4 h-4 text-content-muted" />
      )}
    </span>
  </button>
);

const SelectAllFooter = ({ allSelected, onToggle }) => (
  <div className="border-t border-edge px-3 py-2 bg-surface-secondary flex items-center">
    <button
      type="button"
      onClick={onToggle}
      className={`w-full px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
        allSelected
          ? 'bg-surface text-content-secondary hover:bg-surface-hover border-edge'
          : 'bg-primary-600 text-white hover:bg-primary-700 border-primary-600'
      }`}
    >
      {allSelected ? 'Clear All' : 'Select All'}
    </button>
  </div>
);

// Portal-rendered dropdown panel with search, options list, and optional footer
const MultiSelectPortal = ({
  menuRef,
  menuStyle,
  options,
  searchInputRef,
  searchTerm,
  onSearchChange,
  filteredOptions,
  selectedOptions,
  onOptionClick,
  multiSelectFooter,
  handleToggleSelectAll,
  allSelected,
}) => createPortal(
  <div
    ref={menuRef}
    style={menuStyle}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
        filteredOptions.map((option, idx) => (
          <MultiSelectOption
            key={option.value || option.id || idx}
            option={option}
            idx={idx}
            isChecked={selectedOptions.includes(option.value)}
            onClick={onOptionClick}
          />
        ))
      )}
    </ul>
    {multiSelectFooter && handleToggleSelectAll && (
      <SelectAllFooter allSelected={allSelected} onToggle={handleToggleSelectAll} />
    )}
  </div>,
  document.body
);

// --- Helpers for position and filtering ---

const computeMultiSelectPosition = (el, spaceThreshold = 260) => {
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

const filterOptionsByTerm = (options, searchTerm) => {
  if (!searchTerm.trim()) return options;
  const term = searchTerm.toLowerCase();
  return options.filter(
    (opt) =>
      (opt.name || '').toLowerCase().includes(term) ||
      (opt.value || '').toLowerCase().includes(term)
  );
};

const toggleOptionInList = (selectedOptions, optionValue) => {
  if (selectedOptions.includes(optionValue)) {
    return selectedOptions.filter((item) => item !== optionValue);
  }
  return [...selectedOptions, optionValue];
};

// --- Lifecycle hooks ---

const useOutsideClickClose = (setIsOpen, setSearchTerm, btnRef, menuRef) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isClickInside(event, btnRef, menuRef)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen, setSearchTerm, btnRef, menuRef]);
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

const useFocusOnOpen = (isOpen, searchInputRef) => {
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen, searchInputRef]);
};

// --- Main component ---

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

  const computePosition = useCallback(
    () => computeMultiSelectPosition(btnRef.current),
    []
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) menuStyleRef.current = computePosition();
      return !prev;
    });
  }, [computePosition]);

  useOutsideClickClose(setIsOpen, setSearchTerm, btnRef, menuRef);
  useRepositionOnScroll(isOpen, computePosition, menuRef);
  useFocusOnOpen(isOpen, searchInputRef);

  const handleOptionClick = (option) => {
    onChange(toggleOptionInList(selectedOptions, option.value));
  };

  const filteredOptions = useMemo(
    () => filterOptionsByTerm(options, searchTerm),
    [options, searchTerm]
  );

  const dropdownMenu = isOpen && menuStyleRef.current
    ? <MultiSelectPortal
        menuRef={menuRef}
        menuStyle={menuStyleRef.current}
        options={options}
        searchInputRef={searchInputRef}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filteredOptions={filteredOptions}
        selectedOptions={selectedOptions}
        onOptionClick={handleOptionClick}
        multiSelectFooter={multiSelectFooter}
        handleToggleSelectAll={handleToggleSelectAll}
        allSelected={allSelected}
      />
    : null;

  return (
    <div className="relative w-full">
      {label && (
        <label className="font-medium text-content-secondary mb-1 block text-sm">
          {label}
        </label>
      )}
      <MultiSelectButton
        btnRef={btnRef}
        isOpen={isOpen}
        onClick={handleToggle}
        selectedOptions={selectedOptions}
        options={options}
        placeholder={placeholder}
      />
      {dropdownMenu}
    </div>
  );
};

export default V1MultiSelectDropdown;
