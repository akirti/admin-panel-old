// Pagination utility functions

export const getTotalPages = (response, pageSize) => {
  if (response.pagination?.pages) return response.pagination.pages;
  if (response.pagination?.total_count) {
    return Math.ceil(response.pagination.total_count / pageSize) || 1;
  }
  const totalRecords = response.total || response.totalCount || response.count;
  return totalRecords ? Math.ceil(totalRecords / pageSize) : 1;
};

export const getCountEvaluated = (response) => {
  return response.pagination?.count_evaluated || false;
};

export const getCurrentCount = (response) => {
  return response.pagination?.current_count || -1;
};

export const getTotalCount = (response) => {
  return response.pagination?.total_count || -1;
};

export const getEnd = (response) => {
  return response.pagination?.end || false;
};

// Date utilities

export const getCurrentDate = () => new Date().toISOString().slice(0, 10);

export const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

// Parse 'current_date' and 'current_date+N' to YYYY-MM-DD string
export const parseCurrentDateString = (val) => {
  if (!val) return '';
  const today = getCurrentDate();
  if (val === 'current_date') return today;
  const match = val.match(/^current_date([+-]\d+)$/);
  if (match) {
    const offset = parseInt(match[1], 10);
    return addDays(today, offset);
  }
  return val;
};

// Helper to convert API date string to input type="date" format (YYYY-MM-DD)
export const formatApiDateForInput = (dateStr, format) => {
  if (!dateStr) return '';
  if (format === 'YYYYMMDD' && dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return '';
};

// Format date for display (local time, YYYY-MM-DD)
export const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && date.length === 10 && date.includes('-')) return date;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format date values to YYYYMMDD for API submission
export const formatDateValue = (filter, value) => {
  const type = getAttrValue(filter.attributes, 'type');
  if ((type === 'date-picker' || type === 'date') && value && typeof value === 'string' && value.length === 10) {
    return value.replace(/-/g, '');
  }
  if (type === 'date-range' && value && typeof value === 'object') {
    const formatted = { ...value };
    if (formatted.start && formatted.start.length === 10) {
      formatted.start = formatted.start.replace(/-/g, '');
    }
    if (formatted.end && formatted.end.length === 10) {
      formatted.end = formatted.end.replace(/-/g, '');
    }
    return formatted;
  }
  return value;
};

export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Attribute helpers

export const getAttrValue = (attrs, key) =>
  attrs?.find((a) => a.key === key)?.value;

// Fill default value for a filter based on its type
export const getDefaultValue = (filter) => {
  const type = getAttrValue(filter.attributes, 'type');
  if (type === 'date-range') {
    const startRaw = getAttrValue(filter.attributes, 'defaultValue_start');
    const endRaw = getAttrValue(filter.attributes, 'defaultValue_end');
    const start = parseCurrentDateString(startRaw);
    const end = parseCurrentDateString(endRaw);
    if (start || end) return { start, end };
  } else if (type === 'date-picker' || type === 'date') {
    const defaultVal = getAttrValue(filter.attributes, 'defaultValue');
    const parsed = parseCurrentDateString(defaultVal);
    if (parsed !== undefined && parsed !== null && parsed !== '') return parsed;
  } else if (type === 'multiselect' || type === 'multi-select') {
    const defaultVal = getAttrValue(filter.attributes, 'defaultValue');
    if (typeof defaultVal === 'string' && defaultVal.trim() !== '') {
      return defaultVal.split(',').map((v) => v.trim());
    } else if (Array.isArray(defaultVal)) {
      return defaultVal;
    }
  } else {
    const defaultVal = getAttrValue(filter.attributes, 'defaultValue');
    if (defaultVal !== undefined && defaultVal !== null && defaultVal !== '') return defaultVal;
  }
  return undefined;
};

// Column extraction from data

export const getColumnsFromData = (data) => {
  if (!data || data.length === 0) return [];
  return Object.keys(data[0]).map((key) => ({ key, label: key }));
};

// Cell value formatting

export const trimCellValue = (value, maxLength = 65) => {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'string' && /[a-zA-Z]/.test(value) && value.length > maxLength) {
    return value.slice(0, maxLength) + '\u2026';
  }
  return value;
};

// Format header labels: camelCase/snake_case/kebab-case to Title Case
export const formatHeaderLabel = (label) => {
  if (!label) return '';
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Download helpers

export const downloadData = ({ data, columns, format, filename }) => {
  if (!data || data.length === 0) return;
  let content = '';
  let blobType = '';
  let fileExt = '';

  if (format === 'csv') {
    const header = columns.map((col) => `"${col.label}"`).join(',');
    const rows = data.map((row) =>
      columns.map((col) => `"${row[col.key] ?? ''}"`).join(',')
    );
    content = [header, ...rows].join('\n');
    blobType = 'text/csv';
    fileExt = 'csv';
  } else {
    content = JSON.stringify(data, null, 2);
    blobType = 'application/json';
    fileExt = 'json';
  }

  const blob = new Blob([content], { type: blobType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${fileExt}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Sorting

export const sortDates = (dateStringA, dateStringB, order) => {
  const dateA = new Date(dateStringA);
  const dateB = new Date(dateStringB);

  if (isNaN(dateA) && isNaN(dateB)) return 0;
  if (isNaN(dateA)) return order === 'asc' ? 1 : -1;
  if (isNaN(dateB)) return order === 'asc' ? -1 : 1;

  const comparison = dateA - dateB;
  return order === 'asc' ? comparison : -comparison;
};

export const isDateString = (value) => {
  return (
    typeof value === 'string' &&
    (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value))
  );
};

// Array handling for filter values

export const handleArray = (vals, filter, onChange) => {
  if (!Array.isArray(vals)) vals = [];
  vals = vals.filter((v) => v !== '');
  onChange(filter.dataKey, vals);
};

// Deep equality check for plain objects/arrays

export const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
};
