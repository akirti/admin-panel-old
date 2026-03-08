import { validateFilter } from './v1_filterValidators';

// Helper to create a filter with validators
const makeFilter = (validators, extra = {}) => ({
  validators,
  displayName: 'TestField',
  ...extra,
});

// ── No validators ───────────────────────────────────────────────────────────

describe('validateFilter - no validators', () => {
  it('returns valid when validators is undefined', () => {
    expect(validateFilter({}, 'anything')).toEqual({ valid: true });
  });

  it('returns valid when validators is null', () => {
    expect(validateFilter({ validators: null }, 'anything')).toEqual({ valid: true });
  });

  it('returns valid when validators is not an array', () => {
    expect(validateFilter({ validators: 'wrong' }, 'anything')).toEqual({ valid: true });
  });

  it('returns valid when validators is empty array', () => {
    expect(validateFilter(makeFilter([]), 'anything')).toEqual({ valid: true });
  });
});

// ── stringvalidator / text ──────────────────────────────────────────────────

describe('validateFilter - stringvalidator', () => {
  const filter = makeFilter([{ type: 'stringvalidator', message: 'Bad input' }]);

  it('accepts simple alphanumeric string', () => {
    expect(validateFilter(filter, 'hello123')).toEqual({ valid: true });
  });

  it('accepts string with dots, underscores, hyphens, @', () => {
    expect(validateFilter(filter, 'user.name_test-val@domain')).toEqual({ valid: true });
  });

  it('accepts comma-separated values', () => {
    expect(validateFilter(filter, 'a,b,c')).toEqual({ valid: true });
  });

  it('rejects string with spaces', () => {
    const result = validateFilter(filter, 'hello world');
    expect(result.valid).toBe(false);
  });

  it('rejects non-string value', () => {
    const result = validateFilter(filter, 123);
    expect(result.valid).toBe(false);
  });

  it('rejects string with special chars like $', () => {
    const result = validateFilter(filter, 'abc$def');
    expect(result.valid).toBe(false);
  });

  it('includes display name in error message', () => {
    const result = validateFilter(filter, 'bad value!');
    expect(result.message).toContain('TestField');
  });
});

describe('validateFilter - text type alias', () => {
  const filter = makeFilter([{ type: 'text', message: 'Invalid' }]);

  it('accepts valid string', () => {
    expect(validateFilter(filter, 'valid123')).toEqual({ valid: true });
  });

  it('rejects invalid string', () => {
    expect(validateFilter(filter, 'has spaces')).toHaveProperty('valid', false);
  });
});

// ── useridoremail ───────────────────────────────────────────────────────────

describe('validateFilter - useridoremail', () => {
  const filter = makeFilter([{ type: 'useridoremail', message: 'Invalid user/email' }]);

  it('accepts a simple user ID', () => {
    expect(validateFilter(filter, 'user123')).toEqual({ valid: true });
  });

  it('accepts an email address', () => {
    expect(validateFilter(filter, 'user@example.com')).toEqual({ valid: true });
  });

  it('accepts userId with dots and hyphens', () => {
    expect(validateFilter(filter, 'first.last-name')).toEqual({ valid: true });
  });

  it('rejects string with spaces', () => {
    const result = validateFilter(filter, 'user name');
    expect(result.valid).toBe(false);
  });

  it('rejects non-string', () => {
    const result = validateFilter(filter, null);
    expect(result.valid).toBe(false);
  });
});

// ── multi-select ────────────────────────────────────────────────────────────

