import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Filter } from "lucide-react";

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
    const handleClickOutside = (event) => {
      const triggerClicked =
        triggerRef.current && triggerRef.current.contains(event.target);
      const dropdownClicked =
        dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!triggerClicked && !dropdownClicked) {
        setIsOpen(false);
        setLocalSelected(selectedOptions);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, selectedOptions]);

  // Position dropdown via portal
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownStyle({
        position: "fixed",
        top: showAbove ? rect.top - dropdownHeight : rect.bottom + 4,
        left: rect.left,
        minWidth: 200,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  const handleOptionClick = (option) => {
    setLocalSelected((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
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
      className="bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col"
    >
      <div className="max-h-48 overflow-auto">
        {options.length === 0 ? (
          <div className="px-3 py-2 text-gray-400 text-sm">No values</div>
        ) : (
          options.map((option, idx) => {
            const key =
              option && typeof option === "object" && option.value
                ? option.value
                : String(option ?? idx);
            const label =
              option && typeof option === "object"
                ? option.label || option.value || option.id
                : String(option);
            return (
              <label
                key={key}
                className="flex items-center px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-sm"
              >
                <input
                  type="checkbox"
                  checked={localSelected.includes(option)}
                  onChange={() => handleOptionClick(option)}
                  className="mr-2 accent-blue-600 w-3.5 h-3.5"
                />
                <span
                  className={
                    localSelected.includes(option)
                      ? "font-medium text-gray-900"
                      : "text-gray-600"
                  }
                >
                  {label}
                </span>
              </label>
            );
          })
        )}
      </div>
      {options.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-700"
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
        className={`p-0.5 rounded hover:bg-gray-200 focus:outline-none ${
          hasActiveFilter ? "text-blue-600" : "text-gray-400"
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
