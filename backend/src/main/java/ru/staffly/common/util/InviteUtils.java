package ru.staffly.common.util;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

public final class InviteUtils {
    private static final SecureRandom RNG = new SecureRandom();

    // Попроще и надёжнее для валидации: без «умных» кавычек и экзотики
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    // E.164 (очень грубо): + и 7..15 цифр
    private static final Pattern PHONE = Pattern.compile("^\\+?\\d{7,15}$");

    public static final int INVITE_TOKEN_BYTES = 24; // ~32 символа base64url

    private InviteUtils() {}

    /** Генерация токена с дефолтной длиной. */
    public static String genToken() {
        return genToken(INVITE_TOKEN_BYTES);
    }

    /** Генерация URL-безопасного токена из N случайных байт. */
    public static String genToken(int bytes) {
        if (bytes <= 0) throw new IllegalArgumentException("bytes must be > 0");
        byte[] buf = new byte[bytes];
        RNG.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    public static boolean isEmail(String s) {
        return s != null && EMAIL.matcher(s.trim().toLowerCase()).matches();
    }

    public static boolean isPhone(String s) {
        return s != null && PHONE.matcher(s.trim()).matches();
    }

    /** Допускаем email ИЛИ телефон. */
    public static boolean isValidContact(String s) {
        return isEmail(s) || isPhone(s);
    }

    public static String normalizeEmail(String s) {
        return s == null ? null : s.trim().toLowerCase();
    }

    public static String normalizePhone(String s) {
        return s == null ? null : s.trim();
        // при желании позже: убрать пробелы/дефисы, привести к E.164 и т.п.
    }
}