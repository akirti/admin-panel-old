import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from "lucide-react";
import V1Pagination from "./v1_Pagination";
import V1ColumnFilterDropdown from "./v1_ColumnFilterDropdown";

// Utility: trim long cell values for display
const trimCellValue = (value, maxLength = 65) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (
    typeof value === "string" &&
    /[a-zA-Z]/.test(value) &&
    value.length > maxLength
  ) {
    return (
      <span title={value}>
        {value.slice(0, maxLength)}&hellip;
      </span>
    );
  }
  return value;
};

// Utility: format header label from camelCase/snake_case
const formatHeaderLabel = (label) => {
  if (!label) return "";
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Sorting helpers

// Compute portal menu position relative to a button, clamped to viewport
const computeMenuPosition = (buttonEl, itemCount) => {
  const rect = buttonEl.getBoundingClientRect();
  const menuHeight = 40 * (itemCount || 1);
  const menuWidth = 180;

  let top = rect.bottom + 4;
  let left = rect.right + 8;

  if (left + menuWidth > window.innerWidth) {
    left = rect.left - menuWidth - 8;
  }
  if (left < 0) left = 8;

  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - 4;
    if (top < 0) top = 8;
  }

  return { top, left };
};

// Helpers for building action URLs
const toPrimitiveEntries = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).filter(
    ([, v]) => v != null && typeof v !== "object" && typeof v !== "function"
  );
};

const mergeParams = (activeFilters, rowParams) => {
  const paramMap = {};
  for (const [k, v] of toPrimitiveEntries(activeFilters)) {
    paramMap[k] = String(v);
  }
  for (const [k, v] of toPrimitiveEntries(rowParams)) {
    paramMap[k] = String(v);
  }
  return paramMap;
};

const applyFilterMappings = (paramMap, filters) => {
  if (!Array.isArray(filters)) return;
  for (const f of filters) {
    if (f.dataKey && f.inputKey && f.dataKey in paramMap) {
      paramMap[f.inputKey] = paramMap[f.dataKey];
      delete paramMap[f.dataKey];
    }
  }
};

// Build the drill-down action URL from action config, row data, and active filters
const buildActionUrl = (action, row) => {
  if (!action || !row) return "#";
  const encode = encodeURIComponent;
  const activeFilters =
    window.__activeFilters && typeof window.__activeFilters === "object"
      ? window.__activeFilters
      : {};

  const paramMap = mergeParams(activeFilters, row);
  applyFilterMappings(paramMap, action.filters);
  paramMap.autosubmit = "true";

  const urlParams = Object.entries(paramMap)
    .map(([k, v]) => `${encode(k)}=${encode(v)}`)
    .join("&");

  const targetDomain = action.dataDomain || "";
  const targetScenarioKey = action.key || action.scenerioKey || "";
  return `/explorer/${targetDomain}/${targetScenarioKey}?${urlParams}`;
};

// Aria sort helper
const getAriaSort = (colKey, sortBy, sortOrder) => {
  if (sortBy !== colKey) return "none";
  return sortOrder === "asc" ? "ascending" : "descending";
};

// Sort icon helper to avoid nested ternaries
const getSortIcon = (colKey, sortBy, sortOrder) => {
  if (sortBy !== colKey || !sortOrder) return <ArrowUpDown size={14} className="text-content-muted" />;
  if (sortOrder === "asc") return <ArrowUp size={14} className="text-blue-600" />;
  return <ArrowDown size={14} className="text-blue-600" />;
};

// Sort button for column headers
const SortButton = ({ colKey, sortBy, sortOrder, label, onSort }) => {
  const icon = getSortIcon(colKey, sortBy, sortOrder);

  return (
    <button
      type="button"
      className="p-0.5 rounded hover:bg-neutral-200 focus:outline-none"
      onClick={() => onSort(colKey)}
      aria-label={`Sort by ${label}`}
    >
      {icon}
    </button>
  );
};

