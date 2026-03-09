import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// --- Extracted helpers (reduce cognitive complexity) ---

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

// --- Extracted sub-components ---

const ToggleSwitch = ({ toggleId, isOn, disabled, onChange }) => (
  <span className="relative inline-block w-10 h-6 mr-3 flex-shrink-0">
    <input
      type="checkbox"
      id={toggleId}
      checked={isOn}
      onChange={onChange}
      disabled={disabled}
      className="sr-only"
    />
    <span
      className={`block w-10 h-6 rounded-full transition-colors duration-200 ${
        isOn ? 'bg-primary-500' : 'bg-neutral-300'
      }`}
    />
    <span
      className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
        isOn ? 'translate-x-4' : ''
      }`}
    />
  </span>
);

const ToggleOptionItem = ({ opt, toggleId, isOn, disabled, onToggle, onCheckboxChange }) => (
  <div
    className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors text-sm ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-hover'
    }`}
    onClick={onToggle}
    tabIndex={0}
    role="button"
    aria-pressed={isOn}
    onKeyDown={(e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        onToggle(e);
      }
    }}
  >
    <span className="flex items-center w-full">
      <ToggleSwitch toggleId={toggleId} isOn={isOn} disabled={disabled} onChange={onCheckboxChange} />
      <label
        className={`cursor-pointer select-none ${
          isOn ? 'font-medium text-content' : 'text-content-secondary'
        }`}
        htmlFor={toggleId}
      >
        {opt.label || opt.value}
      </label>
    </span>
  </div>
);

const SelectAllFooter = ({ onToggleSelectAll, allSelected }) => (
  <div className="border-t border-edge px-3 py-2 bg-surface-secondary flex items-center">
    <button
      type="button"
      onClick={onToggleSelectAll}
      className={`w-full px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
        allSelected
          ? 'bg-surface text-content-secondary hover:bg-surface-hover border-edge'
          : 'bg-primary-600 text-white hover:bg-primary-700 border-primary-600'
      }`}
    >
      {allSelected ? 'Disable All' : 'Enable All'}
    </button>
  </div>
);

const ToggleDropdownButton = ({ onClick, label, isOpen, disabled }) => (
  <button
    type="button"
    className={`border border-edge rounded-md h-10 px-3 py-2 w-full text-left bg-surface flex justify-between items-center shadow-sm transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
    }`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="text-sm text-content truncate">
      {trimLabel(label)}
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

// --- Helpers ---

const getActiveToggleLabel = (options, togglesState, placeholder) =>
  options
    .filter((opt) => togglesState[opt.value])
    .map((opt) => opt.label || opt.value)
    .join(', ') || placeholder;

const shouldIgnoreToggleEvent = (e, disabled) =>
  disabled || e?.target?.tagName === 'INPUT';

const useCloseOnOutsideClick = (dropdownRef, setIsOpen) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef, setIsOpen]);
};

// --- Main component ---

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

  useCloseOnOutsideClick(dropdownRef, setIsOpen);

  const selectedLabel = getActiveToggleLabel(options, togglesState, placeholder);

  const createToggleHandler = useCallback((optValue) => (e) => {
    if (shouldIgnoreToggleEvent(e, disabled)) return;
    onChange({ ...togglesState, [optValue]: !togglesState[optValue] });
  }, [disabled, togglesState, onChange]);

  const createCheckboxHandler = useCallback((optValue) => (e) => {
    onChange({ ...togglesState, [optValue]: e.target.checked });
  }, [togglesState, onChange]);

  const handleButtonClick = () => {
    if (!disabled) setIsOpen((o) => !o);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <ToggleDropdownButton onClick={handleButtonClick} label={selectedLabel} isOpen={isOpen} disabled={disabled} />
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-edge rounded-md shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-auto">
            {options.map((opt, idx) => {
              const toggleId = `${id}-toggle-${idx}`;
              return (
                <ToggleOptionItem
                  key={toggleId}
                  opt={opt}
                  toggleId={toggleId}
                  isOn={!!togglesState[opt.value]}
                  disabled={disabled}
                  onToggle={createToggleHandler(opt.value)}
                  onCheckboxChange={createCheckboxHandler(opt.value)}
                />
              );
            })}
          </div>
          {handleToggleSelectAll && (
            <SelectAllFooter onToggleSelectAll={handleToggleSelectAll} allSelected={allSelected} />
          )}
        </div>
      )}
    </div>
  );
};

export default V1ToggleButtonDropdown;
