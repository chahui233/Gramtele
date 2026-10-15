/* Keep these pure rules aligned with RegistrationPasswordRules.java and the shared test fixtures. */
(() => {
  'use strict';
  const standardRoman = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  const romanValues = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  function romanValue(token) {
    if (!standardRoman.test(token)) return 0;
    let total = 0, previous = 0;
    for (const symbol of [...token].reverse()) {
      const value = romanValues[symbol];
      total += value < previous ? -value : value;
      previous = value;
    }
    return total;
  }
  function isPrime(number) {
    if (number < 2) return false;
    for (let divisor = 2; divisor <= number / divisor; divisor++) {
      if (number % divisor === 0) return false;
    }
    return true;
  }
  function evaluate(password) {
    const text = password || '';
    const length = [...text].length;
    const digits = text.match(/[0-9]/g) || [];
    const digitSum = digits.reduce((sum, digit) => sum + Number(digit), 0);
    const romans = text.split(/[^\p{L}\p{N}\p{M}]+/u).filter(token => /^[IVXLCDM]+$/.test(token)).map(romanValue);
    const years = text.match(/[0-9]+/g) || [];
    const leapYear = years.some(token => {
      const year = Number(token);
      return /^[1-9][0-9]{3}$/.test(token) && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    });
    const rules = [
      length >= 5,
      digits.length > 0,
      /[A-Z]/.test(text),
      /[\p{P}\p{S}]/u.test(text),
      digitSum === 25,
      /january|february|march|april|may|june|july|august|september|october|november|december/.test(text),
      romans.length === 2 && romans[0] * romans[1] === 35,
      leapYear,
      text.includes(String(length)),
      isPrime(length)
    ];
    return { rules, length, digitSum, passes: rules.every(Boolean) };
  }
  globalThis.RegistrationPasswordRules = Object.freeze({ evaluate });
})();
