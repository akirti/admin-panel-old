import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { ChevronDown, ChevronUp, Filter, RotateCcw, Users, Info, X } from 'lucide-react';
import V1DescriptionRenderer from './v1_DescriptionRenderer';
import V1DynamicFilterControl from './v1_DynamicFilterControl';
import useAssignedCustomers from '../../hooks/useAssignedCustomers';
import {
  getAttrValue,
  parseCurrentDateString,
  getDefaultValue,
  formatDateValue,
  deepEqual,
  trimCellValue,
} from '../../utils/v1_reportUtils';
import { validateFilter } from '../../utils/v1_filterValidators';

const CUSTOMER_DATAKEY_PATTERN = /^(query_)?customer[s_]?/i;
const CUSTOMER_DISPLAY_PATTERN = /customer\s*[#\d]/i;

const isCustomerFilter = (filter) => {
  if (CUSTOMER_DATAKEY_PATTERN.test(filter.dataKey)) return true;
  const display = filter.displayName || '';
  return CUSTOMER_DISPLAY_PATTERN.test(display);
};

const hasNonEmptyValue = (val) => val !== undefined && val !== null && val !== '';

const DATE_RANGE_DEFAULT = (filter) => {
  const startRaw = getAttrValue(filter.attributes, 'defaultValue_start');
  const endRaw = getAttrValue(filter.attributes, 'defaultValue_end');
  const start = parseCurrentDateString(startRaw);
  const end = parseCurrentDateString(endRaw);
  return (start || end) ? { start, end } : undefined;
};

const DATE_DEFAULT = (filter) => {
  const raw = getAttrValue(filter.attributes, 'defaultValue');
  const val = parseCurrentDateString(raw);
  return hasNonEmptyValue(val) ? val : undefined;
};

const MULTISELECT_DEFAULT = (filter) => {
  const defaultVal = getAttrValue(filter.attributes, 'defaultValue');
  if (typeof defaultVal === 'string' && defaultVal.trim() !== '') {
    return defaultVal.split(',').map((v) => v.trim());
  }
  return Array.isArray(defaultVal) ? defaultVal : undefined;
};

const RADIO_DEFAULT = (filter) => {
  const val = getAttrValue(filter.attributes, 'defaultValue');
  return hasNonEmptyValue(val) ? val : undefined;
};

const TOGGLE_DEFAULT = (filter) => {
  const val = getAttrValue(filter.attributes, 'defaultValue');
  return (val === true || val === false) ? val : undefined;
};

const GENERIC_DEFAULT = (filter) => {
  const val = getAttrValue(filter.attributes, 'defaultValue');
  return hasNonEmptyValue(val) ? val : undefined;
};

const DEFAULT_RESOLVERS = {
  'date-range': DATE_RANGE_DEFAULT,
  'date-picker': DATE_DEFAULT,
  'date': DATE_DEFAULT,
  'multiselect': MULTISELECT_DEFAULT,
  'multi-select': MULTISELECT_DEFAULT,
  'radioButton': RADIO_DEFAULT,
  'toggleButton': TOGGLE_DEFAULT,
};

/**
 * Returns the default form value for a single filter config object.
 * If `initialValues` is provided and contains a value for the filter's dataKey,
 * that value is returned. Otherwise, the default is derived from filter attributes
 * based on the filter type.
 *
 * Returns `undefined` when no default value should be set.
 */
const getFilterDefaultValue = (filter, initialValues) => {
  if (initialValues && initialValues[filter.dataKey] !== undefined) {
    return initialValues[filter.dataKey];
  }
  const type = getAttrValue(filter.attributes, 'type');
  const resolver = DEFAULT_RESOLVERS[type] || GENERIC_DEFAULT;
  return resolver(filter);
};

/**
 * Takes an array of `{ msg, displayName }` error entries and returns
 * a formatted error string. Messages are grouped by identical text,
 * and display names are joined with natural-language conjunctions.
 *
 * Returns a fallback message when the array is empty.
 */
const formatErrorMessages = (errorMessages) => {
  if (errorMessages.length === 0) {
    return 'Please select all filters before submitting';
  }

  const msgMap = {};
  errorMessages.forEach(({ msg, displayName }) => {
    if (!msgMap[msg]) msgMap[msg] = [];
    msgMap[msg].push(displayName);
  });

  const formattedMsgs = Object.entries(msgMap).map(([msg, names]) => {
    let cleanMsg = msg.replace(/\s*\([^)]*\)\s*$/, '').replace(/\.$/, '');
    const alreadyHasDisplayName = names.some((name) =>
      cleanMsg.includes(name)
    );
    if (!alreadyHasDisplayName) {
      let displayStr = '';
      if (names.length === 1) {
        displayStr = `${names[0]}`;
      } else if (names.length === 2) {
        displayStr = `${names[0]} and ${names[1]}`;
      } else {
        displayStr = `${names.slice(0, -1).join(', ')}, and ${
          names[names.length - 1]
        }`;
      }
      return `${cleanMsg} in ${displayStr}.`;
    } else {
      return `${cleanMsg}.`;
    }
  });

  return formattedMsgs.join('\n');
};

