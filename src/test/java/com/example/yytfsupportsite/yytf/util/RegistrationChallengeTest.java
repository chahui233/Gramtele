package com.example.yytfsupportsite.yytf.util;

import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistrationChallengeTest {
    @Test void digestAgreesWithBrowserUtf8IncludingUnicodeAndMalformedSurrogates() {
        String salt = "0123456789abcdef0123456789abcdef";
        assertEquals("9414090ea3cb35e5a37e6db620259d74406d4ef69dd8490b47a5ac444c214cfc",
                RegistrationChallenge.digest(salt,"V-VII-may-2024-6-29aaaaaaaaa😀"));
        assertEquals("84f33dee3b22b733e4f33323567f7fb2a58f752bf6eae8dbdc573bc2e9ba0ffa",
                RegistrationChallenge.digest(salt,"中文😀e\u0301"));
        assertEquals("9799966d76ab6d9e87ceb0dedf833e068a37237683bb92242d0f70c0d868fd57",
                RegistrationChallenge.digest(salt,"\ud800x\udc00"));
    }

    @Test void generatedWitnessesSatisfyEveryOriginalRuleAndFitLoginInputLimit() {
        for (int i=0;i<25;i++) {
            String witness=RegistrationChallenge.witness();
            assertTrue(RegistrationPasswordRules.evaluate(witness).passes());
            assertEquals(127,witness.length());
        }
    }

    @Test void refreshKeepsTheChallengeAndExpirationReplacesItAtTheBoundary() {
        var session=mock(HttpSession.class);
        Map<String,Object> attributes=new HashMap<>();
        when(session.getAttribute(anyString())).thenAnswer(inv->attributes.get(inv.getArgument(0)));
        doAnswer(inv->{attributes.put(inv.getArgument(0),inv.getArgument(1));return null;})
                .when(session).setAttribute(anyString(),any());
        var initial=RegistrationChallenge.current(session,1000);
        assertEquals(1000+RegistrationChallenge.LIFETIME_MILLIS,initial.expiresAt());
        assertEquals(12,initial.prefix().length());
        assertSame(initial,RegistrationChallenge.current(session,initial.expiresAt()-1));
        assertNotSame(initial,RegistrationChallenge.current(session,initial.expiresAt()));
    }

    @Test void targetCannotBeEmptyShortOrContainMarkup() {
        assertThrows(IllegalArgumentException.class,()->new RegistrationChallenge.Challenge("a".repeat(32),"b".repeat(32),"",1));
        assertThrows(IllegalArgumentException.class,()->new RegistrationChallenge.Challenge("a".repeat(32),"b".repeat(32),"0".repeat(11),1));
        assertThrows(IllegalArgumentException.class,()->new RegistrationChallenge.Challenge("<script>","b".repeat(32),"0".repeat(12),1));
    }
}
