package com.example.yytfsupportsite.yytf.util;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
public final class Passwords {
    private static final int ITERATIONS = 600_000;
    private Passwords() {}
    public static boolean isHash(String value) { return value != null && value.startsWith("pbkdf2$"); }
    public static String hash(String password) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        return "pbkdf2$" + ITERATIONS + "$" + Base64.getEncoder().encodeToString(salt)
                + "$" + Base64.getEncoder().encodeToString(derive(password, salt, ITERATIONS));
    }
    public static boolean verify(String password, String stored) {
        if (password == null || stored == null) return false;
        if (!isHash(stored)) {
            // Upgrade legacy plaintext records immediately after successful login.
            return MessageDigest.isEqual(password.getBytes(StandardCharsets.UTF_8), stored.getBytes(StandardCharsets.UTF_8));
        }
        try {
            String[] parts = stored.split("\\$");
            if (parts.length != 4) return false;
            int rounds = Integer.parseInt(parts[1]);
            if (rounds < 100_000 || rounds > 2_000_000) return false;
            return MessageDigest.isEqual(Base64.getDecoder().decode(parts[3]),
                    derive(password, Base64.getDecoder().decode(parts[2]), rounds));
        } catch (IllegalArgumentException e) { return false; }
    }
    private static byte[] derive(String password, byte[] salt, int rounds) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, rounds, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
        finally { spec.clearPassword(); }
    }
}
