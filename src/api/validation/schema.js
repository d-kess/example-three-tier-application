// Tiny dependency-free schema helpers used by the validation middleware.
//
// A "field rule" is `{ required, parse(raw) }` where parse returns either
// `{ value }` (possibly normalized) or `{ error: '<message>' }`.
// An "object schema" is built with `object(fields)` and validates a whole
// params/query/body object, stripping unknown keys.

const MAX_INT4 = 2147483647; // tasks.id is a Postgres `serial` (int4)
const MAX_TITLE_LENGTH = 500; // tasks.title is varchar(500)

/** Task id as it appears in the URL: a decimal integer in 1..2147483647. */
function id({ required = false } = {}) {
  const message = `must be an integer between 1 and ${MAX_INT4}`;
  return {
    required,
    parse(raw) {
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return { error: message };
      const n = parseInt(raw, 10);
      if (n < 1 || n > MAX_INT4) return { error: message };
      return { value: n };
    },
  };
}

/** Non-blank string, trimmed, at most `max` characters after trimming. */
function title({ required = false, max = MAX_TITLE_LENGTH } = {}) {
  return {
    required,
    parse(raw) {
      if (typeof raw !== 'string' || !raw.trim()) {
        return { error: 'must be a non-empty string' };
      }
      const value = raw.trim();
      if (value.length > max) return { error: `must be at most ${max} characters` };
      return { value };
    },
  };
}

/** Strict JSON boolean (no coercion of "true", 1, etc.). */
function boolean({ required = false } = {}) {
  return {
    required,
    parse(raw) {
      if (typeof raw !== 'boolean') return { error: 'must be a boolean' };
      return { value: raw };
    },
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Build an object schema.
 * @param {Record<string, {required: boolean, parse: Function}>} fields
 * @param {{ optional?: boolean }} [options] optional: a missing input is treated as `{}`
 * @returns {(input: unknown) => { value: object, errors: Array<{field: string|null, message: string}> }}
 */
function object(fields, { optional = false } = {}) {
  return function validateObject(input) {
    if (input === undefined && optional) input = {};
    if (!isPlainObject(input)) {
      return { value: {}, errors: [{ field: null, message: 'must be a JSON object' }] };
    }
    const value = {};
    const errors = [];
    for (const [name, rule] of Object.entries(fields)) {
      const raw = input[name];
      if (raw === undefined) {
        if (rule.required) errors.push({ field: name, message: 'is required' });
        continue;
      }
      const result = rule.parse(raw);
      if (result.error) errors.push({ field: name, message: result.error });
      else value[name] = result.value;
    }
    return { value, errors };
  };
}

module.exports = { MAX_INT4, MAX_TITLE_LENGTH, id, title, boolean, object };