// Portal-based action menu
const ActionMenuPortal = ({ menuRef, menuPosition, actionGrid, row, onActionClick }) =>
  ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed bg-surface border border-edge rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 2147483647 }}
    >
      {actionGrid.map((action, i) => (
        <button
          key={`${action.name || "action"}-${i}`}
          type="button"
          className="block w-full text-left px-4 py-2 text-sm text-content-secondary hover:bg-blue-50 hover:text-blue-700 transition-colors"
          onClick={onActionClick(action, row)}
          aria-label={action.name}
        >
          {action.name}
        </button>
      ))}
    </div>,
    document.body
  );

// Action cell with menu toggle button and portal menu
const ActionCell = ({ idx, row, actionGrid, buttonRefs, openMenuIdx, menuPosition, menuRef, onToggle, onActionClick }) => (
  <td className="px-3 py-2 whitespace-nowrap">
    <button
      ref={(el) => (buttonRefs.current[idx] = el)}
      type="button"
      className="p-1 rounded hover:bg-neutral-200 focus:outline-none"
      onClick={() => onToggle(idx)}
      aria-label="Show actions"
    >
      <MoreVertical size={16} className="text-content-muted" />
    </button>
    {openMenuIdx === idx && menuPosition && (
      <ActionMenuPortal
        menuRef={menuRef}
        menuPosition={menuPosition}
        actionGrid={actionGrid}
        row={row}
        onActionClick={onActionClick}
      />
    )}
  </td>
);

// Single data row with optional action cell
const DataRow = ({ row, idx, columns, actionGrid, buttonRefs, openMenuIdx, menuPosition, menuRef, onToggle, onActionClick }) => (
  <tr
    key={row.id ?? idx}
    className={`${
      idx % 2 === 0 ? "bg-surface" : "bg-surface-secondary/50"
    } hover:bg-blue-50/40 transition-colors`}
  >
    {actionGrid.length > 0 && (
      <ActionCell
        idx={idx}
        row={row}
        actionGrid={actionGrid}
        buttonRefs={buttonRefs}
        openMenuIdx={openMenuIdx}
        menuPosition={menuPosition}
        menuRef={menuRef}
        onToggle={onToggle}
        onActionClick={onActionClick}
      />
    )}
    {columns.map((col) => (
      <td
        key={col.key}
        className="px-3 py-2 whitespace-nowrap text-content-secondary"
      >
        {trimCellValue(row[col.key])}
      </td>
    ))}
  </tr>
);

// Standalone toggle logic for the action menu
const createToggleActionMenu = (openMenuIdx, setOpenMenuIdx, setMenuPosition, buttonRefs, actionGrid) => (idx) => {
  if (openMenuIdx === idx) {
    setOpenMenuIdx(null);
    setMenuPosition(null);
  } else {
    const btn = buttonRefs.current[idx];
    if (btn) {
      setMenuPosition(computeMenuPosition(btn, actionGrid.length));
    }
    setOpenMenuIdx(idx);
  }
};

// --- Helpers for data filtering and unique values ---

const toBoolString = (val) => {
  if (val === undefined || val === null) return val;
  if (typeof val === "boolean") {
    return val ? "True" : "False";
  }
  return val;
};

const applyColumnFilters = (data, columnFilters) => {
  let result = Array.isArray(data) ? data : [];
  if (!columnFilters || typeof columnFilters !== "object") return result;
  for (const [colKey, selected] of Object.entries(columnFilters)) {
    if (!Array.isArray(selected) || selected.length === 0) continue;
    result = result.filter((row) => {
      const val = toBoolString(row[colKey]);
      return val != null && selected.includes(val);
    });
  }
  return result;
};

const buildColumnUniqueValues = (columns, data) => {
  const map = {};
  if (!Array.isArray(columns) || !Array.isArray(data)) return map;
  columns.forEach((col) => {
    const seen = new Set();
    const values = [];
    data.forEach((row) => {
      const val = toBoolString(row[col.key]);
      if (val != null && val !== "" && !seen.has(val)) {
        seen.add(val);
        values.push(val);
      }
    });
    map[col.key] = values;
  });
  return map;
};

// --- Hook: close action menu on outside click ---

