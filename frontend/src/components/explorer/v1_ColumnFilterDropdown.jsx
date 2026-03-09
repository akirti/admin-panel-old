import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Filter } from "lucide-react";

const isObj = (val) => val && typeof val === "object";

const getOptionKey = (option, idx) => {
  if (isObj(option) && option.value) return option.value;
  return String(option ?? idx);
};

const getOptionLabel = (option) => {
  if (isObj(option)) return option.label || option.value || option.id;
  return String(option);
};

const DROPDOWN_HEIGHT = 260;

const computeDropdownStyle = (triggerEl) => {
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;
  return {
    position: "fixed",
    top: showAbove ? rect.top - DROPDOWN_HEIGHT : rect.bottom + 4,
    left: rect.left,
    minWidth: 200,
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
    <span className={isSelected ? "font-medium text-content" : "text-content-secondary"}>
      {getOptionLabel(option)}
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

  // Sync local state when parent changes
  useEffect(() => {
    setLocalSelected(selectedOptions);
  }, [selectedOptions]);

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

  // Position dropdown via portal
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      setDropdownStyle(computeDropdownStyle(triggerRef.current));
    }
  }, [isOpen]);

  const handleOptionClick = useCallback((option) => {
    setLocalSelected((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }, []);

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
      <div className="max-h-48 overflow-auto">
        {options.length === 0 ? (
          <div className="px-3 py-2 text-content-muted text-sm">No values</div>
        ) : (
          options.map((option, idx) => (
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
      {options.length > 0 && (
        <div className="flex items-center justify-between border-t border-edge-light px-3 py-2">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-content-muted hover:text-content-secondary"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Apply
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
