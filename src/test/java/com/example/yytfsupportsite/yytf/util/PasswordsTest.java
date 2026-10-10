package com.example.yytfsupportsite.yytf.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordsTest {
    @Test
    void hashesVerifyWithoutStoringPlaintext() {
        String hash = Passwords.hash("correct horse battery staple");
        assertTrue(Passwords.isHash(hash));
        assertTrue(Passwords.verify("correct horse battery staple", hash));
        assertFalse(Passwords.verify("wrong password", hash));
        assertNotEquals("correct horse battery staple", hash);
    }

    @Test
    void legacyPlaintextCanBeVerifiedForMigration() {
        assertTrue(Passwords.verify("legacy", "legacy"));
        assertFalse(Passwords.verify("other", "legacy"));
    }
}