describe('validateFilter - multi-select', () => {
  const filter = makeFilter([{ type: 'multi-select', message: 'Select at least one' }]);

  it('accepts non-empty array', () => {
    expect(validateFilter(filter, ['a', 'b'])).toEqual({ valid: true });
  });

  it('rejects empty array', () => {
    const result = validateFilter(filter, []);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validateFilter(filter, undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects null', () => {
    const result = validateFilter(filter, null);
    expect(result.valid).toBe(false);
  });

  it('rejects empty string', () => {
    const result = validateFilter(filter, '');
    expect(result.valid).toBe(false);
  });
});

// ── togglebutton ────────────────────────────────────────────────────────────

describe('validateFilter - togglebutton', () => {
  const filter = makeFilter([{ type: 'togglebutton', message: 'Must select toggle' }]);

  it('accepts non-empty array', () => {
    expect(validateFilter(filter, ['option1'])).toEqual({ valid: true });
  });

  it('rejects empty array', () => {
    const result = validateFilter(filter, []);
    expect(result.valid).toBe(false);
  });

  it('accepts object with truthy values', () => {
    expect(validateFilter(filter, { a: true, b: false })).toEqual({ valid: true });
  });

  it('accepts object with "on" value', () => {
    expect(validateFilter(filter, { a: 'on' })).toEqual({ valid: true });
  });

  it('rejects object with all falsy values', () => {
    const result = validateFilter(filter, { a: false, b: 0 });
    expect(result.valid).toBe(false);
  });

  it('accepts boolean true', () => {
    expect(validateFilter(filter, true)).toEqual({ valid: true });
  });

  it('accepts boolean false (it is a valid boolean)', () => {
    // The code checks typeof val === 'boolean' which is true for false
    expect(validateFilter(filter, false)).toEqual({ valid: true });
  });

  it('rejects non-boolean, non-array, non-object string', () => {
    const result = validateFilter(filter, 'string');
    expect(result.valid).toBe(false);
  });
});

// ── numberofdigits ──────────────────────────────────────────────────────────

describe('validateFilter - numberofdigits', () => {
  const filter = makeFilter([{ type: 'numberofdigits', message: 'Must be 10 digits' }]);

  it('accepts 10-digit number', () => {
    expect(validateFilter(filter, '1234567890')).toEqual({ valid: true });
  });

  it('rejects 9-digit number', () => {
    const result = validateFilter(filter, '123456789');
    expect(result.valid).toBe(false);
  });

  it('rejects 11-digit number', () => {
    const result = validateFilter(filter, '12345678901');
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric', () => {
    const result = validateFilter(filter, 'abcdefghij');
    expect(result.valid).toBe(false);
  });

  it('accepts default value -1', () => {
    expect(validateFilter(filter, '-1')).toEqual({ valid: true });
  });

  it('accepts the attributes default value', () => {
    const filterWithDefault = {
      ...filter,
      attributes: [{ key: 'defaultValue', value: 'N/A' }],
    };
    expect(validateFilter(filterWithDefault, 'N/A')).toEqual({ valid: true });
  });
});

// ── number ──────────────────────────────────────────────────────────────────

describe('validateFilter - number', () => {
  const filter = makeFilter([{ type: 'number', message: 'Invalid number' }]);

  it('accepts a valid number', () => {
    expect(validateFilter(filter, '42')).toEqual({ valid: true });
  });

  it('accepts negative -1', () => {
    expect(validateFilter(filter, '-1')).toEqual({ valid: true });
  });

  it('accepts zero', () => {
    expect(validateFilter(filter, '0')).toEqual({ valid: true });
  });

  it('rejects numbers below -1', () => {
    const result = validateFilter(filter, '-2');
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric string', () => {
    const result = validateFilter(filter, 'abc');
    expect(result.valid).toBe(false);
  });

  it('accepts large valid number', () => {
    expect(validateFilter(filter, '99999999999')).toEqual({ valid: true });
  });

  it('rejects number exceeding max', () => {
    const result = validateFilter(filter, '100000000000');
    expect(result.valid).toBe(false);
  });
});

// ── customernumber ──────────────────────────────────────────────────────────

describe('validateFilter - customernumber', () => {
  const filter = makeFilter([{ type: 'customernumber', message: 'Invalid customer number' }]);

  it('accepts valid customer number >= 2000000000', () => {
    expect(validateFilter(filter, '2000000000')).toEqual({ valid: true });
  });

  it('accepts customer number at max boundary', () => {
    expect(validateFilter(filter, '9999999999')).toEqual({ valid: true });
  });

  it('rejects customer number below 2000000000', () => {
    const result = validateFilter(filter, '1999999999');
    expect(result.valid).toBe(false);
  });

  it('rejects non-10-digit number', () => {
    const result = validateFilter(filter, '200000000'); // 9 digits
    expect(result.valid).toBe(false);
  });

  it('accepts default value -1', () => {
    expect(validateFilter(filter, '-1')).toEqual({ valid: true });
  });
});

// ── greaterthan / lessthan / range ──────────────────────────────────────────

describe('validateFilter - range validators', () => {
  it('validates greaterthan', () => {
    const filter = makeFilter([{ type: 'greaterthan', expressionValue: '10', message: 'Too small' }]);
    expect(validateFilter(filter, '15')).toEqual({ valid: true });
    expect(validateFilter(filter, '10').valid).toBe(false);
    expect(validateFilter(filter, '5').valid).toBe(false);
  });

  it('validates lessthan', () => {
    const filter = makeFilter([{ type: 'lessthan', expressionValue: '100', message: 'Too big' }]);
    expect(validateFilter(filter, '50')).toEqual({ valid: true });
    expect(validateFilter(filter, '100').valid).toBe(false);
    expect(validateFilter(filter, '150').valid).toBe(false);
  });

  it('validates range', () => {
    const filter = makeFilter([{ type: 'range', expressionValue: '1,100', message: 'Out of range' }]);
    expect(validateFilter(filter, '50')).toEqual({ valid: true });
    expect(validateFilter(filter, '1')).toEqual({ valid: true });
    expect(validateFilter(filter, '100')).toEqual({ valid: true });
    expect(validateFilter(filter, '0').valid).toBe(false);
    expect(validateFilter(filter, '101').valid).toBe(false);
  });
});

// ── format / regex ──────────────────────────────────────────────────────────

describe('validateFilter - format/regex', () => {
  it('validates against regex pattern', () => {
    const filter = makeFilter([
      { type: 'format', expressionValue: '^[A-Z]{3}$', message: 'Must be 3 uppercase letters' },
    ]);
    expect(validateFilter(filter, 'ABC')).toEqual({ valid: true });
    expect(validateFilter(filter, 'abc').valid).toBe(false);
    expect(validateFilter(filter, 'ABCD').valid).toBe(false);
  });

  it('returns valid when no expressionValue on regex type', () => {
    const filter = makeFilter([{ type: 'regex', message: 'Pattern error' }]);
    expect(validateFilter(filter, 'anything')).toEqual({ valid: true });
  });

  it('returns false for invalid regex pattern', () => {
    const filter = makeFilter([{ type: 'format', expressionValue: '[invalid', message: 'bad regex' }]);
    const result = validateFilter(filter, 'test');
    expect(result.valid).toBe(false);
  });
});

// ── Expression-based validators ($eq, $ne, $gt, etc.) ───────────────────────

describe('validateFilter - expression operators', () => {
  it('validates $eq', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$eq', expressionValue: 'hello', message: 'Must equal' },
    ]);
    expect(validateFilter(filter, 'hello')).toEqual({ valid: true });
    expect(validateFilter(filter, 'world').valid).toBe(false);
  });

  it('validates $ne', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$ne', expressionValue: 'blocked', message: 'Cannot be blocked' },
    ]);
    expect(validateFilter(filter, 'active')).toEqual({ valid: true });
    expect(validateFilter(filter, 'blocked').valid).toBe(false);
  });

  it('validates $gt', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$gt', expressionValue: '10', message: 'Must be > 10' },
    ]);
    expect(validateFilter(filter, '15')).toEqual({ valid: true });
    expect(validateFilter(filter, '10').valid).toBe(false);
    expect(validateFilter(filter, '5').valid).toBe(false);
  });

  it('validates $gte', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$gte', expressionValue: '10', message: 'Must be >= 10' },
    ]);
    expect(validateFilter(filter, '10')).toEqual({ valid: true });
    expect(validateFilter(filter, '9').valid).toBe(false);
  });

  it('validates $lt', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$lt', expressionValue: '100', message: 'Must be < 100' },
    ]);
    expect(validateFilter(filter, '50')).toEqual({ valid: true });
    expect(validateFilter(filter, '100').valid).toBe(false);
  });

  it('validates $lte', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$lte', expressionValue: '100', message: 'Must be <= 100' },
    ]);
    expect(validateFilter(filter, '100')).toEqual({ valid: true });
    expect(validateFilter(filter, '101').valid).toBe(false);
  });

  it('validates $in with array', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$in', expressionValue: ['a', 'b', 'c'], message: 'Not in list' },
    ]);
    expect(validateFilter(filter, 'a')).toEqual({ valid: true });
    expect(validateFilter(filter, 'd').valid).toBe(false);
  });

  it('validates $in with comma-separated string', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$in', expressionValue: 'x, y, z', message: 'Not in list' },
    ]);
    expect(validateFilter(filter, 'y')).toEqual({ valid: true });
    expect(validateFilter(filter, 'w').valid).toBe(false);
  });

  it('validates $not_in', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$not_in', expressionValue: ['banned', 'blocked'], message: 'Is in blacklist' },
    ]);
    expect(validateFilter(filter, 'active')).toEqual({ valid: true });
    expect(validateFilter(filter, 'banned').valid).toBe(false);
  });

  it('validates $length', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$length', expressionValue: '5', message: 'Must be 5 chars' },
    ]);
    expect(validateFilter(filter, 'abcde')).toEqual({ valid: true });
    expect(validateFilter(filter, 'abcd').valid).toBe(false);
  });

  it('validates $regex', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$regex', expressionValue: '^\\d+$', message: 'Must be digits' },
    ]);
    expect(validateFilter(filter, '12345')).toEqual({ valid: true });
    expect(validateFilter(filter, 'abc').valid).toBe(false);
  });
});

