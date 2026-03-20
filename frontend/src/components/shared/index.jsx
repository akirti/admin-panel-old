import { useEffect, useCallback } from 'react';
import { X, Search, Upload, Loader2 } from 'lucide-react';

// Button Component
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 disabled:bg-primary-300',
    secondary: 'bg-neutral-100 text-content-secondary hover:bg-neutral-200 focus:ring-neutral-500 border border-edge',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    ghost: 'text-content-secondary hover:bg-surface-hover focus:ring-neutral-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin -ml-1 mr-2" />}
      {children}
    </button>
  );
};

// Input Component
export const Input = ({
  label,
  error,
  className = '',
  required = false,
  id: externalId,
  ...props
}) => {
  const inputId = externalId || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-content-secondary mb-1">
          {label}{required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface-input text-content transition-all ${
          error ? 'border-red-500' : 'border-edge'
        } ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        aria-required={required || undefined}
        {...props}
      />
      {error && <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
};

// Select Component
export const Select = ({
  label,
  options = [],
  error,
  className = '',
  required = false,
  id: externalId,
  ...props
}) => {
  const selectId = externalId || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = error && selectId ? `${selectId}-error` : undefined;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-content-secondary mb-1">
          {label}{required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface-input text-content transition-all ${
          error ? 'border-red-500' : 'border-edge'
        } ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        aria-required={required || undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
};

// Card Component
export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Badge Component
export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-neutral-100 text-neutral-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    primary: 'bg-primary-100 text-primary-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// Modal Component
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black/50" onClick={onClose} aria-hidden="true" />
        <div
          className={`relative inline-block w-full ${sizes[size]} p-6 my-8 text-left align-middle transition-all transform bg-surface shadow-xl rounded-xl`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 id="modal-title" className="text-lg font-semibold text-content">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="text-content-muted hover:text-content-secondary focus:outline-none"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

// Table Component — now powered by DataGrid with sort + Excel-like filters
// Columns support: { key, title, render, sortable, filterable, filterValue, sortValue }
// Set sortable/filterable to false on a column to disable. Actions columns auto-disabled.
export { DataGrid as Table } from './DataGrid';

// Toggle Component
export const Toggle = ({ enabled, onChange, label }) => {
  const isEnabled = enabled === true;
  return (
    <div className="flex items-center">
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={label}
        onClick={() => onChange(!isEnabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isEnabled ? 'bg-primary-600' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isEnabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="ml-3 text-sm text-content-secondary">{label}</span>}
    </div>
  );
};

// Stat Card Component
export const StatCard = ({ title, value, icon, trend, trendValue }) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-content-muted">{title}</p>
          <p className="mt-1 text-3xl font-bold text-content">{value}</p>
          {trend && (
            <p className={`mt-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-50 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

// Search Input Component
export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => {
  return (
    <div className="relative" role="search">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search size={20} className="text-content-muted" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full pl-10 pr-3 py-2 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface-input text-content text-sm"
        placeholder={placeholder}
        aria-label={placeholder || 'Search'}
      />
    </div>
  );
};

const computePageRange = (displayPage, totalPages, maxVisible = 7) => {
  let startPage = Math.max(1, displayPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  const pages = [];
  for (let i = startPage; i <= endPage; i++) pages.push(i);
  return { startPage, endPage, pages };
};

// Pagination Component
export const Pagination = ({
  currentPage,
  totalPages,
  total,
  limit = 25,
  onPageChange,
  showInfo = true
}) => {
  const displayPage = currentPage + 1;
  const { startPage, endPage, pages } = computePageRange(displayPage, totalPages);

  const startItem = currentPage * limit + 1;
  const endItem = Math.min((currentPage + 1) * limit, total);

  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-edge bg-surface px-4 py-3 sm:px-6">
      {showInfo && (
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-content-secondary">
              Showing <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{total}</span> results
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Go to previous page"
        >
          Previous
        </Button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(0)}
              className="px-3 py-1 rounded-lg text-sm text-content-secondary hover:bg-surface-hover"
            >
              1
            </button>
            {startPage > 2 && <span className="text-content-muted">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page - 1)}
            aria-current={displayPage === page ? 'page' : undefined}
            aria-label={`Page ${page}`}
            className={`px-3 py-1 rounded-lg text-sm ${
              displayPage === page
                ? 'bg-primary-600 text-white'
                : 'text-content-secondary hover:bg-surface-hover'
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-content-muted">...</span>}
            <button
              onClick={() => onPageChange(totalPages - 1)}
              className="px-3 py-1 rounded-lg text-sm text-content-secondary hover:bg-surface-hover"
            >
              {totalPages}
            </button>
          </>
        )}

        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage >= totalPages - 1}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Go to next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
};

// File Upload Component
export const FileUpload = ({ onFileSelect, accept = '*', label = 'Upload File' }) => {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-edge border-dashed rounded-lg cursor-pointer bg-surface-secondary hover:bg-surface-hover">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload size={32} className="mb-2 text-content-muted" />
          <p className="mb-1 text-sm text-content-muted">{label}</p>
          <p className="text-xs text-content-muted">CSV, XLS, or XLSX files</p>
        </div>
        <input type="file" className="hidden" accept={accept} onChange={handleChange} aria-label={label} />
      </label>
    </div>
  );
};

// Export ExportButton
export { default as ExportButton } from './ExportButton';

// Export DataGrid and its hook for direct use
export { DataGrid, useDataGrid } from './DataGrid';
