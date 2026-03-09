import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// --- Extracted sub-components for reduced cognitive complexity ---

const RadioOptionItem = ({ opt, idx, name, isSelected, onSelect }) => {
  const radioId = `${name}-${idx}`;
  const optValue = opt.value || opt.name;
  return (
    <div
      className={`flex items-center px-3 py-2 cursor-pointer transition-colors text-sm ${
        isSelected ? 'bg-primary-50' : 'hover:bg-surface-hover'
      }`}
      onClick={() => onSelect(optValue)}
    >
      <input
        className="w-4 h-4 accent-primary-600 cursor-pointer"
        type="radio"
        name={name}
        id={radioId}
        value={optValue}
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
};

const RadioOptionList = ({ options, name, value, onSelect }) => (
  <div className="absolute z-20 mt-1 w-full bg-surface border border-edge rounded-md shadow-lg max-h-48 overflow-auto">
    {options.map((opt, idx) => (
      <RadioOptionItem
        key={`${name}-${idx}`}
        opt={opt}
        idx={idx}
        name={name}
        isSelected={value === (opt.value || opt.name)}
        onSelect={onSelect}
      />
    ))}
  </div>
);

const DropdownButton = ({ onClick, label, isOpen }) => (
  <button
    type="button"
    className="border border-edge rounded-md h-10 px-3 py-2 w-full text-left bg-surface flex justify-between items-center hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors"
    onClick={onClick}
  >
    <span className="text-sm text-content truncate">{label}</span>
    <span className="ml-2 flex-shrink-0">
      {isOpen ? (
        <ChevronUp className="w-4 h-4 text-content-muted" />
      ) : (
        <ChevronDown className="w-4 h-4 text-content-muted" />
      )}
    </span>
  </button>
);

// --- Main component ---

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

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <DropdownButton onClick={() => setIsOpen((o) => !o)} label={selectedLabel} isOpen={isOpen} />
      {isOpen && (
        <RadioOptionList options={options} name={name} value={value} onSelect={handleSelect} />
      )}
    </div>
  );
};

export default V1RadioButtonDropdown;
