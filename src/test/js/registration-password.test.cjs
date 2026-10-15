const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../../main/webapp/js/registration-password-rules.js');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources/registration-password-cases.json'), 'utf8'));
test('registration rule results agree with all shared boundary cases', () => {
  for (const fixture of cases) {
    const actual = RegistrationPasswordRules.evaluate(fixture.password);
    if (fixture.rules) assert.deepEqual(actual.rules, fixture.rules, fixture.name);
    if (fixture.checks) for (const [index, expected] of Object.entries(fixture.checks)) {
      assert.equal(actual.rules[Number(index) - 1], expected, fixture.name + ', rule ' + index);
    }
    for (const key of ['length', 'digitSum', 'passes']) {
      if (key in fixture) assert.equal(actual[key], fixture[key], fixture.name + ', ' + key);
    }
  }
});
test('every full lowercase month and both Roman orders are recognized', () => {
  for (const month of ['january','february','march','april','may','june','july','august','september','october','november','december']) {
    assert.equal(RegistrationPasswordRules.evaluate(month).rules[5], true, month);
    assert.equal(RegistrationPasswordRules.evaluate(month.toUpperCase()).rules[5], false, month);
  }
});
