import React from 'react';
import V1CustomDropdown from './v1_CustomDropdown';
import V1MultiSelectDropdown from './v1_MultiSelectDropdown';
import V1RadioButtonDropdown from './v1_RadioButtonDropdown';
import V1ToggleButtonDropdown from './v1_ToggleButtonDropdown';
import V1CustomerSuggestInput from './v1_CustomerSuggestInput';
import {
  getAttrValue,
  formatApiDateForInput,
  getCurrentDate,
  addDays,
  handleArray,
} from '../../utils/v1_reportUtils';

const CUSTOMER_DATAKEY_PATTERN = /^(query_)?customer[s_]?/i;
const CUSTOMER_DISPLAY_PATTERN = /customer\s*[#\d]/i;

/**
 * Detect whether a filter represents a customer input field.
 * Matches by dataKey (query_customer, query_customers, customer_number, etc.)
 * OR by displayName containing "Customer#" or "Customer #".
 */
const isCustomerFilter = (filter) => {
  if (CUSTOMER_DATAKEY_PATTERN.test(filter.dataKey)) return true;
  const display = filter.displayName || '';
  return CUSTOMER_DISPLAY_PATTERN.test(display);
};

// --- Helper: check if a value is empty (undefined, null, or '') ---
const isEmpty = (v) => v === undefined || v === null || v === '';

// --- Helper: resolve a date value with defaultValue and getCurrentDate fallbacks ---
const resolveDateValue = (value, defaultVal, format) => {
  let v = value;
  if (isEmpty(v) && defaultVal) v = formatApiDateForInput(defaultVal, format);
  if (isEmpty(v)) v = getCurrentDate();
  return v;
};

// --- Helper: resolve multiselect value from various input shapes ---
const resolveMultiValue = (value, defaultVal) => {
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value.filter((v) => v !== '');
  }
  if (isEmpty(value) && defaultVal) {
    if (typeof defaultVal === 'string') {
      return defaultVal.split(',').map((v) => v.trim());
    }
    if (Array.isArray(defaultVal)) {
      return defaultVal.filter((v) => v !== '');
    }
  }
  return [];
};

// --- Helper: resolve radio button value ---
const resolveRadioValue = (value, defaultVal, options) => {
  if (isEmpty(value)) {
    let resolved = !isEmpty(defaultVal)
      ? defaultVal
      : (options[0] && options[0].value) || '';
    return typeof resolved === 'string' ? resolved.trim() : resolved;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return value;
};

// --- Helper: determine if a toggle is "on" ---
const isToggleOn = (v, onValue = undefined) => {
  if (onValue !== undefined) return v === onValue;
  return v === 1 || v === '1' || v === 'on' || v === true;
};

// --- Helper: resolve a single toggle option's state from a defaults source ---
const resolveToggleDefault = (opt, defaultVal) => {
  const def = Array.isArray(defaultVal)
    ? defaultVal.find((item) => item[opt.dataKey] !== undefined)
    : defaultVal;
  if (def && def[opt.dataKey] !== undefined) {
    return isToggleOn(def[opt.dataKey], opt.values ? opt.values.on : undefined);
  }
  return false;
};

// --- Helper: resolve all toggle states from value and defaultVal ---
const resolveToggleState = (value, options, defaultVal) => {
  const togglesState = {};

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    options.forEach((opt) => {
      const v = value[opt.dataKey];
      if (v !== undefined) {
        togglesState[opt.dataKey] = opt.values
          ? isToggleOn(v, opt.values.on)
          : isToggleOn(v);
      } else if (defaultVal && typeof defaultVal === 'object') {
        togglesState[opt.dataKey] = resolveToggleDefault(opt, defaultVal);
      } else {
        togglesState[opt.dataKey] = false;
      }
    });
  } else if (defaultVal && typeof defaultVal === 'object') {
    options.forEach((opt) => {
      togglesState[opt.dataKey] = resolveToggleDefault(opt, defaultVal);
    });
  } else {
    options.forEach((opt) => {
      togglesState[opt.dataKey] = false;
    });
  }

  return togglesState;
};

// --- CSS class constants ---
const DATE_INPUT_CLASS =
  'border border-edge rounded-md h-10 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors hover:border-neutral-400';
const DATE_RANGE_INPUT_CLASS =
  'border border-edge rounded-md h-10 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-colors hover:border-neutral-400';

