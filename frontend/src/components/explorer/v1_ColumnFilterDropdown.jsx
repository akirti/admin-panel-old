import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { Filter, X, Check } from "lucide-react";

const isObj = (val) => val && typeof val === "object";

const getOptionKey = (option, idx) => {
  if (isObj(option) && option.value) return option.value;
  return String(option ?? idx);
};

const getOptionLabel = (option) => {
  if (isObj(option)) return option.label || option.value || option.id;
  return String(option);
};

const DROPDOWN_HEIGHT = 320;

const computeDropdownStyle = (triggerEl) => {
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;
  return {
    position: "fixed",
    top: showAbove ? rect.top - DROPDOWN_HEIGHT : rect.bottom + 4,
    left: rect.left,
    minWidth: 220,
    maxWidth: 280,
    zIndex: 9999,
  };
};

const OptionItem = ({ option, idx, isSelected, onToggle }) => (
  <label
    key={getOptionKey(option, idx)}
    className="flex items-center px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-sm"
  >
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggle(option)}
      className="mr-2 accent-blue-600 w-3.5 h-3.5"
    />
    <span
      className={`truncate ${isSelected ? "font-medium text-content" : "text-content-secondary"}`}
      title={getOptionLabel(option)}
    >
      {getOptionLabel(option) || "(empty)"}
    </span>
  </label>
);

const isClickInside = (event, ...refs) =>
  refs.some((ref) => ref.current?.contains(event.target));

const V1ColumnFilterDropdown = ({
  options = [],
  selectedOptions = [],
  onChange,
  columnLabel = "",
}) => {
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [localSelected, setLocalSelected] = useState(selectedOptions);
  const [searchTerm, setSearchTerm] = useState("");

  // Sync local state when parent changes
  useEffect(() => {
    setLocalSelected(selectedOptions);
  }, [selectedOptions]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (!isClickInside(event, triggerRef, dropdownRef)) {
        setIsOpen(false);
        setLocalSelected(selectedOptions);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, selectedOptions]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setLocalSelected(selectedOptions);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, selectedOptions]);

  // Position dropdown via portal
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      setDropdownStyle(computeDropdownStyle(triggerRef.current));
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) =>
      getOptionLabel(opt).toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const handleOptionClick = useCallback((option) => {
    setLocalSelected((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }, []);

  const handleSelectAll = () => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      filteredOptions.forEach((opt) => next.add(opt));
      return Array.from(next);
    });
  };

  const handleClearAll = () => {
    if (searchTerm) {
      // Only deselect visible (filtered) options
      setLocalSelected((prev) =>
        prev.filter((item) => !filteredOptions.includes(item))
      );
    } else {
      setLocalSelected([]);
    }
  };

  const handleApply = () => {
    onChange(localSelected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalSelected([]);
    onChange([]);
    setIsOpen(false);
  };

  const hasActiveFilter = selectedOptions.length > 0;

  const dropdown = (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-surface border border-edge rounded-lg shadow-lg flex flex-col"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <span className="text-xs font-semibold text-content uppercase tracking-wider truncate">
          Filter: {columnLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setLocalSelected(selectedOptions);
          }}
          className="text-content-muted hover:text-content p-0.5"
          aria-label="Close filter"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search box (shown when more than 8 options) */}
      {options.length > 8 && (
        <div className="px-3 py-2 border-b border-edge">
          <input
            type="text"
            placeholder="Search values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-edge rounded bg-surface text-content focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        </div>
      )}

      {/* Select All / Clear All */}
      {filteredOptions.length > 0 && (
        <div className="px-3 py-1.5 border-b border-edge-light flex items-center justify-between">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Select All
          </button>
          <span className="text-xs text-content-muted">
            {localSelected.length} of {options.length}
          </span>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-content-muted hover:underline"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Options list */}
      <div className="max-h-48 overflow-auto">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-4 text-content-muted text-sm text-center">
            {searchTerm ? "No matching values" : "No values"}
          </div>
        ) : (
          filteredOptions.map((option, idx) => (
            <OptionItem
              key={getOptionKey(option, idx)}
              option={option}
              idx={idx}
              isSelected={localSelected.includes(option)}
              onToggle={handleOptionClick}
            />
          ))
        )}
      </div>

      {/* Footer with Apply / Clear */}
      {options.length > 0 && (
        <div className="flex items-center justify-between border-t border-edge-light px-3 py-2">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-content-muted hover:text-red-600"
          >
            Clear Filter
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"
          >
            <Check size={12} /> Apply
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-0.5 rounded hover:bg-neutral-200 focus:outline-none ${
          hasActiveFilter ? "text-blue-600" : "text-content-muted"
        }`}
        aria-label={`Filter ${columnLabel}`}
        title={`Filter ${columnLabel}`}
      >
        <Filter size={14} />
      </button>
      {isOpen && ReactDOM.createPortal(dropdown, document.body)}
    </>
  );
};

export default V1ColumnFilterDropdown;
