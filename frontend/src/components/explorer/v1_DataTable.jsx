import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
const isDateString = (value) =>
  typeof value === "string" &&
  (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value));

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const V1DataTable = ({
  columns = [],
  data = [],
  page = 1,
  pageSize = 10,
  pages = 1,
  totalRecords,
  onSort = () => {},
  sortBy = "",
  sortOrder = "",
  onPageChange = () => {},
  onPageSizeChange = () => {},
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

  // Close action menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuIdx(null);
      }
    };
    if (openMenuIdx !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuIdx]);

  // Apply column filters to data
  const filteredData = useMemo(() => {
    let result = Array.isArray(data) ? data : [];
    for (const [colKey, selected] of Object.entries(columnFilters)) {
      if (Array.isArray(selected) && selected.length > 0) {
        result = result.filter((row) => {
          let val = row[colKey];
          if (typeof val === "boolean") val = val ? "True" : "False";
          return selected.includes(val);
        });
      }
    }
    return result;
  }, [data, columnFilters]);

  // Compute unique values per column from full data
  const columnUniqueValues = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      const values = [];
      data.forEach((row) => {
        let val = row[col.key];
        if (typeof val === "boolean") val = val ? "True" : "False";
        if (val !== undefined && val !== null && val !== "" && !values.includes(val)) {
          values.push(val);
        }
      });
      map[col.key] = values;
    });
    return map;
  }, [columns, data]);

  const handleFilterChange = (colKey, selected) => {
    setColumnFilters((prev) => ({ ...prev, [colKey]: selected }));
  };

  const isColumnFiltered = (colKey) =>
    columnFilters[colKey] && columnFilters[colKey].length > 0;

  // Action menu toggle with portal positioning
  const toggleActionMenu = (idx) => {
    if (openMenuIdx === idx) {
      setOpenMenuIdx(null);
      setMenuPosition(null);
    } else {
      const btn = buttonRefs.current[idx];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const menuHeight = 40 * (actionGrid.length || 1);
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
        setMenuPosition({ top, left });
      }
      setOpenMenuIdx(idx);
    }
  };

  // Handle drill-down action click
  const handleActionClick = useCallback(
    (action, row) => async (e) => {
      e.preventDefault();
      setOpenMenuIdx(null);

      const encode = encodeURIComponent;
      const decode = decodeURIComponent;
      const targetDomain = action.dataDomain;
      const targetScenarioKey = action.key || action.scenerioKey;

      // Collect current row values (primitives only)
      const rowParams = Object.fromEntries(
        Object.entries(row).filter(
          ([, v]) => typeof v !== "object" && typeof v !== "function"
        )
      );

      // Build URL params from active filters + row values
      const filters =
        window.__activeFilters && typeof window.__activeFilters === "object"
          ? window.__activeFilters
          : {};

      let paramMap = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null) paramMap[k] = String(v);
      });
      Object.entries(rowParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) paramMap[k] = String(v);
      });

      // Apply filter key mappings (dataKey → inputKey)
      if (action.filters && Array.isArray(action.filters)) {
        action.filters.forEach((f) => {
          if (f.dataKey && f.inputKey && f.dataKey in paramMap) {
            paramMap[f.inputKey] = paramMap[f.dataKey];
            delete paramMap[f.dataKey];
          }
        });
      }

      paramMap.autosubmit = "true";

      const urlParams = Object.entries(paramMap)
        .map(([k, v]) => `${encode(k)}=${encode(v)}`)
        .join("&");

      const url = `/explorer/${targetDomain}/${targetScenarioKey}?${urlParams}`;
      window.open(url, "_blank");
    },
    []
  );

  // Sort icon for column header
  const getSortIcon = (colKey) => {
    if (sortBy !== colKey || !sortOrder) {
      return <ArrowUpDown size={14} className="text-content-muted" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={14} className="text-blue-600" />
    ) : (
      <ArrowDown size={14} className="text-blue-600" />
    );
  };

  return (
    <div className="mt-4">
      {filteredData.length === 0 ? (
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
                  <th
                    key={col.key}
                    className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
                      isColumnFiltered(col.key)
                        ? "bg-blue-50 text-blue-700"
                        : "text-content-secondary"
                    }`}
                    scope="col"
                    aria-sort={
                      sortBy === col.key
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <div className="flex items-center gap-1">
                      <span>{formatHeaderLabel(col.label)}</span>
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-neutral-200 focus:outline-none"
                        onClick={() => onSort(col.key)}
                        aria-label={`Sort by ${col.label}`}
                      >
                        {getSortIcon(col.key)}
                      </button>
                      <V1ColumnFilterDropdown
                        options={columnUniqueValues[col.key] || []}
                        selectedOptions={columnFilters[col.key] || []}
                        onChange={(selected) =>
                          handleFilterChange(col.key, selected)
                        }
                        columnLabel={col.label}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-light">
              {filteredData.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className={`${
                    idx % 2 === 0 ? "bg-surface" : "bg-surface-secondary/50"
                  } hover:bg-blue-50/40 transition-colors`}
                >
                  {actionGrid.length > 0 && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        ref={(el) => (buttonRefs.current[idx] = el)}
                        type="button"
                        className="p-1 rounded hover:bg-neutral-200 focus:outline-none"
                        onClick={() => toggleActionMenu(idx)}
                        aria-label="Show actions"
                      >
                        <MoreVertical size={16} className="text-content-muted" />
                      </button>
                      {openMenuIdx === idx &&
                        menuPosition &&
                        ReactDOM.createPortal(
                          <div
                            ref={menuRef}
                            className="fixed bg-surface border border-edge rounded-lg shadow-lg py-1 min-w-[160px]"
                            style={{
                              top: menuPosition.top,
                              left: menuPosition.left,
                              zIndex: 2147483647,
                            }}
                          >
                            {actionGrid.map((action, i) => (
                              <button
                                key={`${action.name || "action"}-${i}`}
                                type="button"
                                className="block w-full text-left px-4 py-2 text-sm text-content-secondary hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                onClick={handleActionClick(action, row)}
                                aria-label={action.name}
                              >
                                {action.name}
                              </button>
                            ))}
                          </div>,
                          document.body
                        )}
                    </td>
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
