const { test, describe } = require('node:test');
const assert = require('node:assert');

const { id, title, boolean, object } = require('../../validation/schema');
const validate = require('../../validation/validate');
const { ValidationError } = require('../../errors');

describe('field rules', () => {
  test('id accepts 1..2147483647 and returns a number', () => {
    const rule = id();
    assert.deepStrictEqual(rule.parse('1'), { value: 1 });
    assert.deepStrictEqual(rule.parse('2147483647'), { value: 2147483647 });
    for (const bad of ['0', '-1', '1.5', 'abc', '1abc', '2147483648', '99999999999', '', 5]) {
      assert.ok(rule.parse(bad).error, `id ${bad}`);
    }
  });

  test('title trims, rejects blanks / non-strings / over-long values', () => {
    const rule = title();
    assert.deepStrictEqual(rule.parse('  hi '), { value: 'hi' });
    assert.deepStrictEqual(rule.parse('a'.repeat(500)), { value: 'a'.repeat(500) });
    for (const bad of ['', '   ', 5, null, {}, 'a'.repeat(501)]) {
      assert.ok(rule.parse(bad).error);
    }
  });

  test('boolean is strict', () => {
    const rule = boolean();
    assert.deepStrictEqual(rule.parse(false), { value: false });
    for (const bad of ['true', 1, 0, null]) assert.ok(rule.parse(bad).error);
  });
});

describe('object schema', () => {
  const schema = object({ title: title({ required: true }), completed: boolean() });

  test('strips unknown keys and reports missing required fields', () => {
    assert.deepStrictEqual(schema({ title: 'x', extra: 1 }), { value: { title: 'x' }, errors: [] });
    assert.deepStrictEqual(schema({}).errors, [{ field: 'title', message: 'is required' }]);
  });

  test('rejects non-object input unless optional', () => {
    for (const bad of [undefined, null, [], 'str', 5]) {
      assert.strictEqual(schema(bad).errors.length, 1);
    }
    assert.deepStrictEqual(object({}, { optional: true })(undefined).errors, []);
    assert.strictEqual(object({}, { optional: true })(null).errors.length, 1);
  });
});

describe('validate middleware', () => {
  test('collects errors across locations and calls next with a ValidationError', () => {
    const mw = validate({
      params: object({ id: id({ required: true }) }),
      body: object({ title: title({ required: true }) }),
    });
    let err;
    mw({ params: { id: 'x' }, body: {} }, {}, (e) => (err = e));
    assert.ok(err instanceof ValidationError);
    assert.strictEqual(err.status, 400);
    assert.deepStrictEqual(err.details, [
      { location: 'params', field: 'id', message: 'must be an integer between 1 and 2147483647' },
      { location: 'body', field: 'title', message: 'is required' },
    ]);
  });

  test('sets req.validated with sanitized values on success', () => {
    const mw = validate({ params: object({ id: id({ required: true }) }) });
    const req = { params: { id: '7' } };
    let called;
    mw(req, {}, (e) => (called = e === undefined));
    assert.ok(called);
    assert.deepStrictEqual(req.validated, { params: { id: 7 }, query: {}, body: {} });
  });
});
