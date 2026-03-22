import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { List as FixedSizeList } from 'react-window';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Check, Loader2 } from 'lucide-react';

// --- Filter condition operators ---

const TEXT_OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'like', label: 'Like (pattern)' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'between', label: 'Between' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const DATE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'between', label: 'Between' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

function getOperatorsForType(filterType) {
  if (filterType === 'number') return NUMBER_OPERATORS;
  if (filterType === 'date') return DATE_OPERATORS;
  return TEXT_OPERATORS;
}

// --- Condition evaluator ---

function evaluateCondition(cellValue, condition) {
  const { operator, value, value2 } = condition;
  if (operator === 'is_empty') return cellValue == null || String(cellValue).trim() === '';
  if (operator === 'is_not_empty') return cellValue != null && String(cellValue).trim() !== '';

  const strVal = String(cellValue ?? '').toLowerCase();
  const filterVal = String(value ?? '').toLowerCase();

  switch (operator) {
    case 'contains': return strVal.includes(filterVal);
    case 'not_contains': return !strVal.includes(filterVal);
    case 'equals': {
      const numCell = Number(cellValue);
      const numFilter = Number(value);
      if (!isNaN(numCell) && !isNaN(numFilter) && value !== '') return numCell === numFilter;
      return strVal === filterVal;
    }
    case 'not_equals': {
      const numCell = Number(cellValue);
      const numFilter = Number(value);
      if (!isNaN(numCell) && !isNaN(numFilter) && value !== '') return numCell !== numFilter;
      return strVal !== filterVal;
    }
    case 'starts_with': return strVal.startsWith(filterVal);
    case 'ends_with': return strVal.endsWith(filterVal);
    case 'like': {
      try {
        const pattern = filterVal.replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(strVal);
      } catch { return false; }
    }
    case 'gt': return Number(cellValue) > Number(value);
    case 'gte': return Number(cellValue) >= Number(value);
    case 'lt': return Number(cellValue) < Number(value);
    case 'lte': return Number(cellValue) <= Number(value);
    case 'between': return Number(cellValue) >= Number(value) && Number(cellValue) <= Number(value2);
    case 'before': return new Date(cellValue) < new Date(value);
    case 'after': return new Date(cellValue) > new Date(value);
    default: return true;
  }
}

function conditionToLabel(condition, filterType) {
  const ops = getOperatorsForType(filterType);
  const opLabel = ops.find((o) => o.value === condition.operator)?.label || condition.operator;
  if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') return opLabel;
  if (condition.operator === 'between') return `${opLabel} ${condition.value} and ${condition.value2}`;
  return `${opLabel} "${condition.value}"`;
}

// --- useDataGrid hook: manages sort + column filter state ---

