package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import com.google.gson.JsonParser;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.*;
import java.io.*;
import java.sql.*;
import java.util.*;
import java.util.stream.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatHistoryPaginationTest {
    private Connection database;
    private String url;
    @BeforeEach void setup() throws Exception {
        url = "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL";
        database = DriverManager.getConnection(url);
        try (Statement s = database.createStatement()) {
            s.execute("CREATE TABLE users (id INT PRIMARY KEY, display_name VARCHAR(50), username VARCHAR(50), avatar VARCHAR(100))");
            s.execute("CREATE TABLE friends (user_id INT, friend_id INT)");
            s.execute("CREATE TABLE chat_messages (id BIGINT PRIMARY KEY, user_id INT, receiver_id INT, content VARCHAR(100), image_url VARCHAR(100), timestamp TIMESTAMP)");
            s.execute("INSERT INTO users(id, username) VALUES (7,'me'), (9,'friend'), (99,'other')");
            s.execute("INSERT INTO friends VALUES (9,7)");
            for (int id = 1; id <= 90; id++) {
                String pair = id % 3 == 0 ? "99,NULL" : id % 3 == 1 ? "7,9" : "9,7";
                s.execute("INSERT INTO chat_messages (id,user_id,receiver_id,content) VALUES (" + id + "," + pair + ",'message')");
            }
            s.execute("INSERT INTO chat_messages (id,user_id,receiver_id) VALUES (91,99,7)");
        }
    }
    @AfterEach void close() throws Exception { database.close(); }

    private record Page(List<Long> ids, String hasMore) {}
    private Page read(Map<String, String> parameters) throws Exception {
        var req = mock(HttpServletRequest.class);
        var resp = mock(HttpServletResponse.class);
        var session = mock(HttpSession.class);
        when(req.getSession(false)).thenReturn(session);
        when(session.getAttribute("userId")).thenReturn(7);
        when(req.getParameter(anyString())).thenAnswer(call -> parameters.get(call.getArgument(0)));
        StringWriter text = new StringWriter();
        when(resp.getWriter()).thenReturn(new PrintWriter(text));
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenAnswer(call -> DriverManager.getConnection(url));
            new GetMessagesServlet().doGet(req, resp);
        }
        verify(resp, never()).sendError(anyInt());
        var more = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(resp).setHeader(eq("X-Has-More"), more.capture());
        var json = JsonParser.parseString(text.toString()).getAsJsonArray();
        List<Long> ids = new ArrayList<>();
        json.forEach(item -> ids.add(item.getAsJsonObject().get("id").getAsLong()));
        return new Page(ids, more.getValue());
    }

    @Test void latestGroupPageIsBoundedAndHasNoFalseExtraPageAtExactLimit() throws Exception {
        Page group = read(Map.of("limit", "30"));
        assertEquals(LongStream.rangeClosed(1, 30).map(id -> id * 3).boxed().toList(), group.ids);
        assertEquals("false", group.hasMore);
    }

    @Test void privateHistoryPagesAreStableAcrossNewInsertsAndContainOnlyBothParticipants() throws Exception {
        Page latest = read(Map.of("chatWith", "9", "limit", "30"));
        assertEquals(30, latest.ids.size());
        assertEquals("true", latest.hasMore);
        try (Statement s = database.createStatement()) {
            s.execute("INSERT INTO chat_messages(id,user_id,receiver_id) VALUES(92,7,9)");
        }
        Page older = read(Map.of("chatWith", "9", "before", latest.ids.get(0).toString(), "limit", "30"));
        List<Long> all = new ArrayList<>(older.ids);
        all.addAll(latest.ids);
        assertEquals(LongStream.rangeClosed(1, 90).filter(id -> id % 3 != 0).boxed().toList(), all);
        assertEquals("false", older.hasMore);
        assertEquals(List.of(92L), read(Map.of("chatWith", "9", "after", "89")).ids);
    }

    @Test void incrementalAfterZeroStartsAtOldestAndCatchUpPagesDoNotSkipRows() throws Exception {
        Page first = read(Map.of("chatWith", "9", "after", "0", "limit", "30"));
        assertEquals(1L, first.ids.get(0));
        assertEquals("true", first.hasMore);
        Page second = read(Map.of("chatWith", "9", "after", first.ids.get(29).toString(), "limit", "30"));
        assertEquals("false", second.hasMore);
        assertEquals(89L, second.ids.get(29));
    }
}
