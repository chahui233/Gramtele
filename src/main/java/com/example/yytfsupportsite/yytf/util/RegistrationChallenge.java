package com.example.yytfsupportsite.yytf.util;

import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.security.*;
import java.util.HexFormat;

/** Public proof-of-work puzzle, separate from the PBKDF2 hash used to store actual passwords. */
public final class RegistrationChallenge {
    public static final String SESSION_KEY = "registrationChallenge";
    public static final long LIFETIME_MILLIS = 30 * 60 * 1000L;
    public static final int PREFIX_LENGTH = 12; // 48 bits, about 1 in 281 trillion per candidate.
    private static final SecureRandom RANDOM = new SecureRandom();
    private RegistrationChallenge() {}

    public record Challenge(String id, String salt, String prefix, long expiresAt) implements Serializable {
        public Challenge {
            if (id == null || !id.matches("[0-9a-f]{32}") || salt == null || !salt.matches("[0-9a-f]{32}")
                    || prefix == null || !prefix.matches("[0-9a-f]{" + PREFIX_LENGTH + "}"))
                throw new IllegalArgumentException("Invalid registration challenge");
        }
        public boolean expired(long now) { return now >= expiresAt; }
        public boolean matches(String password) { return digest(salt, password).startsWith(prefix); }
    }

    public static Challenge current(HttpSession session, long now) {
        synchronized (session) {
            Challenge challenge = (Challenge) session.getAttribute(SESSION_KEY);
            if (challenge == null || challenge.expired(now)) {
                challenge = issue(now);
                session.setAttribute(SESSION_KEY, challenge);
            }
            return challenge;
        }
    }

    public static Challenge issue(long now) {
        String salt = randomHex(16);
        // Derive the target from a randomly generated valid witness so every puzzle has a solution.
        // The witness is never returned, logged or retained in the session.
        String prefix = digest(salt, witness()).substring(0, PREFIX_LENGTH);
        return new Challenge(randomHex(16), salt, prefix, now + LIFETIME_MILLIS);
    }

    static String witness() {
        StringBuilder password = new StringBuilder("V-VII-may-2024-7-127-");
        while (password.length() < 127) password.append((char) ('a' + RANDOM.nextInt(26)));
        return password.toString();
    }

    private static String randomHex(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return HexFormat.of().formatHex(value);
    }

    /** UTF-8 of salt + LF + password; malformed surrogates use U+FFFD, matching browser TextEncoder. */
    public static String digest(String salt, String password) {
        try {
            var bytes = StandardCharsets.UTF_8.newEncoder()
                    .onMalformedInput(CodingErrorAction.REPLACE).onUnmappableCharacter(CodingErrorAction.REPLACE)
                    .replaceWith(new byte[]{(byte) 0xef, (byte) 0xbf, (byte) 0xbd})
                    .encode(CharBuffer.wrap(salt + "\n" + password));
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(bytes);
            return HexFormat.of().formatHex(sha.digest());
        } catch (GeneralSecurityException | CharacterCodingException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
