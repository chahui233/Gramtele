package com.example.yytfsupportsite.yytf.util;

import com.google.gson.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import static org.junit.jupiter.api.Assertions.*;

class RegistrationPasswordRulesTest {
    @Test void matchesSharedBoundaryCases() throws Exception {
        try (var reader = new InputStreamReader(Objects.requireNonNull(getClass().getResourceAsStream(
                "/registration-password-cases.json")), StandardCharsets.UTF_8)) {
            for (JsonElement element : JsonParser.parseReader(reader).getAsJsonArray()) {
                JsonObject fixture = element.getAsJsonObject();
                String name = fixture.get("name").getAsString();
                var result = RegistrationPasswordRules.evaluate(fixture.get("password").getAsString());
                if (fixture.has("rules")) {
                    for (int index = 0; index < 10; index++) assertEquals(fixture.getAsJsonArray("rules").get(index).getAsBoolean(),
                            result.rules().get(index), name + ", rule " + (index + 1));
                }
                if (fixture.has("checks")) fixture.getAsJsonObject("checks").entrySet().forEach(entry ->
                        assertEquals(entry.getValue().getAsBoolean(), result.rules().get(Integer.parseInt(entry.getKey()) - 1), name));
                if (fixture.has("length")) assertEquals(fixture.get("length").getAsInt(), result.length(), name);
                if (fixture.has("digitSum")) assertEquals(fixture.get("digitSum").getAsInt(), result.digitSum(), name);
                if (fixture.has("passes")) assertEquals(fixture.get("passes").getAsBoolean(), result.passes(), name);
            }
        }
    }
    @Test void recognizesAllFullLowercaseMonths() {
        for (String month : new String[]{"january","february","march","april","may","june","july","august","september","october","november","december"}) {
            assertTrue(RegistrationPasswordRules.evaluate(month).rules().get(5), month);
            assertFalse(RegistrationPasswordRules.evaluate(month.toUpperCase(java.util.Locale.ROOT)).rules().get(5), month);
        }
    }
}
