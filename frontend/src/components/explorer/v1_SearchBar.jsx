import React from 'react';
import { Search, X } from 'lucide-react';

function V1SearchBar({ value, onChange, placeholder = 'Search scenarios...' }) {
  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 border border-neutral-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default V1SearchBar;
