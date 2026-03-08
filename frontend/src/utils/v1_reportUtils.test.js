import {
  getTotalPages,
  getCountEvaluated,
  getCurrentCount,
  getTotalCount,
  getEnd,
  getCurrentDate,
  addDays,
  parseCurrentDateString,
  formatApiDateForInput,
  formatDate,
  formatDateValue,
  dateRegex,
  getAttrValue,
  getDefaultValue,
  getColumnsFromData,
  trimCellValue,
  formatHeaderLabel,
  downloadData,
  sortDates,
  isDateString,
  handleArray,
  deepEqual,
} from './v1_reportUtils';

// ── Pagination helpers ──────────────────────────────────────────────────────

describe('getTotalPages', () => {
  it('returns pages from pagination.pages when present', () => {
    expect(getTotalPages({ pagination: { pages: 5 } }, 10)).toBe(5);
  });

  it('calculates pages from pagination.total_count', () => {
    expect(getTotalPages({ pagination: { total_count: 25 } }, 10)).toBe(3);
    expect(getTotalPages({ pagination: { total_count: 20 } }, 10)).toBe(2);
  });

  it('falls back to response.total', () => {
    expect(getTotalPages({ total: 30 }, 10)).toBe(3);
  });

  it('falls back to response.totalCount', () => {
    expect(getTotalPages({ totalCount: 15 }, 10)).toBe(2);
  });

  it('falls back to response.count', () => {
    expect(getTotalPages({ count: 7 }, 5)).toBe(2);
  });

  it('returns 1 when no total information is available', () => {
    expect(getTotalPages({}, 10)).toBe(1);
  });

  it('returns 1 for zero total_count', () => {
    expect(getTotalPages({ pagination: { total_count: 0 } }, 10)).toBe(1);
  });
});

describe('getCountEvaluated', () => {
  it('returns count_evaluated when present', () => {
    expect(getCountEvaluated({ pagination: { count_evaluated: true } })).toBe(true);
  });

  it('returns false when missing', () => {
    expect(getCountEvaluated({})).toBe(false);
    expect(getCountEvaluated({ pagination: {} })).toBe(false);
  });
});

describe('getCurrentCount', () => {
  it('returns current_count when present', () => {
    expect(getCurrentCount({ pagination: { current_count: 42 } })).toBe(42);
  });

  it('returns -1 when missing', () => {
    expect(getCurrentCount({})).toBe(-1);
    expect(getCurrentCount({ pagination: {} })).toBe(-1);
  });
});

describe('getTotalCount', () => {
  it('returns total_count when present', () => {
    expect(getTotalCount({ pagination: { total_count: 100 } })).toBe(100);
  });

  it('returns -1 when missing', () => {
    expect(getTotalCount({})).toBe(-1);
  });
});

describe('getEnd', () => {
  it('returns end flag when present', () => {
    expect(getEnd({ pagination: { end: true } })).toBe(true);
  });

  it('returns false when missing', () => {
    expect(getEnd({})).toBe(false);
    expect(getEnd({ pagination: {} })).toBe(false);
  });
});

// ── Date utilities ──────────────────────────────────────────────────────────

describe('getCurrentDate', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const result = getCurrentDate();
    expect(result).toMatch(dateRegex);
    // Verify it is actually today
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(today);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-01', 5)).toBe('2024-01-06');
  });

  it('subtracts when days is negative', () => {
    expect(addDays('2024-01-10', -3)).toBe('2024-01-07');
  });

  it('handles month rollover', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
  });

  it('handles year rollover', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });

  it('handles zero days', () => {
    expect(addDays('2024-06-15', 0)).toBe('2024-06-15');
  });
});

describe('parseCurrentDateString', () => {
  it('returns empty string for falsy input', () => {
    expect(parseCurrentDateString('')).toBe('');
    expect(parseCurrentDateString(null)).toBe('');
    expect(parseCurrentDateString(undefined)).toBe('');
  });

  it('returns today for "current_date"', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(parseCurrentDateString('current_date')).toBe(today);
  });

  it('adds days for "current_date+N"', () => {
    const today = new Date().toISOString().slice(0, 10);
    const expected = addDays(today, 7);
    expect(parseCurrentDateString('current_date+7')).toBe(expected);
  });

  it('subtracts days for "current_date-N"', () => {
    const today = new Date().toISOString().slice(0, 10);
    const expected = addDays(today, -3);
    expect(parseCurrentDateString('current_date-3')).toBe(expected);
  });

  it('returns the value as-is for non-matching strings', () => {
    expect(parseCurrentDateString('2024-01-01')).toBe('2024-01-01');
    expect(parseCurrentDateString('some_string')).toBe('some_string');
  });
});