export function useDataGrid(data, columns) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [columnFilters, setColumnFilters] = useState({});
  // columnFilters shape: { [key]: { type: 'values', values: [] } | { type: 'condition', conditions: [{ operator, value, value2 }], logic: 'and'|'or' } }

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  }, []);

  const setColumnFilter = useCallback((key, filterConfig) => {
    setColumnFilters((prev) => {
      if (!filterConfig) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      // Backward compat: if array passed, treat as values filter
      if (Array.isArray(filterConfig)) {
        if (filterConfig.length === 0) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: { type: 'values', values: filterConfig } };
      }
      return { ...prev, [key]: filterConfig };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setSortConfig({ key: null, direction: null });
  }, []);

  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  const getUniqueValues = useCallback((key) => {
    const col = columns.find((c) => c.key === key);
    const values = new Set();
    data.forEach((row) => {
      let val = row[key];
      if (col?.filterValue) val = col.filterValue(val, row);
      if (val !== null && val !== undefined && val !== '') {
        if (Array.isArray(val)) val.forEach((v) => values.add(String(v)));
        else values.add(String(val));
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data, columns]);

  const processedData = useMemo(() => {
    let result = [...data];

    Object.entries(columnFilters).forEach(([key, filter]) => {
      const col = columns.find((c) => c.key === key);

      if (filter.type === 'values') {
        result = result.filter((row) => {
          let val = row[key];
          if (col?.filterValue) val = col.filterValue(val, row);
          if (Array.isArray(val)) return val.some((v) => filter.values.includes(String(v)));
          return filter.values.includes(String(val ?? ''));
        });
      } else if (filter.type === 'condition') {
        result = result.filter((row) => {
          let val = row[key];
          if (col?.filterValue) val = col.filterValue(val, row);
          if (col?.sortValue) val = col.sortValue(row[key], row);
          const results = filter.conditions.map((c) => evaluateCondition(val, c));
          return filter.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
        });
      }
    });

    if (sortConfig.key && sortConfig.direction) {
      const col = columns.find((c) => c.key === sortConfig.key);
      result.sort((a, b) => {
        let aVal = col?.sortValue ? col.sortValue(a[sortConfig.key], a) : a[sortConfig.key];
        let bVal = col?.sortValue ? col.sortValue(b[sortConfig.key], b) : b[sortConfig.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, columns, columnFilters, sortConfig]);

  return { sortConfig, columnFilters, processedData, handleSort, setColumnFilter, clearAllFilters, hasActiveFilters, getUniqueValues };
}

// --- Condition Builder UI ---

function ConditionRow({ condition, index, operators, onUpdate, onRemove, showRemove }) {
  const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);
  const needsValue2 = condition.operator === 'between';
  const isDateOp = operators === DATE_OPERATORS;
  const inputType = isDateOp ? 'date' : 'text';

  return (
    <div className="flex items-center gap-2 py-1.5">
      <select
        value={condition.operator}
        onChange={(e) => onUpdate(index, { ...condition, operator: e.target.value })}
        className="text-xs border border-edge rounded px-2 py-1.5 bg-surface-input text-content min-w-[130px] focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      {needsValue && (
        <input
          type={inputType}
          value={condition.value || ''}
          onChange={(e) => onUpdate(index, { ...condition, value: e.target.value })}
          placeholder={condition.operator === 'like' ? 'e.g. %pattern%' : 'Value...'}
          className="flex-1 text-xs border border-edge rounded px-2 py-1.5 bg-surface-input text-content min-w-[80px] focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      )}
      {needsValue2 && (
        <>
          <span className="text-xs text-content-muted">and</span>
          <input
            type={inputType}
            value={condition.value2 || ''}
            onChange={(e) => onUpdate(index, { ...condition, value2: e.target.value })}
            placeholder="Max..."
            className="flex-1 text-xs border border-edge rounded px-2 py-1.5 bg-surface-input text-content min-w-[80px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </>
      )}
      {showRemove && (
        <button onClick={() => onRemove(index)} className="text-content-muted hover:text-red-600 shrink-0" aria-label="Remove condition">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function ConditionBuilder({ filterType, existingFilter, onApply, onClose }) {
  const operators = getOperatorsForType(filterType);
  const defaultCondition = { operator: operators[0].value, value: '', value2: '' };

  const [conditions, setConditions] = useState(
    existingFilter?.type === 'condition' && existingFilter.conditions.length > 0
      ? existingFilter.conditions
      : [defaultCondition]
  );
  const [logic, setLogic] = useState(existingFilter?.logic || 'and');

  const updateCondition = (index, updated) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  };

  const removeCondition = (index) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, { ...defaultCondition }]);
  };

  const handleApply = () => {
    const valid = conditions.filter((c) =>
      ['is_empty', 'is_not_empty'].includes(c.operator) || (c.value !== '' && c.value != null)
    );
    if (valid.length === 0) {
      onApply(null);
    } else {
      onApply({ type: 'condition', conditions: valid, logic });
    }
    onClose();
  };

  return (
    <div className="p-3 space-y-2">
      {conditions.map((cond, idx) => (
        <div key={idx}>
          {idx > 0 && (
            <div className="flex items-center gap-2 py-1">
              <select
                value={logic}
                onChange={(e) => setLogic(e.target.value)}
                className="text-xs border border-edge rounded px-2 py-1 bg-surface-input text-content-muted font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            </div>
          )}
          <ConditionRow
            condition={cond}
            index={idx}
            operators={operators}
            onUpdate={updateCondition}
            onRemove={removeCondition}
            showRemove={conditions.length > 1}
          />
        </div>
      ))}

      <button
        onClick={addCondition}
        className="text-xs text-primary-600 hover:underline mt-1"
      >
        + Add condition
      </button>

      {/* Like pattern help */}
      {conditions.some((c) => c.operator === 'like') && (
        <div className="text-xs text-content-muted bg-surface-secondary rounded p-2 mt-1">
          Pattern: <code className="bg-surface px-1 rounded">%</code> = any characters, <code className="bg-surface px-1 rounded">_</code> = single character.
          E.g. <code className="bg-surface px-1 rounded">%admin%</code> matches anything containing &quot;admin&quot;.
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-edge mt-2">
        <button onClick={() => { onApply(null); onClose(); }} className="text-xs text-content-muted hover:text-red-600">
          Clear Filter
        </button>
        <button
          onClick={handleApply}
          className="px-3 py-1 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
        >
          <Check size={12} /> Apply
        </button>
      </div>
    </div>
  );
}

// --- ColumnFilterDropdown: Excel-like filter popup with tabs ---

function ColumnFilterDropdown({ title, uniqueValues, selectedValues, existingFilter, filterType, onApply, onClose }) {
  const [activeTab, setActiveTab] = useState(
    existingFilter?.type === 'condition' ? 'conditions' : 'values'
  );
  const [localSelected, setLocalSelected] = useState(
    new Set(existingFilter?.type === 'values' ? existingFilter.values : (selectedValues || []))
  );
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const filteredValues = searchTerm
    ? uniqueValues.filter((v) => v.toLowerCase().includes(searchTerm.toLowerCase()))
    : uniqueValues;

  const toggleValue = (val) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };

  const handleValuesApply = () => {
    const vals = Array.from(localSelected);
    onApply(vals.length > 0 ? { type: 'values', values: vals } : null);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-1 w-80 bg-surface border border-edge rounded-lg shadow-xl z-50"
      role="dialog"
      aria-label={`Filter ${title}`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <span className="text-sm font-medium text-content">Filter: {title}</span>
        <button onClick={onClose} className="text-content-muted hover:text-content" aria-label="Close filter">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge">
        <button
          onClick={() => setActiveTab('values')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'values'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-content-muted hover:text-content'
          }`}
        >
          Values
        </button>
        <button
          onClick={() => setActiveTab('conditions')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'conditions'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-content-muted hover:text-content'
          }`}
        >
          Conditions
        </button>
      </div>

      {/* Values Tab */}
      {activeTab === 'values' && (
        <>
          {uniqueValues.length > 8 && (
            <div className="px-3 py-2 border-b border-edge">
              <input
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-edge rounded bg-surface-input text-content focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
            </div>
          )}
          <div className="px-3 py-1.5 border-b border-edge flex items-center justify-between">
            <button onClick={() => setLocalSelected(new Set(filteredValues))} className="text-xs text-primary-600 hover:underline">Select All</button>
            <span className="text-xs text-content-muted">{localSelected.size} of {filteredValues.length}</span>
            <button onClick={() => setLocalSelected(new Set())} className="text-xs text-content-muted hover:underline">Clear All</button>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredValues.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-content-muted">No values found</div>
            ) : (
              filteredValues.map((val) => (
                <label key={val} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={localSelected.has(val)}
                    onChange={() => toggleValue(val)}
                    className="rounded border-edge text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-content truncate">{val || '(empty)'}</span>
                </label>
              ))
            )}
          </div>
          <div className="px-3 py-2 border-t border-edge flex items-center justify-between gap-2">
            <button onClick={() => { onApply(null); onClose(); }} className="text-xs text-content-muted hover:text-red-600">Clear Filter</button>
            <button onClick={handleValuesApply} className="px-3 py-1 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1">
              <Check size={12} /> Apply
            </button>
          </div>
        </>
      )}

      {/* Conditions Tab */}
      {activeTab === 'conditions' && (
        <ConditionBuilder
          filterType={filterType || 'text'}
          existingFilter={existingFilter}
          onApply={onApply}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// --- Column Header ---

const ColumnHeader = memo(function ColumnHeader({ column, sortConfig, columnFilters, onSort, onFilterOpen, activeFilter, onFilterApply, onFilterClose, uniqueValues }) {
  const isSorted = sortConfig.key === column.key;
  const filterData = columnFilters[column.key];
  const isFiltered = !!filterData;
  const sortable = column.sortable !== false && column.key !== 'actions';
  const filterable = column.filterable !== false && column.key !== 'actions';

  const SortIcon = isSorted
    ? (sortConfig.direction === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <th
      scope="col"
      className="px-6 py-3 text-left relative group"
      aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-1">
        {sortable ? (
          <button
            onClick={() => onSort(column.key)}
            className="flex items-center gap-1 text-left hover:text-primary-600 transition-colors"
            aria-label={`Sort by ${column.title}`}
          >
            <span>{column.title}</span>
            <SortIcon
              size={14}
              className={`shrink-0 transition-colors ${
                isSorted ? 'text-primary-600' : 'text-content-muted opacity-0 group-hover:opacity-100'
              }`}
            />
          </button>
        ) : (
          <span>{column.title}</span>
        )}

        {filterable && (
          <button
            onClick={() => onFilterOpen(column.key)}
            className={`shrink-0 p-0.5 rounded transition-colors ${
              isFiltered
                ? 'text-primary-600 bg-primary-50'
                : 'text-content-muted opacity-0 group-hover:opacity-100 hover:text-primary-600'
            }`}
            aria-label={`Filter ${column.title}`}
            aria-expanded={activeFilter === column.key}
          >
            <Filter size={12} />
          </button>
        )}
      </div>

      {activeFilter === column.key && (
        <ColumnFilterDropdown
          columnKey={column.key}
          title={column.title}
          uniqueValues={uniqueValues}
          selectedValues={filterData?.type === 'values' ? filterData.values : []}
          existingFilter={filterData}
          filterType={column.filterType}
          onApply={(config) => onFilterApply(column.key, config)}
          onClose={onFilterClose}
        />
      )}
    </th>
  );
});

// --- Active filter chips bar ---

const ActiveFiltersBar = memo(function ActiveFiltersBar({ columns, columnFilters, onClearFilter, onClearAll }) {
  const filterEntries = Object.entries(columnFilters);
  if (filterEntries.length === 0) return null;

  return (
    <div className="px-4 py-2 bg-primary-50 border-b border-primary-100 flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-primary-700">Active filters:</span>
      {filterEntries.map(([key, filter]) => {
        const col = columns.find((c) => c.key === key);
        let label;
        if (filter.type === 'values') {
          label = filter.values.length === 1 ? filter.values[0] : `${filter.values.length} selected`;
        } else if (filter.type === 'condition') {
          const parts = filter.conditions.map((c) => conditionToLabel(c, col?.filterType || 'text'));
          label = parts.join(` ${filter.logic} `);
        }
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full max-w-xs"
          >
            <span className="font-medium">{col?.title || key}:</span>
            <span className="truncate">{label}</span>
            <button onClick={() => onClearFilter(key, null)} className="hover:text-red-600 shrink-0" aria-label={`Remove ${col?.title || key} filter`}>
              <X size={12} />
            </button>
          </span>
        );
      })}
      <button onClick={onClearAll} className="text-xs text-primary-600 hover:underline ml-auto">
        Clear all
      </button>
    </div>
  );
});

// --- VirtualizedBody: renders rows via react-window when data exceeds threshold ---

// Extracted outside VirtualizedBody so react-window gets a stable component reference
function VirtualizedRow({ index, style, data: itemData }) {
  const { rows, columns, onRowClick } = itemData;
  const row = rows[index];
  return (
    <div
      style={style}
      className={`flex items-center border-b border-edge ${onRowClick ? 'cursor-pointer hover:bg-surface-hover' : 'hover:bg-surface-hover'} transition-colors`}
      onClick={() => onRowClick && onRowClick(row)}
      role="row"
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className="px-6 py-3 text-sm text-content flex-shrink-0"
          style={{ width: column.width || 'auto', minWidth: column.minWidth || 120 }}
        >
          {column.render ? column.render(row[column.key], row) : row[column.key]}
        </div>
      ))}
    </div>
  );
}

function VirtualizedBody({ data, columns, rowHeight = 52, maxHeight = 600, onRowClick }) {
  const itemData = useMemo(() => ({ rows: data, columns, onRowClick }), [data, columns, onRowClick]);

  return (
    <FixedSizeList
      height={Math.min(data.length * rowHeight, maxHeight)}
      itemCount={data.length}
      itemSize={rowHeight}
      width="100%"
      itemData={itemData}
    >
      {VirtualizedRow}
    </FixedSizeList>
  );
}

// --- DataGrid: full table with sort + filter ---

export const DataGrid = ({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  sortable = true,
  filterable = true,
  virtualize = true,
}) => {
  const [activeFilter, setActiveFilter] = useState(null);

  const gridColumns = useMemo(
    () =>
      columns.map((col) => ({
        ...col,
        sortable: sortable && col.sortable !== false && col.key !== 'actions',
        filterable: filterable && col.filterable !== false && col.key !== 'actions',
      })),
    [columns, sortable, filterable]
  );

  const grid = useDataGrid(data, gridColumns);

  const shouldVirtualize = virtualize && grid.processedData.length > 100;

  const handleFilterOpen = useCallback((key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const handleFilterClose = useCallback(() => setActiveFilter(null), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 size={32} className="animate-spin text-primary-600" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      <ActiveFiltersBar
        columns={gridColumns}
        columnFilters={grid.columnFilters}
        onClearFilter={grid.setColumnFilter}
        onClearAll={grid.clearAllFilters}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-edge">
          <thead>
            <tr className="table-header">
              {gridColumns.map((column) => (
                <ColumnHeader
                  key={column.key}
                  column={column}
                  sortConfig={grid.sortConfig}
                  columnFilters={grid.columnFilters}
                  onSort={grid.handleSort}
                  onFilterOpen={handleFilterOpen}
                  activeFilter={activeFilter}
                  onFilterApply={grid.setColumnFilter}
                  onFilterClose={handleFilterClose}
                  uniqueValues={activeFilter === column.key ? grid.getUniqueValues(column.key) : []}
                />
              ))}
            </tr>
          </thead>
          {shouldVirtualize ? (
            <tbody className="bg-surface">
              <tr>
                <td colSpan={gridColumns.length} className="p-0">
                  <VirtualizedBody data={grid.processedData} columns={gridColumns} onRowClick={onRowClick} />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="bg-surface divide-y divide-edge">
              {grid.processedData.length === 0 ? (
                <tr>
                  <td colSpan={gridColumns.length} className="px-6 py-12 text-center text-content-muted" role="status">
                    {data.length > 0 ? 'No results match the current filters' : emptyMessage}
                  </td>
                </tr>
              ) : (
                grid.processedData.map((row, index) => (
                  <tr
                    key={row._id || row.id || index}
                    className={`${onRowClick ? 'cursor-pointer hover:bg-surface-hover' : 'hover:bg-surface-hover'} transition-colors`}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {gridColumns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-content">
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>
      </div>

      {grid.hasActiveFilters && data.length > 0 && (
        <div className="px-4 py-2 border-t border-edge text-xs text-content-muted">
          Showing {grid.processedData.length} of {data.length} records
        </div>
      )}
    </div>
  );
};

export default DataGrid;