// --- Helper: resolve paired date-picker default when two date pickers exist ---
const resolvePairedDateDefault = (value, filter, allFilters, form, format) => {
  const datePickers = allFilters?.filter(
    (f) => {
      const t = getAttrValue(f.attributes, 'type');
      return t === 'date-picker' || t === 'date';
    }
  );
  if (!datePickers || datePickers.length !== 2 || !isEmpty(value)) return value;

  const [first, second] = datePickers;
  const today = getCurrentDate();

  if (filter.dataKey === first.dataKey) {
    const toVal = form[second.dataKey]
      || formatApiDateForInput(getAttrValue(second.attributes, 'defaultValue'), format)
      || today;
    return toVal === today ? addDays(today, -60) : value;
  }
  if (filter.dataKey === second.dataKey) {
    const fromVal = form[first.dataKey]
      || formatApiDateForInput(getAttrValue(first.attributes, 'defaultValue'), format)
      || today;
    return fromVal === today ? addDays(today, 60) : value;
  }
  return value;
};

// --- Type-specific render functions ---

const renderDatePicker = ({ filter, value, onChange, attrs, format, defaultVal, allFilters, form, width }) => {
  const v = resolveDateValue(
    resolvePairedDateDefault(value, filter, allFilters, form, format),
    defaultVal,
    format
  );

  return (
    <input
      type="date"
      value={v}
      onChange={(e) => onChange(filter.dataKey, e.target.value)}
      min={getAttrValue(attrs, 'min')}
      max={getAttrValue(attrs, 'max')}
      className={DATE_INPUT_CLASS}
      style={{ minWidth: width }}
    />
  );
};

const renderDropdown = ({ options, value, onChange, filter, width }) => {
  return (
    <V1CustomDropdown
      options={options}
      value={value || (options[0] && options[0].value) || ''}
      onChange={(val) => onChange(filter.dataKey, val)}
      width={width}
    />
  );
};

const renderMultiSelect = ({ options, value, onChange, filter, attrs, defaultVal }) => {
  const multiValue = resolveMultiValue(value, defaultVal);
  const allOptionValues = options.map((opt) => opt.value);
  const allSelected =
    multiValue.length === allOptionValues.length && allOptionValues.length > 0;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      handleArray([], filter, onChange);
    } else {
      handleArray(allOptionValues, filter, onChange);
    }
  };

  return (
    <V1MultiSelectDropdown
      options={options}
      selectedOptions={multiValue}
      onChange={(vals) => handleArray(vals, filter, onChange)}
      placeholder={getAttrValue(attrs, 'placeholder') || 'Select...'}
      allSelected={allSelected}
      handleToggleSelectAll={handleToggleSelectAll}
      multiSelectFooter={true}
    />
  );
};

const renderRadioButton = ({ options, value, onChange, filter, defaultVal }) => {
  const radiovalue = resolveRadioValue(value, defaultVal, options);
  return (
    <V1RadioButtonDropdown
      options={options}
      value={radiovalue}
      onChange={(val) => onChange(filter.dataKey, val)}
      name={filter.dataKey}
    />
  );
};

const renderToggleButton = ({ options, value, onChange, filter, attrs, defaultVal }) => {
  const togglesState = resolveToggleState(value, options, defaultVal);

  const allSelected =
    Object.values(togglesState).every(Boolean) &&
    Object.keys(togglesState).length > 0;

  const handleToggleChange = (newState) => {
    const mapped = {};
    options.forEach((opt) => {
      const state = newState[opt.dataKey];
      if (opt.values) {
        mapped[opt.dataKey] = state ? opt.values.on : opt.values.off;
      } else {
        mapped[opt.dataKey] = state;
      }
    });
    onChange(filter.dataKey, mapped);
  };

  const handleToggleSelectAll = () => {
    const newState = {};
    Object.keys(togglesState).forEach((key) => {
      newState[key] = !allSelected;
    });
    handleToggleChange(newState);
  };

  return (
    <V1ToggleButtonDropdown
      options={options.map((opt) => ({
        value: opt.dataKey,
        label: opt.name,
      }))}
      togglesState={togglesState}
      onChange={handleToggleChange}
      placeholder={getAttrValue(attrs, 'placeholder') || 'Select...'}
      disabled={options.length === 0}
      allSelected={allSelected}
      handleToggleSelectAll={handleToggleSelectAll}
    />
  );
};

