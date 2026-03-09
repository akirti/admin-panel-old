// Generic operator application for dynamic validation
const applyOperator = (operator, value, expressionValue) => {
  switch (operator) {
    case '$eq':
      return String(value) === String(expressionValue);
    case '$ne':
      return String(value) !== String(expressionValue);
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

// Individual range check helpers
const checkGreaterThan = (val, expressionValue) =>
  Number(val) > Number(expressionValue);

const checkLessThan = (val, expressionValue) =>
  Number(val) < Number(expressionValue);

const checkRange = (val, expressionValue) => {
  const [min, max] = String(expressionValue).split(',').map(Number);
  return Number(val) >= min && Number(val) <= max;
};

// Range validator helper
const rangeValidator = (val, filter) => {
  if (!filter.validators) return true;
  for (const v of filter.validators) {
    const type = (v.type || v.validatior || '').toLowerCase();
    if (type.includes('greaterthan') && !checkGreaterThan(val, v.expressionValue)) return false;
    if (type.includes('lessthan') && !checkLessThan(val, v.expressionValue)) return false;
    if (type.includes('range') && !checkRange(val, v.expressionValue)) return false;
  }
  return true;
};

// --- Individual validator type handlers ---
// Each returns true if valid, false if invalid

const validateString = (val) =>
  typeof val === 'string' && /^([a-zA-Z0-9._\-@]+)(,[a-zA-Z0-9._\-@]+)*$/.test(val);

const validateUserIdOrEmail = (val) => {
  if (typeof val !== 'string') return false;
  const userIdRegex = /^[a-zA-Z0-9._\-@]+$/;
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return userIdRegex.test(val) || emailRegex.test(val);
};

const validateMultiSelect = (val) =>
  !(
    (Array.isArray(val) && val.length === 0) ||
    val === undefined ||
    val === null ||
    val === ''
  );

const validateToggleButton = (val) => {
  if (Array.isArray(val)) return val.length > 0;
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return Object.values(val).some(
      (v) => v === true || v === 'on' || v === 1 || v === '1'
    );
  }
  return typeof val === 'boolean' || val === true || val === false;
};

const getFilterDefaultValue = (filter) => {
  if (!filter.attributes || !Array.isArray(filter.attributes)) return undefined;
  const attr = filter.attributes.find((a) => a.key === 'defaultValue');
  return attr ? attr.value : undefined;
};

const validateNumberType = (type, val, filter) => {
  const defaultVal = getFilterDefaultValue(filter);
  if (val === defaultVal || val === '-1' || val === -1) return true;
  if (type.includes('numberofdigits')) return /^\d{10}$/.test(val);
  if (type === 'number') {
    return /^-?\d{1,11}$/.test(val) && Number(val) >= -1 && Number(val) <= 99999999999;
  }
  if (type.includes('customernumber')) {
    return /^\d{10}$/.test(val) && Number(val) >= 2000000000 && Number(val) <= 9999999999;
  }
  return true;
};

const validateRegexFormat = (v, val) => {
  if (!v.expressionValue) return true;
  try {
    return new RegExp(v.expressionValue).test(val);
  } catch {
    return false;
  }
};

const validateExpression = (v, val) => {
  const expressions = v.expression
    .split(/[|,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  for (const expr of expressions) {
    if (expr.startsWith('$') && !applyOperator(expr, val, v.expressionValue)) {
      return false;
    }
  }
  return true;
};

// Build an invalid result with display name context
const buildInvalidResult = (filter, msg) => {
  const displayName = filter.displayName || filter.label || filter.dataKey || 'Field';
  const message = msg.includes(displayName) ? msg : `${msg} (${displayName})`;
  return { valid: false, message };
};

// Resolve the validator check for a single validator entry
const resolveValidator = (type, v, val, filter) => {
  if (type === 'stringvalidator' || type === 'text') return validateString(val);
  if (type === 'useridoremail') return validateUserIdOrEmail(val);
  if (type.includes('multi-select')) return validateMultiSelect(val);
  if (type === 'togglebutton') return validateToggleButton(val);
  if (type.includes('numberofdigits') || type === 'number' || type.includes('customernumber')) {
    return validateNumberType(type, val, filter);
  }
  if (type.includes('greaterthan') || type.includes('lessthan') || type.includes('range')) {
    return rangeValidator(val, filter);
  }
  if (type.includes('format') || type.includes('regex')) return validateRegexFormat(v, val);
  if (v.expression) return validateExpression(v, val);
  if (type.startsWith('$')) return applyOperator(type, val, v.expressionValue);
  return true;
};

// Validation function for a filter
export const validateFilter = (filter, val) => {
  if (!filter.validators || !Array.isArray(filter.validators)) {
    return { valid: true };
  }

  for (const v of filter.validators) {
    const type = (v.type || v.validatior || '').toLowerCase();
    const msg = v.message || v.messgae || 'Invalid value';
    const valid = resolveValidator(type, v, val, filter);

    if (!valid) {
      return buildInvalidResult(filter, msg);
    }
  }
  return { valid: true };
};