/**
 * Returns the placeholder string for a filter's dynamic control.
 * Only input-type filters with no (or empty) defaultValue get a placeholder;
 * all other filter types return `undefined`.
 */
const getFilterPlaceholder = (filter) => {
  const type = filter.attributes?.find(
    (attr) => attr.key === 'type'
  )?.value;
  const defaultValue = filter.attributes?.find(
    (attr) => attr.key === 'defaultValue'
  )?.value;
  if (type === 'input' && (!defaultValue || defaultValue === '')) {
    return filter.inputHint || 'Enter value';
  }
  return undefined;
};

/**
 * Filter label with optional info tooltip.
 * Shows an info icon when filter.description exists; clicking it
 * opens/closes an inline popover that renders the description HTML.
 */
const FilterLabel = ({ filter }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const hasDescription =
    filter.description &&
    ((Array.isArray(filter.description) &&
      filter.description.some((d) => d.status !== 'I' && (d.text || d.nodes))) ||
      (typeof filter.description === 'string' && filter.description.trim()));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="flex items-center gap-1.5 mb-1.5" ref={ref}>
      <label className="text-sm font-medium text-content-secondary">
        {trimCellValue(filter.displayName)}
      </label>
      {hasDescription && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="text-content-muted hover:text-primary-500 transition-colors focus:outline-none"
            title="View filter info"
          >
            <Info size={14} />
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-surface border border-edge rounded-lg shadow-lg p-3 text-sm text-content-secondary">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">Info</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-content-muted hover:text-content-secondary"
                >
                  <X size={12} />
                </button>
              </div>
              <V1DescriptionRenderer description={filter.description} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const runValidation = (filterConfig, filledForm) => {
  const errorMessages = [];
  for (const filter of filterConfig) {
    const val = filledForm[filter.dataKey];
    const result = validateFilter(filter, val);
    if (!result.valid) {
      const msg = (result.message || 'Invalid input.').replace(/\s*\([^)]*\)\s*$/, '');
      const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
      errorMessages.push({ msg, displayName });
    }
  }
  return errorMessages;
};

const buildSubmitForm = (form, filterConfig) => {
  const filledForm = { ...form };
  filterConfig.forEach((filter) => {
    const val = filledForm[filter.dataKey];
    if (val === undefined || val === null || val === '') {
      filledForm[filter.dataKey] = getDefaultValue(filter);
    }
    filledForm[filter.dataKey] = formatDateValue(filter, filledForm[filter.dataKey]);
  });
  return filledForm;
};

// Customer preference toggle button (shown when customer filters exist)
const CustomerToggleButton = ({ useCustomerSuggest, onToggle }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
      useCustomerSuggest
        ? 'bg-primary-50 border-primary-300 text-primary-700'
        : 'bg-surface-secondary border-edge text-content-muted'
    }`}
  >
    <Users className="w-3.5 h-3.5" />
    {useCustomerSuggest ? 'Assigned Customers' : 'No Preference'}
  </button>
);

// Accordion header with filter icon, title, optional customer toggle, and chevron
const AccordionHeader = ({ show, onToggle, hasCustomerFilter, customerHasAssigned, useCustomerSuggest, onCustomerToggle }) => (
  <div
    className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-surface-hover transition-colors border-b border-edge-light"
    onClick={onToggle}
  >
    <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-content-muted" />
      <h5 className="text-sm font-semibold text-content m-0">
        Filters
      </h5>
    </div>
    <div className="flex items-center gap-3">
      {hasCustomerFilter && customerHasAssigned && (
        <CustomerToggleButton
          useCustomerSuggest={useCustomerSuggest}
          onToggle={onCustomerToggle}
        />
      )}
      <div className="text-content-muted">
        {show ? (
          <ChevronUp size={20} />
        ) : (
          <ChevronDown size={20} />
        )}
      </div>
    </div>
  </div>
);

// --- Helpers to reduce cognitive complexity in V1FilterSection ---

const isFilterRenderable = (filter) =>
  (filter.visible === undefined || filter.visible === true) &&
  (filter.status === 'Y' || filter.status === undefined);

const buildInitialForm = (filterConfig, initialFilterValues) => {
  const initialForm = {};
  filterConfig.forEach((filter) => {
    const val = getFilterDefaultValue(filter, initialFilterValues);
    if (val !== undefined) {
      initialForm[filter.dataKey] = val;
    }
  });
  return initialForm;
};

const buildResetForm = (filterConfig) => buildInitialForm(filterConfig, null);

const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const FilterAccordionBody = ({
  externalLoading,
  filterError,
  filterConfig,
  rows,
  form,
  errorMsg,
  handleChange,
  handleReset,
  handleSubmit,
  customerData,
  useCustomerSuggest,
}) => {
  if (externalLoading) {
    return (
      <div className="flex justify-center items-center min-h-[120px]">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (filterError) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {filterError}
        </div>
      </div>
    );
  }
  if (filterConfig.length === 0) {
    return (
      <div className="text-center py-8 text-content-muted text-sm">
        No filters available.
      </div>
    );
  }
  return (
    <>
      {rows.map((row, idx) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mb-4 w-full" key={idx}>
          {row.map((filter) => (
            <div className="flex flex-col w-full" key={filter.dataKey}>
              <FilterLabel filter={filter} />
              <V1DynamicFilterControl
                filter={filter}
                value={form[filter.dataKey]}
                onChange={handleChange}
                allFilters={filterConfig}
                form={form}
                placeholder={getFilterPlaceholder(filter)}
                customerData={customerData}
                useCustomerSuggest={useCustomerSuggest}
              />
            </div>
          ))}
        </div>
      ))}
      {errorMsg && (
        <div className="flex justify-center w-full mt-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm whitespace-pre-line max-w-lg text-center">
            {errorMsg}
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-3 mt-5">
        <button type="button" onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-edge rounded-md hover:bg-surface-hover hover:text-content transition-colors shadow-sm">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button onClick={handleSubmit} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" disabled={externalLoading}>
          Submit
        </button>
      </div>
    </>
  );
};

const V1FilterSection = ({
  onSubmit,
  filterConfig = [],
  filterLoading: externalLoading = false,
  filterError = '',
  initialFilterValues = {},
  autoSubmit = false,
}) => {
  const prevInitialValues = useRef(initialFilterValues);

  // State management
  const [show, setShow] = useState(true);
  const [form, setForm] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [useCustomerSuggest, setUseCustomerSuggest] = useState(true);

  // Customer autocomplete hook
  const customerData = useAssignedCustomers();

  // Detect if any filter has a customer-type dataKey
  const hasCustomerFilter = useMemo(() => {
    return filterConfig.some((f) => isCustomerFilter(f));
  }, [filterConfig]);

  // Reset autoSubmitted if initialFilterValues changed (deep compare)
  useEffect(() => {
    if (!deepEqual(prevInitialValues.current, initialFilterValues)) {
      setAutoSubmitted(false);
      prevInitialValues.current = initialFilterValues;
    }
  }, [initialFilterValues]);

  useEffect(() => {
    if (autoSubmit && Object.keys(form).length > 0 && !autoSubmitted) {
      setAutoSubmitted(true);
      handleSubmit();
    }
  }, [autoSubmit, form, autoSubmitted]);

  useEffect(() => { window.__activeFilters = form; }, [form]);

  // Initialize form from filterConfig and initialFilterValues
  useEffect(() => {
    if (!filterConfig?.length) return;
    const initialForm = buildInitialForm(filterConfig, initialFilterValues);
    setForm((prev) => ({ ...initialForm, ...prev }));
  }, [filterConfig, initialFilterValues]);

  const handleChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMsg('');
  }, []);

  const handleReset = useCallback(() => {
    setForm(buildResetForm(filterConfig));
    setErrorMsg('');
  }, [filterConfig]);

  const handleSubmit = useCallback(() => {
    if (externalLoading) return;
    const filledForm = buildSubmitForm(form, filterConfig);
    const errorMessages = runValidation(filterConfig, filledForm);

    if (errorMessages.length > 0) {
      setErrorMsg(formatErrorMessages(errorMessages));
      return;
    }
    setErrorMsg('');
    onSubmit(filledForm);
    setShow(false);
  }, [onSubmit, form, externalLoading, filterConfig]);

  const renderableFilters = useMemo(
    () => filterConfig.filter(isFilterRenderable),
    [filterConfig]
  );

  const rows = useMemo(
    () => chunkArray(renderableFilters, 3),
    [renderableFilters]
  );

  return (
    <div className="w-full mt-4">
      <div className="card p-0">
        <AccordionHeader
          show={show}
          onToggle={() => setShow((s) => !s)}
          hasCustomerFilter={hasCustomerFilter}
          customerHasAssigned={customerData.hasAssigned}
          useCustomerSuggest={useCustomerSuggest}
          onCustomerToggle={() => setUseCustomerSuggest((prev) => !prev)}
        />

        {/* Accordion Body */}
        {show && (
          <div className="px-5 py-4">
            <FilterAccordionBody
              externalLoading={externalLoading}
              filterError={filterError}
              filterConfig={filterConfig}
              rows={rows}
              form={form}
              errorMsg={errorMsg}
              handleChange={handleChange}
              handleReset={handleReset}
              handleSubmit={handleSubmit}
              customerData={customerData}
              useCustomerSuggest={useCustomerSuggest}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default V1FilterSection;