// ── Type starting with $ directly ───────────────────────────────────────────

describe('validateFilter - type as operator ($eq, $ne, etc.)', () => {
  it('applies $eq when type starts with $', () => {
    const filter = makeFilter([{ type: '$eq', expressionValue: '42', message: 'Must be 42' }]);
    expect(validateFilter(filter, '42')).toEqual({ valid: true });
    expect(validateFilter(filter, '99').valid).toBe(false);
  });

  it('applies $ne when type starts with $', () => {
    const filter = makeFilter([{ type: '$ne', expressionValue: 'bad', message: 'Cannot be bad' }]);
    expect(validateFilter(filter, 'good')).toEqual({ valid: true });
    expect(validateFilter(filter, 'bad').valid).toBe(false);
  });
});

// ── Fallback / unknown type ─────────────────────────────────────────────────

describe('validateFilter - unknown validator type', () => {
  it('returns valid for unrecognized type without expression', () => {
    const filter = makeFilter([{ type: 'unknownType', message: 'whatever' }]);
    expect(validateFilter(filter, 'anything')).toEqual({ valid: true });
  });
});

// ── Display name fallback ───────────────────────────────────────────────────

describe('validateFilter - display name fallback', () => {
  it('uses label if displayName is absent', () => {
    const filter = { validators: [{ type: 'stringvalidator', message: 'Bad' }], label: 'MyLabel' };
    const result = validateFilter(filter, 'has spaces');
    expect(result.message).toContain('MyLabel');
  });

  it('uses dataKey if both displayName and label are absent', () => {
    const filter = { validators: [{ type: 'stringvalidator', message: 'Bad' }], dataKey: 'myKey' };
    const result = validateFilter(filter, 'has spaces');
    expect(result.message).toContain('myKey');
  });

  it('uses "Field" as default display name', () => {
    const filter = { validators: [{ type: 'stringvalidator', message: 'Bad' }] };
    const result = validateFilter(filter, 'has spaces');
    expect(result.message).toContain('Field');
  });

  it('does not duplicate display name if already in message', () => {
    const filter = makeFilter([{ type: 'stringvalidator', message: 'Invalid TestField value' }]);
    const result = validateFilter(filter, 'bad value!');
    // Should not append (TestField) again
    const count = (result.message.match(/TestField/g) || []).length;
    expect(count).toBe(1);
  });
});

