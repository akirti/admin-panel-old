import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const V1RadioButtonDropdown = ({
  options = [],
  value,
  onChange,
  name,
  placeholder = 'Select an option',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => (opt.value || opt.name) === value)?.name ||
    placeholder;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className="border border-edge rounded-md h-10 px-3 py-2 w-full text-left bg-surface flex justify-between items-center hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors"
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className="text-sm text-content truncate">{selectedLabel}</span>
        <span className="ml-2 flex-shrink-0">
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-content-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-content-muted" />
          )}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-edge rounded-md shadow-lg max-h-48 overflow-auto">
          {options.map((opt, idx) => {
            const radioId = `${name}-${idx}`;
            const isSelected = value === (opt.value || opt.name);
            return (
              <div
                key={radioId}
                className={`flex items-center px-3 py-2 cursor-pointer transition-colors text-sm ${
                  isSelected ? 'bg-primary-50' : 'hover:bg-surface-hover'
                }`}
                onClick={() => {
                  onChange(opt.value || opt.name);
                  setIsOpen(false);
                }}
              >
                <input
                  className="w-4 h-4 accent-primary-600 cursor-pointer"
                  type="radio"
                  name={name}
                  id={radioId}
                  value={opt.value || opt.name}
                  checked={isSelected}
                  readOnly
                />
                <label
                  className={`ml-2.5 cursor-pointer select-none ${
                    isSelected ? 'font-medium text-content' : 'text-content-secondary'
                  }`}
                  htmlFor={radioId}
                >
                  {opt.name || opt.value}
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default V1RadioButtonDropdown;