const useCloseMenuOnOutsideClick = (menuRef, openMenuIdx, setOpenMenuIdx) => {
  useEffect(() => {
    if (openMenuIdx === null) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuIdx(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef, openMenuIdx, setOpenMenuIdx]);
};

// Empty state placeholder
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-content-muted">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12 mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
    <p className="text-base font-medium">No data found</p>
  </div>
);

// Column header with sort and filter controls
const ColumnHeader = ({ col, sortBy, sortOrder, onSort, isFiltered, uniqueValues, filterValues, onFilterChange }) => (
  <th
    className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
      isFiltered ? "bg-blue-50 text-blue-700" : "text-content-secondary"
    }`}
    scope="col"
    aria-sort={getAriaSort(col.key, sortBy, sortOrder)}
  >
    <div className="flex items-center gap-1">
      <span>{formatHeaderLabel(col.label)}</span>
      <SortButton colKey={col.key} sortBy={sortBy} sortOrder={sortOrder} label={col.label} onSort={onSort} />
      <V1ColumnFilterDropdown
        options={uniqueValues}
        selectedOptions={filterValues}
        onChange={(selected) => onFilterChange(col.key, selected)}
        columnLabel={col.label}
      />
    </div>
  </th>
);

const V1DataTable = ({
  columns = [],
  data = [],
  page = 1,
  pageSize = 10,
  pages = 1,
  totalRecords,
  onSort = Function.prototype,
  sortBy = "",
  sortOrder = "",
  onPageChange = Function.prototype,
  onPageSizeChange = Function.prototype,
  paginationOptions = [10, 25, 50, 100],
  onDownloadClick,
  actionGrid = [],
}) => {
  const menuRef = useRef(null);
  const buttonRefs = useRef({});

  // Column filters state
  const [columnFilters, setColumnFilters] = useState({});

  // Action menu state
  const [openMenuIdx, setOpenMenuIdx] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const totalPages = useMemo(() => Math.max(1, pages), [pages]);

  useCloseMenuOnOutsideClick(menuRef, openMenuIdx, setOpenMenuIdx);

  const filteredData = useMemo(
    () => applyColumnFilters(data, columnFilters),
    [data, columnFilters]
  );

  const columnUniqueValues = useMemo(
    () => buildColumnUniqueValues(columns, data),
    [columns, data]
  );

  const handleFilterChange = (colKey, selected) => {
    setColumnFilters((prev) => ({ ...prev, [colKey]: selected }));
  };

  const isColumnFiltered = (colKey) =>
    columnFilters[colKey] && columnFilters[colKey].length > 0;

  // Action menu toggle with portal positioning
  const toggleActionMenu = createToggleActionMenu(openMenuIdx, setOpenMenuIdx, setMenuPosition, buttonRefs, actionGrid);

  // Handle drill-down action click
  const handleActionClick = useCallback(
    (action, row) => (e) => {
      e.preventDefault();
      setOpenMenuIdx(null);
      window.open(buildActionUrl(action, row), "_blank");
    },
    []
  );

  return (
    <div className="mt-4">
      {filteredData.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-secondary border-b border-edge">
                {actionGrid.length > 0 && (
                  <th className="px-3 py-3 text-left text-xs font-semibold text-content-secondary uppercase tracking-wider whitespace-nowrap w-16">
                    Actions
                  </th>
                )}
                {columns.map((col) => (
                  <ColumnHeader
                    key={col.key}
                    col={col}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    isFiltered={isColumnFiltered(col.key)}
                    uniqueValues={columnUniqueValues[col.key] || []}
                    filterValues={columnFilters[col.key] || []}
                    onFilterChange={handleFilterChange}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-light">
              {filteredData.map((row, idx) => (
                <DataRow
                  key={row.id ?? idx}
                  row={row}
                  idx={idx}
                  columns={columns}
                  actionGrid={actionGrid}
                  buttonRefs={buttonRefs}
                  openMenuIdx={openMenuIdx}
                  menuPosition={menuPosition}
                  menuRef={menuRef}
                  onToggle={toggleActionMenu}
                  onActionClick={handleActionClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredData.length > 0 && (
        <V1Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          paginationOptions={paginationOptions}
          onDownloadClick={onDownloadClick}
        />
      )}
    </div>
  );
};

export default V1DataTable;
