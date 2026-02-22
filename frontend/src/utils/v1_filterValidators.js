// Generic operator application for dynamic validation
const applyOperator = (operator, value, expressionValue) => {
  switch (operator) {
    case '$eq':
      return value == expressionValue;
    case '$ne':
      return value != expressionValue;
    case '$gt':
      return Number(value) > Number(expressionValue);
    case '$gte':
      return Number(value) >= Number(expressionValue);
    case '$lt':
      return Number(value) < Number(expressionValue);
    case '$lte':
      return Number(value) <= Number(expressionValue);
    case '$in':
      return Array.isArray(expressionValue)
        ? expressionValue.includes(value)
        : String(expressionValue).split(',').map((v) => v.trim()).includes(String(value));
    case '$not_in':
      return Array.isArray(expressionValue)
        ? !expressionValue.includes(value)
        : !String(expressionValue).split(',').map((v) => v.trim()).includes(String(value));
    case '$length':
      return String(value).length === Number(expressionValue);
    case '$regex':
      try {
        return new RegExp(expressionValue).test(value);
      } catch {
        return false;
      }
    default:
      return true;
  }
};

// Range validator helper
const rangeValidator = (val, filter) => {
  if (!filter.validators) return true;
  for (const v of filter.validators) {
    const type = (v.type || v.validatior || '').toLowerCase();
    if (type.includes('greaterthan')) {
      if (Number(val) <= Number(v.expressionValue)) return false;
    } else if (type.includes('lessthan')) {
      if (Number(val) >= Number(v.expressionValue)) return false;
    } else if (type.includes('range')) {
      const [min, max] = String(v.expressionValue).split(',').map(Number);
      if (Number(val) < min || Number(val) > max) return false;
    }
  }
  return true;
};

// Validation function for a filter
export const validateFilter = (filter, val) => {
  if (!filter.validators || !Array.isArray(filter.validators)) {
    return { valid: true };
  }

  for (const v of filter.validators) {
    let valid = true;
    const type = (v.type || v.validatior || '').toLowerCase();
    let msg = v.message || v.messgae || 'Invalid value';

    if (type === 'stringvalidator' || type === 'text') {
      if (
        typeof val !== 'string' ||
        !/^([a-zA-Z0-9._\-@]+)(,[a-zA-Z0-9._\-@]+)*$/.test(val)
      ) {
        const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
        if (!msg.includes(displayName)) msg += ` (${displayName})`;
        return { valid: false, message: msg };
      }
      valid = true;
    } else if (type === 'useridoremail') {
      const userIdRegex = /^[a-zA-Z0-9._\-@]+$/;
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (
        typeof val !== 'string' ||
        !(userIdRegex.test(val) || emailRegex.test(val))
      ) {
        const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
        if (!msg.includes(displayName)) msg += ` (${displayName})`;
        return { valid: false, message: msg };
      }
      valid = true;
    } else if (type.includes('multi-select')) {
      if (
        (Array.isArray(val) && val.length === 0) ||
        val === undefined ||
        val === null ||
        val === ''
      ) {
        const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
        if (!msg.includes(displayName)) msg += ` (${displayName})`;
        return { valid: false, message: msg };
      }
      valid = true;
    } else if (type === 'togglebutton') {
      let isValidToggle = false;
      if (Array.isArray(val)) {
        isValidToggle = val.length > 0;
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        isValidToggle = Object.values(val).some(
          (v) => v === true || v === 'on' || v === 1 || v === '1'
        );
      } else {
        isValidToggle = typeof val === 'boolean' || val === true || val === false;
      }
      if (!isValidToggle) {
        const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
        if (!msg.includes(displayName)) msg += ` (${displayName})`;
        return { valid: false, message: msg };
      }
      valid = true;
    } else if (
      type.includes('numberofdigits') ||
      type === 'number' ||
      type.includes('customernumber')
    ) {
      let defaultVal;
      if (filter.attributes && Array.isArray(filter.attributes)) {
        const attr = filter.attributes.find((a) => a.key === 'defaultValue');
        defaultVal = attr ? attr.value : undefined;
      }
      if (val === defaultVal || val === '-1' || val === -1) {
        valid = true;
      } else {
        if (type.includes('numberofdigits')) {
          valid = /^\d{10}$/.test(val);
        } else if (type === 'number') {
          valid =
            /^-?\d{1,11}$/.test(val) &&
            Number(val) >= -1 &&
            Number(val) <= 99999999999;
        } else if (type.includes('customernumber')) {
          valid =
            /^\d{10}$/.test(val) &&
            Number(val) >= 2000000000 &&
            Number(val) <= 9999999999;
        }
      }
    } else if (
      type.includes('greaterthan') ||
      type.includes('lessthan') ||
      type.includes('range')
    ) {
      valid = rangeValidator(val, filter);
    } else if (type.includes('format') || type.includes('regex')) {
      if (v.expressionValue) {
        try {
          valid = new RegExp(v.expressionValue).test(val);
        } catch {
          valid = false;
        }
      } else {
        valid = true;
      }
    } else if (v.expression) {
      const expressions = v.expression
        .split(/[|,]/)
        .map((e) => e.trim())
        .filter(Boolean);
      for (const expr of expressions) {
        if (expr.startsWith('$')) {
          valid = applyOperator(expr, val, v.expressionValue);
          if (!valid) break;
        }
      }
    } else if (type.startsWith('$')) {
      valid = applyOperator(type, val, v.expressionValue);
    } else {
      valid = true;
    }

    if (!valid) {
      const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
      if (!msg.includes(displayName)) msg += ` (${displayName})`;
      return { valid: false, message: msg };
    }
  }
  return { valid: true };
};