describe('formatApiDateForInput', () => {
  it('returns empty string for falsy dateStr', () => {
    expect(formatApiDateForInput('', 'YYYYMMDD')).toBe('');
    expect(formatApiDateForInput(null, 'YYYYMMDD')).toBe('');
    expect(formatApiDateForInput(undefined, 'YYYYMMDD')).toBe('');
  });

  it('converts YYYYMMDD to YYYY-MM-DD', () => {
    expect(formatApiDateForInput('20240115', 'YYYYMMDD')).toBe('2024-01-15');
  });

  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(formatApiDateForInput('01/15/2024', 'MM/DD/YYYY')).toBe('2024-01-15');
  });

  it('converts MM-DD-YYYY to YYYY-MM-DD', () => {
    expect(formatApiDateForInput('1-5-2024', 'MM-DD-YYYY')).toBe('2024-01-05');
  });

  it('pads single-digit month/day in MM/DD/YYYY format', () => {
    expect(formatApiDateForInput('3/5/2024', 'MM/DD/YYYY')).toBe('2024-03-05');
  });

  it('falls back to Date parsing for unknown format', () => {
    expect(formatApiDateForInput('2024-01-15T00:00:00Z', 'unknown')).toBe('2024-01-15');
  });

  it('returns empty string for unparseable date', () => {
    expect(formatApiDateForInput('not-a-date', 'unknown')).toBe('');
  });
});

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('returns YYYY-MM-DD string as-is', () => {
    expect(formatDate('2024-01-15')).toBe('2024-01-15');
  });

  it('formats a Date object', () => {
    const d = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(d)).toBe('2024-01-15');
  });

  it('formats a timestamp', () => {
    const ts = new Date(2024, 5, 3).getTime(); // Jun 3, 2024
    expect(formatDate(ts)).toBe('2024-06-03');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2024, 2, 5); // Mar 5, 2024
    expect(formatDate(d)).toBe('2024-03-05');
  });
});

describe('formatDateValue', () => {
  const makeDateFilter = (type) => ({
    attributes: [{ key: 'type', value: type }],
  });

  it('strips dashes for date-picker type', () => {
    expect(formatDateValue(makeDateFilter('date-picker'), '2024-01-15')).toBe('20240115');
  });

  it('strips dashes for date type', () => {
    expect(formatDateValue(makeDateFilter('date'), '2024-06-03')).toBe('20240603');
  });

  it('formats date-range start and end', () => {
    const filter = makeDateFilter('date-range');
    const result = formatDateValue(filter, { start: '2024-01-01', end: '2024-12-31' });
    expect(result).toEqual({ start: '20240101', end: '20241231' });
  });

  it('returns non-date values unchanged', () => {
    const filter = makeDateFilter('text');
    expect(formatDateValue(filter, 'hello')).toBe('hello');
  });

  it('returns value as-is if date string is wrong length', () => {
    expect(formatDateValue(makeDateFilter('date-picker'), '2024')).toBe('2024');
  });

  it('handles date-range with missing start/end', () => {
    const filter = makeDateFilter('date-range');
    const result = formatDateValue(filter, { start: '2024-01-01' });
    expect(result).toEqual({ start: '20240101' });
  });
});

describe('dateRegex', () => {
  it('matches YYYY-MM-DD', () => {
    expect(dateRegex.test('2024-01-15')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(dateRegex.test('01/15/2024')).toBe(false);
    expect(dateRegex.test('20240115')).toBe(false);
    expect(dateRegex.test('2024-1-5')).toBe(false);
  });
});

// ── Attribute helpers ───────────────────────────────────────────────────────

describe('getAttrValue', () => {
  const attrs = [
    { key: 'type', value: 'date' },
    { key: 'label', value: 'Start Date' },
  ];

  it('finds value by key', () => {
    expect(getAttrValue(attrs, 'type')).toBe('date');
    expect(getAttrValue(attrs, 'label')).toBe('Start Date');
  });

  it('returns undefined for missing key', () => {
    expect(getAttrValue(attrs, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for null/undefined attrs', () => {
    expect(getAttrValue(null, 'type')).toBeUndefined();
    expect(getAttrValue(undefined, 'type')).toBeUndefined();
  });
});

describe('getDefaultValue', () => {
  it('returns undefined when no defaultValue attribute', () => {
    const filter = { attributes: [{ key: 'type', value: 'text' }] };
    expect(getDefaultValue(filter)).toBeUndefined();
  });

  it('returns defaultValue for text type', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'text' },
        { key: 'defaultValue', value: 'hello' },
      ],
    };
    expect(getDefaultValue(filter)).toBe('hello');
  });

  it('parses date-picker defaultValue with current_date', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'date-picker' },
        { key: 'defaultValue', value: 'current_date' },
      ],
    };
    const today = new Date().toISOString().slice(0, 10);
    expect(getDefaultValue(filter)).toBe(today);
  });

  it('returns date-range defaults', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'date-range' },
        { key: 'defaultValue_start', value: 'current_date-7' },
        { key: 'defaultValue_end', value: 'current_date' },
      ],
    };
    const today = new Date().toISOString().slice(0, 10);
    const result = getDefaultValue(filter);
    expect(result.end).toBe(today);
    expect(result.start).toBe(addDays(today, -7));
  });

  it('returns undefined for date-range with no start/end defaults', () => {
    const filter = {
      attributes: [{ key: 'type', value: 'date-range' }],
    };
    expect(getDefaultValue(filter)).toBeUndefined();
  });

  it('splits comma-separated string for multiselect', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'multiselect' },
        { key: 'defaultValue', value: 'a, b, c' },
      ],
    };
    expect(getDefaultValue(filter)).toEqual(['a', 'b', 'c']);
  });

  it('returns array defaultValue as-is for multi-select', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'multi-select' },
        { key: 'defaultValue', value: ['x', 'y'] },
      ],
    };
    expect(getDefaultValue(filter)).toEqual(['x', 'y']);
  });

  it('returns undefined for empty string defaultValue on text', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'text' },
        { key: 'defaultValue', value: '' },
      ],
    };
    expect(getDefaultValue(filter)).toBeUndefined();
  });

  it('returns undefined for date-picker with empty defaultValue', () => {
    const filter = {
      attributes: [
        { key: 'type', value: 'date-picker' },
        { key: 'defaultValue', value: '' },
      ],
    };
    expect(getDefaultValue(filter)).toBeUndefined();
  });
});