// ── Multiple validators ─────────────────────────────────────────────────────

describe('validateFilter - multiple validators', () => {
  it('passes when all validators pass', () => {
    const filter = makeFilter([
      { type: 'stringvalidator', message: 'Bad string' },
      { type: 'format', expressionValue: '^[a-z]+$', message: 'Must be lowercase' },
    ]);
    expect(validateFilter(filter, 'hello')).toEqual({ valid: true });
  });

  it('fails on first failing validator', () => {
    const filter = makeFilter([
      { type: 'stringvalidator', message: 'Bad string' },
      { type: 'format', expressionValue: '^[A-Z]+$', message: 'Must be uppercase' },
    ]);
    // "hello" passes stringvalidator but fails uppercase regex
    const result = validateFilter(filter, 'hello');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Must be uppercase');
  });
});

// ── validatior (typo) and messgae (typo) fallback ───────────────────────────

describe('validateFilter - typo fallback fields', () => {
  it('reads type from validatior field if type is absent', () => {
    const filter = makeFilter([{ validatior: 'stringvalidator', message: 'Bad' }]);
    const result = validateFilter(filter, 'has spaces');
    expect(result.valid).toBe(false);
  });

  it('reads message from messgae field if message is absent', () => {
    const filter = makeFilter([{ type: 'stringvalidator', messgae: 'Typo msg' }]);
    const result = validateFilter(filter, 'bad value!');
    expect(result.message).toContain('Typo msg');
  });
});

// ── Pipe-separated expressions ──────────────────────────────────────────────

describe('validateFilter - pipe-separated expressions', () => {
  it('evaluates multiple expressions separated by pipe', () => {
    const filter = makeFilter([
      { type: 'custom', expression: '$gt|$lt', expressionValue: '10', message: 'Out of range' },
    ]);
    // $gt with 10 -> 15 > 10 = true, $lt with 10 -> 15 < 10 = false
    const result = validateFilter(filter, '15');
    expect(result.valid).toBe(false);
  });
});
