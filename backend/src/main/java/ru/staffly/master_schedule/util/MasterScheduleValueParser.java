package ru.staffly.master_schedule.util;

import ru.staffly.common.exception.ConflictException;

import java.math.BigDecimal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MasterScheduleValueParser {

    private static final Pattern MULTIPLY_PATTERN = Pattern.compile(
            "^\\s*(\\d+(?:[\\.,]\\d+)?)\\s*[x*×]\\s*(\\d+(?:[\\.,]\\d+)?)\\s*$",
            Pattern.CASE_INSENSITIVE
    );

    public record ParsedValue(String raw, BigDecimal valueNum, Integer unitsCount) {}

    public ParsedValue parse(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return new ParsedValue(raw, null, null);
        }

        String normalized = raw.trim().replace(",", ".");
        Matcher matcher = MULTIPLY_PATTERN.matcher(normalized);
        if (matcher.matches()) {
            BigDecimal units = parseDecimal(matcher.group(1), raw);
            BigDecimal value = parseDecimal(matcher.group(2), raw);
            Integer unitsCount = toInteger(units, raw);
            return new ParsedValue(raw, value, unitsCount);
        }

        BigDecimal value = parseDecimal(normalized, raw);
        return new ParsedValue(raw, value, null);
    }

    private BigDecimal parseDecimal(String value, String raw) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ex) {
            throw new ConflictException("Invalid value: " + raw);
        }
    }

    private Integer toInteger(BigDecimal value, String raw) {
        try {
            return value.toBigIntegerExact().intValueExact();
        } catch (ArithmeticException ex) {
            throw new ConflictException("Units count must be integer: " + raw);
        }
    }
}