// ── Column extraction ───────────────────────────────────────────────────────

describe('getColumnsFromData', () => {
  it('extracts column keys from the first row', () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    expect(getColumnsFromData(data)).toEqual([
      { key: 'name', label: 'name' },
      { key: 'age', label: 'age' },
    ]);
  });

  it('returns empty array for empty data', () => {
    expect(getColumnsFromData([])).toEqual([]);
  });

  it('returns empty array for null/undefined data', () => {
    expect(getColumnsFromData(null)).toEqual([]);
    expect(getColumnsFromData(undefined)).toEqual([]);
  });
});

// ── Cell value formatting ───────────────────────────────────────────────────

describe('trimCellValue', () => {
  it('returns "True" for boolean true', () => {
    expect(trimCellValue(true)).toBe('True');
  });

  it('returns "False" for boolean false', () => {
    expect(trimCellValue(false)).toBe('False');
  });

  it('truncates long strings with letters', () => {
    const longStr = 'a'.repeat(100);
    const result = trimCellValue(longStr, 65);
    expect(result).toHaveLength(66); // 65 chars + ellipsis
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('does not truncate short strings', () => {
    expect(trimCellValue('short string')).toBe('short string');
  });

  it('does not truncate numeric-only strings even if long', () => {
    const numStr = '1'.repeat(100);
    expect(trimCellValue(numStr)).toBe(numStr);
  });

  it('uses custom maxLength', () => {
    const result = trimCellValue('abcdefghij', 5);
    expect(result).toBe('abcde\u2026');
  });

  it('returns non-string values as-is', () => {
    expect(trimCellValue(42)).toBe(42);
    expect(trimCellValue(null)).toBe(null);
  });
});

// ── Header formatting ───────────────────────────────────────────────────────

describe('formatHeaderLabel', () => {
  it('converts camelCase to Title Case', () => {
    expect(formatHeaderLabel('firstName')).toBe('First Name');
  });

  it('converts snake_case - capitalizes first letter only', () => {
    expect(formatHeaderLabel('first_name')).toBe('First name');
  });

  it('converts kebab-case - capitalizes first letter only', () => {
    expect(formatHeaderLabel('first-name')).toBe('First name');
  });

  it('handles single word', () => {
    expect(formatHeaderLabel('name')).toBe('Name');
  });

  it('returns empty string for falsy input', () => {
    expect(formatHeaderLabel('')).toBe('');
    expect(formatHeaderLabel(null)).toBe('');
    expect(formatHeaderLabel(undefined)).toBe('');
  });

  it('handles mixed case with underscores', () => {
    expect(formatHeaderLabel('myFirstName_last')).toBe('My First Name last');
  });
});

// ── Download helpers ────────────────────────────────────────────────────────

describe('downloadData', () => {
  let createElementSpy;
  let appendChildSpy;
  let removeChildSpy;
  let createObjectURLSpy;
  let revokeObjectURLSpy;
  let clickSpy;

  beforeEach(() => {
    clickSpy = jest.fn();
    createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    });
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    createObjectURLSpy = jest.fn(() => 'blob:mock-url');
    revokeObjectURLSpy = jest.fn();
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when data is empty', () => {
    downloadData({ data: [], columns: [], format: 'csv', filename: 'test' });
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('does nothing when data is null', () => {
    downloadData({ data: null, columns: [], format: 'csv', filename: 'test' });
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('downloads CSV', () => {
    const data = [{ name: 'Alice', age: 30 }];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ];
    downloadData({ data, columns, format: 'csv', filename: 'export' });

    expect(createObjectURLSpy).toHaveBeenCalled();
    const blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloads JSON', () => {
    const data = [{ name: 'Alice' }];
    const columns = [{ key: 'name', label: 'Name' }];
    downloadData({ data, columns, format: 'json', filename: 'export' });

    const blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob.type).toBe('application/json');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('handles missing cell values in CSV with empty string', () => {
    const data = [{ name: 'Alice' }];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
    ];
    downloadData({ data, columns, format: 'csv', filename: 'test' });
    // Should not throw; missing key uses ?? ''
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ── Sorting ─────────────────────────────────────────────────────────────────

describe('sortDates', () => {
  it('sorts ascending', () => {
    expect(sortDates('2024-01-01', '2024-01-02', 'asc')).toBeLessThan(0);
  });

  it('sorts descending', () => {
    expect(sortDates('2024-01-01', '2024-01-02', 'desc')).toBeGreaterThan(0);
  });

  it('returns 0 for equal dates', () => {
    expect(sortDates('2024-01-01', '2024-01-01', 'asc')).toBe(0);
  });

  it('pushes invalid dateA to end in ascending order', () => {
    expect(sortDates('invalid', '2024-01-01', 'asc')).toBe(1);
  });

  it('pushes invalid dateB to end in ascending order', () => {
    expect(sortDates('2024-01-01', 'invalid', 'asc')).toBe(-1);
  });

  it('returns 0 when both invalid', () => {
    expect(sortDates('invalid', 'also-invalid', 'asc')).toBe(0);
  });

  it('pushes invalid dateA to end in descending order', () => {
    expect(sortDates('invalid', '2024-01-01', 'desc')).toBe(-1);
  });
});

describe('isDateString', () => {
  it('recognizes YYYY-MM-DD', () => {
    expect(isDateString('2024-01-15')).toBe(true);
  });

  it('recognizes MM/DD/YYYY', () => {
    expect(isDateString('01/15/2024')).toBe(true);
  });

  it('rejects non-date strings', () => {
    expect(isDateString('hello')).toBe(false);
    expect(isDateString('20240115')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isDateString(12345)).toBe(false);
    expect(isDateString(null)).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });
});

// ── Array handling ──────────────────────────────────────────────────────────

describe('handleArray', () => {
  it('filters out empty strings and calls onChange', () => {
    const onChange = jest.fn();
    const filter = { dataKey: 'colors' };
    handleArray(['red', '', 'blue'], filter, onChange);
    expect(onChange).toHaveBeenCalledWith('colors', ['red', 'blue']);
  });

  it('converts non-array to empty array', () => {
    const onChange = jest.fn();
    const filter = { dataKey: 'items' };
    handleArray(null, filter, onChange);
    expect(onChange).toHaveBeenCalledWith('items', []);
  });

  it('handles all-empty array', () => {
    const onChange = jest.fn();
    const filter = { dataKey: 'items' };
    handleArray(['', '', ''], filter, onChange);
    expect(onChange).toHaveBeenCalledWith('items', []);
  });

  it('passes through array with no empty values', () => {
    const onChange = jest.fn();
    const filter = { dataKey: 'tags' };
    handleArray(['a', 'b'], filter, onChange);
    expect(onChange).toHaveBeenCalledWith('tags', ['a', 'b']);
  });
});

// ── Deep equality ───────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
  });

  it('returns false for different types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });

  it('returns true for equal arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false for arrays with different length', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false for arrays with different values', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('returns true for equal nested objects', () => {
    const a = { x: { y: [1, 2] }, z: 'hi' };
    const b = { x: { y: [1, 2] }, z: 'hi' };
    expect(deepEqual(a, b)).toBe(true);
  });

  it('returns false for objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('returns false for objects with different key count', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('returns false when comparing null with object', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  it('returns true for both null (same reference)', () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  it('handles deeply nested structures', () => {
    const a = { a: { b: { c: { d: [1, { e: 2 }] } } } };
    const b = { a: { b: { c: { d: [1, { e: 2 }] } } } };
    expect(deepEqual(a, b)).toBe(true);
  });

  it('detects difference in deeply nested structures', () => {
    const a = { a: { b: { c: { d: [1, { e: 2 }] } } } };
    const b = { a: { b: { c: { d: [1, { e: 3 }] } } } };
    expect(deepEqual(a, b)).toBe(false);
  });
});
