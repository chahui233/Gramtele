package com.example.yytfsupportsite.yytf.util;

import java.util.*;
import java.util.regex.*;

/** Registration-only puzzle rules. Existing accounts retain their current passwords. */
public final class RegistrationPasswordRules {
    private RegistrationPasswordRules() {}
    private static final Pattern DIGITS = Pattern.compile("[0-9]");
    private static final Pattern UPPERCASE = Pattern.compile("[A-Z]");
    private static final Pattern SPECIAL = Pattern.compile("[\\p{P}\\p{S}]");
    private static final Pattern MONTH = Pattern.compile(
            "january|february|march|april|may|june|july|august|september|october|november|december");
    private static final Pattern ROMAN_CANDIDATE = Pattern.compile("[IVXLCDM]+");
    private static final Pattern ROMAN_STANDARD = Pattern.compile(
            "M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})");
    private static final Pattern YEAR = Pattern.compile("(?<![0-9])[1-9][0-9]{3}(?![0-9])");

    public record Result(List<Boolean> rules, int length, int digitSum) {
        public boolean passes() { return rules.stream().allMatch(Boolean::booleanValue); }
    }

    public static Result evaluate(String password) {
        String text = password == null ? "" : password;
        int length = text.codePointCount(0, text.length());
        int sum = text.chars().filter(c -> c >= '0' && c <= '9').map(c -> c - '0').sum();
        List<Integer> romans = new ArrayList<>();
        // Symbols and spaces delimit tokens. Adjacent letters, marks or digits
        // are part of the same token, so AV and VII2 are not independent numerals.
        for (String token : text.split("[^\\p{L}\\p{N}\\p{M}]+")) {
            if (ROMAN_CANDIDATE.matcher(token).matches()) {
                romans.add(ROMAN_STANDARD.matcher(token).matches() ? romanValue(token) : 0);
            }
        }
        boolean romanProduct = romans.size() == 2 && romans.get(0) * romans.get(1) == 35;
        boolean leapYear = false;
        Matcher years = YEAR.matcher(text);
        while (years.find()) {
            int year = Integer.parseInt(years.group());
            if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) { leapYear = true; break; }
        }
        return new Result(List.of(length >= 5, DIGITS.matcher(text).find(), UPPERCASE.matcher(text).find(),
                SPECIAL.matcher(text).find(), sum == 25, MONTH.matcher(text).find(), romanProduct,
                leapYear, text.contains(Integer.toString(length)), isPrime(length)), length, sum);
    }

    private static int romanValue(String token) {
        int total = 0, previous = 0;
        for (int i = token.length() - 1; i >= 0; i--) {
            int value = switch (token.charAt(i)) {
                case 'I' -> 1; case 'V' -> 5; case 'X' -> 10; case 'L' -> 50;
                case 'C' -> 100; case 'D' -> 500; case 'M' -> 1000;
                default -> 0;
            };
            total += value < previous ? -value : value;
            previous = value;
        }
        return total;
    }

    private static boolean isPrime(int number) {
        if (number < 2) return false;
        for (int divisor = 2; divisor <= number / divisor; divisor++) {
            if (number % divisor == 0) return false;
        }
        return true;
    }
}
