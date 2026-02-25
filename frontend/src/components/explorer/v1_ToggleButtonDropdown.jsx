import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const V1ToggleButtonDropdown = ({
  options = [],
  togglesState = {},
  onChange,
  id = 'toggleSwitchDropdown',
  placeholder = 'Select toggle(s)',
  disabled = false,
  allSelected = false,
  handleToggleSelectAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compose label from active toggles
  const selectedLabel =
    options
      .filter((opt) => togglesState[opt.value])
      .map((opt) => opt.label || opt.value)
      .join(', ') || placeholder;

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

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className={`border border-neutral-300 rounded-md h-10 px-3 py-2 w-full text-left bg-white flex justify-between items-center shadow-sm transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500'
        }`}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="text-sm text-neutral-900 truncate">
          {trimLabel(selectedLabel)}
        </span>
        <span className="ml-2 flex-shrink-0">
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-auto">
            {options.map((opt, idx) => {
              const toggleId = `${id}-toggle-${idx}`;
              const isOn = !!togglesState[opt.value];
              return (
                <div
                  key={toggleId}
                  className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors text-sm ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-50'
                  }`}
                  onClick={(e) => {
                    if (disabled) return;
                    if (e.target.tagName === 'INPUT') return;
                    const newState = {
                      ...togglesState,
                      [opt.value]: !togglesState[opt.value],
                    };
                    onChange(newState);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isOn}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                      e.preventDefault();
                      const newState = {
                        ...togglesState,
                        [opt.value]: !togglesState[opt.value],
                      };
                      onChange(newState);
                    }
                  }}
                >
                  <span className="flex items-center w-full">
                    {/* Toggle switch */}
                    <span className="relative inline-block w-10 h-6 mr-3 flex-shrink-0">
                      <input
                        type="checkbox"
                        id={toggleId}
                        checked={isOn}
                        onChange={(e) => {
                          const newState = {
                            ...togglesState,
                            [opt.value]: e.target.checked,
                          };
                          onChange(newState);
                        }}
                        disabled={disabled}
                        className="sr-only"
                      />
                      <span
                        className={`block w-10 h-6 rounded-full transition-colors duration-200 ${
                          isOn ? 'bg-red-500' : 'bg-neutral-300'
                        }`}
                      />
                      <span
                        className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          isOn ? 'translate-x-4' : ''
                        }`}
                      />
                    </span>
                    <label
                      className={`cursor-pointer select-none ${
                        isOn ? 'font-medium text-neutral-900' : 'text-neutral-600'
                      }`}
                      htmlFor={toggleId}
                    >
                      {opt.label || opt.value}
                    </label>
                  </span>
                </div>
              );
            })}
          </div>
          {handleToggleSelectAll && (
            <div className="border-t border-neutral-200 px-3 py-2 bg-neutral-50 flex items-center">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className={`w-full px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  allSelected
                    ? 'bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300'
                    : 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                }`}
              >
                {allSelected ? 'Disable All' : 'Enable All'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default V1ToggleButtonDropdown;