const renderCheckbox = ({ value, onChange, filter, width }) => {
  return (
    <div className="flex items-center h-10">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(filter.dataKey, e.target.checked)}
        className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
        style={{ minWidth: width }}
      />
    </div>
  );
};

const renderDateRange = ({ filter, value, onChange, attrs, format, width }) => {
  const defaultStart = getAttrValue(attrs, 'defaultValue_start');
  const defaultEnd = getAttrValue(attrs, 'defaultValue_end');
  const formatStart = getAttrValue(attrs, 'format_start') || format;
  const formatEnd = getAttrValue(attrs, 'format_end') || format;

  const valueStart = resolveDateValue(value?.start, defaultStart, formatStart);
  const valueEnd = resolveDateValue(value?.end, defaultEnd, formatEnd);

  return (
    <div className="flex items-center gap-2" style={{ minWidth: width }}>
      <input
        type="date"
        value={valueStart}
        onChange={(e) =>
          onChange(filter.dataKey, {
            ...value,
            start: e.target.value,
            end: valueEnd,
          })
        }
        className={DATE_RANGE_INPUT_CLASS}
      />
      <span className="text-sm text-content-muted font-medium">to</span>
      <input
        type="date"
        value={valueEnd}
        onChange={(e) =>
          onChange(filter.dataKey, {
            ...value,
            start: valueStart,
            end: e.target.value,
          })
        }
        className={DATE_RANGE_INPUT_CLASS}
      />
    </div>
  );
};

// --- Type renderer lookup ---
const TYPE_RENDERERS = {
  'date-picker': renderDatePicker,
  'date': renderDatePicker,
  'dropdown': renderDropdown,
  'select': renderDropdown,
  'multiselect': renderMultiSelect,
  'multi-select': renderMultiSelect,
  'radioButton': renderRadioButton,
  'toggleButton': renderToggleButton,
  'checkbox': renderCheckbox,
  'date-range': renderDateRange,
};

// --- Helper: normalize options from string/array/other ---
const normalizeOptions = (raw) => {
  if (typeof raw === 'string') {
    return raw.split(',').map((opt) => ({ name: opt.trim(), value: opt.trim() }));
  }
  return Array.isArray(raw) ? raw : [];
};

// --- Helper: resolve input placeholder ---
const resolveInputPlaceholder = (value, filter, fallback) =>
  isEmpty(value) && filter.inputHint ? filter.inputHint : fallback;

// --- Helper: check if customer suggest should be used ---
const shouldUseCustomerSuggest = (type, filter, useCustomerSuggest, customerData) =>
  type === 'input' && isCustomerFilter(filter) && useCustomerSuggest && customerData?.hasAssigned;

const V1DynamicFilterControl = ({
  filter,
  value,
  onChange,
  allFilters = [],
  form = {},
  placeholder,
  customerData,
  useCustomerSuggest = false,
  ...props
}) => {
  const attrs = filter.attributes || [];
  const type = getAttrValue(attrs, 'type') || 'input';
  const width = getAttrValue(attrs, 'width') || '100%';
  const options = normalizeOptions(getAttrValue(attrs, 'options'));
  const format = getAttrValue(attrs, 'format') || 'YYYYMMDD';
  const defaultVal = getAttrValue(attrs, 'defaultValue');

  // Type-specific renderer
  const TypeRenderer = TYPE_RENDERERS[type];
  if (TypeRenderer) {
    return (
      <TypeRenderer
        filter={filter}
        value={value}
        onChange={onChange}
        attrs={attrs}
        options={options}
        format={format}
        defaultVal={defaultVal}
        width={width}
        allFilters={allFilters}
        form={form}
      />
    );
  }

  // Customer suggest fallback
  if (shouldUseCustomerSuggest(type, filter, useCustomerSuggest, customerData)) {
    return (
      <V1CustomerSuggestInput
        value={value || ''}
        onChange={(val) => onChange(filter.dataKey, val)}
        customers={customerData.customers}
        tags={customerData.tags}
        loading={customerData.loading}
        onSearch={customerData.search}
        onFilterByTag={customerData.filterByTag}
        placeholder={resolveInputPlaceholder(value, filter, placeholder || 'Type customer # or name...')}
      />
    );
  }

  // Fallback: generic text input
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(filter.dataKey, e.target.value)}
      className={DATE_INPUT_CLASS}
      placeholder={resolveInputPlaceholder(value, filter, placeholder || type)}
      {...(props.title ? { title: props.title } : {})}
    />
  );
};

export default V1DynamicFilterControl;
