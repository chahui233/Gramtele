package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import com.google.gson.JsonParser;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatSendTest {
    @Test void ajaxSendReturnsSavedMessageAndNeverRedirects() throws Exception {
        for (int peer : new int[]{-1, 9}) {
            var req = mock(HttpServletRequest.class);
            var resp = mock(HttpServletResponse.class);
            var session = mock(HttpSession.class);
            var connection = mock(Connection.class);
            var insert = mock(PreparedStatement.class);
            var friends = mock(PreparedStatement.class);
            var result = mock(ResultSet.class);
            when(req.getSession(false)).thenReturn(session);
            when(session.getAttribute("userId")).thenReturn(7);
            when(session.getAttribute("username")).thenReturn("alice");
            when(req.getHeader("Accept")).thenReturn("application/json");
            when(req.getParameter("chatWithId")).thenReturn(String.valueOf(peer));
            when(req.getParameter("content")).thenReturn("hello <world>");
            when(connection.prepareStatement(anyString(), eq(Statement.RETURN_GENERATED_KEYS))).thenReturn(insert);
            when(connection.prepareStatement(startsWith("SELECT 1 FROM friends"))).thenReturn(friends);
            when(friends.executeQuery()).thenReturn(result);
            when(insert.getGeneratedKeys()).thenReturn(result);
            when(result.next()).thenReturn(true);
            when(result.getLong(1)).thenReturn(123L);
            var body = new StringWriter();
            when(resp.getWriter()).thenReturn(new PrintWriter(body));
            try (var db = mockStatic(DBUtil.class)) {
                db.when(DBUtil::getConnection).thenReturn(connection);
                new ChatServlet().doPost(req, resp);
            }
            verify(resp).setStatus(201);
            verify(resp, never()).sendRedirect(anyString());
            verify(insert, times(1)).executeUpdate();
            var json = JsonParser.parseString(body.toString()).getAsJsonObject();
            assertEquals(123, json.get("id").getAsInt());
            assertEquals(peer, json.get("chatWith").getAsInt());
            assertEquals(7, json.get("senderId").getAsInt());
            assertEquals("hello <world>", json.get("content").getAsString());
        }
    }

    @Test void anonymousEmptyAndMalformedRecipientRequestsCannotInsertOrRedirect() throws Exception {
        var req = mock(HttpServletRequest.class);
        var resp = mock(HttpServletResponse.class);
        var session = mock(HttpSession.class);
        try (var db = mockStatic(DBUtil.class)) {
            new ChatServlet().doPost(req, resp);
            verify(resp).sendError(401);
            when(req.getSession(false)).thenReturn(session);
            when(session.getAttribute("userId")).thenReturn(7);
            new ChatServlet().doPost(req, resp);
            verify(resp).sendError(eq(400), anyString());
            when(req.getParameter("content")).thenReturn("hello");
            when(req.getParameter("chatWithId")).thenReturn("not-a-number");
            new ChatServlet().doPost(req, resp);
            verify(resp).sendError(400);
            verify(resp, never()).sendRedirect(anyString());
            db.verifyNoInteractions();
        }
    }
}
