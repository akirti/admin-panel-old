import React from 'react';
import V1CustomDropdown from './v1_CustomDropdown';
import V1MultiSelectDropdown from './v1_MultiSelectDropdown';
import V1RadioButtonDropdown from './v1_RadioButtonDropdown';
import V1ToggleButtonDropdown from './v1_ToggleButtonDropdown';
import {
  getAttrValue,
  formatApiDateForInput,
  getCurrentDate,
  addDays,
  handleArray,
} from '../../utils/v1_reportUtils';

const V1DynamicFilterControl = ({
  filter,
  value,
  onChange,
  allFilters = [],
  form = {},
  placeholder,
  ...props
}) => {
  const attrs = filter.attributes || [];
  const type = getAttrValue(attrs, 'type') || 'input';
  const width = getAttrValue(attrs, 'width') || '100%';
  let options = getAttrValue(attrs, 'options');
  const format = getAttrValue(attrs, 'format') || 'YYYYMMDD';
  const defaultVal = getAttrValue(attrs, 'defaultValue');

  if (typeof options === 'string') {
    options = options.split(',').map((opt) => ({
      name: opt.trim(),
      value: opt.trim(),
    }));
  } else if (!Array.isArray(options)) {
    options = [];
  }

  // Date picker / date type
  if (type === 'date-picker' || type === 'date') {
    // Find if there are two date pickers in allFilters
    const datePickers = allFilters?.filter(
      (f) =>
        getAttrValue(f.attributes, 'type') === 'date-picker' ||
        getAttrValue(f.attributes, 'type') === 'date'
    );
    let v = value;
    // If there are two date pickers, apply the 60-day logic
    if (datePickers?.length === 2) {
      const [first, second] = datePickers;
      const isFrom = filter.dataKey === first.dataKey;
      const isTo = filter.dataKey === second.dataKey;
      const today = getCurrentDate();

      if (isFrom) {
        const toVal =
          form[second.dataKey] ||
          formatApiDateForInput(
            getAttrValue(second.attributes, 'defaultValue'),
            format
          ) ||
          today;
        if ((!v || v === '') && toVal === today) {
          v = addDays(today, -60);
        }
      }
      if (isTo) {
        const fromVal =
          form[first.dataKey] ||
          formatApiDateForInput(
            getAttrValue(first.attributes, 'defaultValue'),
            format
          ) ||
          today;
        if ((!v || v === '') && fromVal === today) {
          v = addDays(today, 60);
        }
      }
    }
    if ((v === undefined || v === null || v === '') && defaultVal)
      v = formatApiDateForInput(defaultVal, format);
    if (v === undefined || v === null || v === '') v = getCurrentDate();

    return (
      <input
        type="date"
        value={v}
        onChange={(e) => onChange(filter.dataKey, e.target.value)}
        min={getAttrValue(attrs, 'min')}
        max={getAttrValue(attrs, 'max')}
        className="border border-gray-300 rounded-md h-10 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors hover:border-gray-400"
        style={{ minWidth: width }}
      />
    );
  }

  // Dropdown / select
  if (type === 'dropdown' || type === 'select') {
    return (
      <V1CustomDropdown
        options={options}
        value={value || (options[0] && options[0].value) || ''}
        onChange={(val) => onChange(filter.dataKey, val)}
        width={width}
      />
    );
  }

  // Multi-select
  if (type === 'multiselect' || type === 'multi-select') {
    let multiValue = value;
    if (typeof multiValue === 'string' && multiValue.trim() !== '') {
      multiValue = [multiValue.trim()];
    } else if (Array.isArray(multiValue)) {
      multiValue = multiValue.filter((v) => v !== '');
    } else if (
      (multiValue === undefined ||
        multiValue === null ||
        multiValue.length === 0) &&
      defaultVal
    ) {
      multiValue =
        typeof defaultVal === 'string'
          ? defaultVal.split(',').map((v) => v.trim())
          : Array.isArray(defaultVal)
          ? defaultVal.filter((v) => v !== '')
          : [];
    } else {
      multiValue = [];
    }

    const allOptionValues = options.map((opt) => opt.value);
    const allSelected =
      multiValue.length === allOptionValues.length &&
      allOptionValues.length > 0;

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
  }

  // Radio button
  if (type === 'radioButton') {
    let radiovalue = value;
    if (radiovalue === undefined || radiovalue === null || radiovalue === '') {
      radiovalue =
        defaultVal !== undefined && defaultVal !== null && defaultVal !== ''
          ? defaultVal
          : (options[0] && options[0].value) || '';
      radiovalue = typeof radiovalue === 'string' ? radiovalue.trim() : radiovalue;
    } else if (typeof radiovalue === 'number') {
      radiovalue = radiovalue.toString();
    }
    return (
      <V1RadioButtonDropdown
        options={options}
        value={radiovalue}
        onChange={(val) => onChange(filter.dataKey, val)}
        name={filter.dataKey}
      />
    );
  }

  // Toggle button
  if (type === 'toggleButton') {
    const isToggleOn = (v, onValue = undefined) => {
      if (onValue !== undefined) return v === onValue;
      return v === 1 || v === '1' || v === 'on' || v === true;
    };

    let togglesState = {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      options.forEach((opt) => {
        const v = value[opt.dataKey];
        if (v !== undefined) {
          if (opt.values) {
            togglesState[opt.dataKey] = isToggleOn(v, opt.values.on);
          } else {
            togglesState[opt.dataKey] = isToggleOn(v);
          }
        } else if (defaultVal && typeof defaultVal === 'object') {
          const def = Array.isArray(defaultVal)
            ? defaultVal.find((item) => item[opt.dataKey] !== undefined)
            : defaultVal;
          if (def && def[opt.dataKey] !== undefined) {
            togglesState[opt.dataKey] = isToggleOn(
              def[opt.dataKey],
              opt.values ? opt.values.on : undefined
            );
          } else {
            togglesState[opt.dataKey] = false;
          }
        } else {
          togglesState[opt.dataKey] = false;
        }
      });
    } else if (defaultVal && typeof defaultVal === 'object') {
      options.forEach((opt) => {
        const def = Array.isArray(defaultVal)
          ? defaultVal.find((item) => item[opt.dataKey] !== undefined)
          : defaultVal;
        if (def && def[opt.dataKey] !== undefined) {
          togglesState[opt.dataKey] = isToggleOn(
            def[opt.dataKey],
            opt.values ? opt.values.on : undefined
          );
        } else {
          togglesState[opt.dataKey] = false;
        }
      });
    } else {
      options.forEach((opt) => {
        togglesState[opt.dataKey] = false;
      });
    }

    const allSelected =
      Object.values(togglesState).every(Boolean) &&
      Object.keys(togglesState).length > 0;

    const handleToggleSelectAll = () => {
      const newState = {};
      Object.keys(togglesState).forEach((key) => {
        newState[key] = !allSelected;
      });
      handleToggleChange(newState);
    };

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
  }

  // Checkbox
  if (type === 'checkbox') {
    return (
      <div className="flex items-center h-10">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(filter.dataKey, e.target.checked)}
          className="w-5 h-5 accent-red-600 rounded cursor-pointer"
          style={{ minWidth: width }}
        />
      </div>
    );
  }

  // Date range
  if (type === 'date-range') {
    const defaultStart = getAttrValue(attrs, 'defaultValue_start');
    const defaultEnd = getAttrValue(attrs, 'defaultValue_end');
    const formatStart = getAttrValue(attrs, 'format_start') || format;
    const formatEnd = getAttrValue(attrs, 'format_end') || format;
    let valueStart = value?.start;
    let valueEnd = value?.end;
    if (
      (valueStart === undefined || valueStart === null || valueStart === '') &&
      defaultStart
    ) {
      valueStart = formatApiDateForInput(defaultStart, formatStart);
    }
    if (
      (valueEnd === undefined || valueEnd === null || valueEnd === '') &&
      defaultEnd
    ) {
      valueEnd = formatApiDateForInput(defaultEnd, formatEnd);
    }
    if (valueStart === undefined || valueStart === null || valueStart === '')
      valueStart = getCurrentDate();
    if (valueEnd === undefined || valueEnd === null || valueEnd === '')
      valueEnd = getCurrentDate();

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
          className="border border-gray-300 rounded-md h-10 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors hover:border-gray-400"
        />
        <span className="text-sm text-gray-500 font-medium">to</span>
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
          className="border border-gray-300 rounded-md h-10 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors hover:border-gray-400"
        />
      </div>
    );
  }

  // Fallback: generic text input
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(filter.dataKey, e.target.value)}
      className="border border-gray-300 rounded-md h-10 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors hover:border-gray-400"
      placeholder={
        (!value || value === '') && filter.inputHint
          ? filter.inputHint
          : placeholder || type
      }
      {...(props.title ? { title: props.title } : {})}
    />
  );
};

export default V1DynamicFilterControl;
