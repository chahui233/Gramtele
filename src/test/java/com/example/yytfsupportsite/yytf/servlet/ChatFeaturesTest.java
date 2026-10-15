package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import com.google.gson.JsonParser;
import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatFeaturesTest {
    private final HttpServletRequest req = mock(HttpServletRequest.class);
    private final HttpServletResponse resp = mock(HttpServletResponse.class);
    private final HttpSession session = mock(HttpSession.class);
    private final Connection conn = mock(Connection.class);
    private final PreparedStatement auth = mock(PreparedStatement.class);
    private final ResultSet authRows = mock(ResultSet.class);
    private final StringWriter body = new StringWriter();

    ChatFeaturesTest() throws Exception {
        when(req.getSession(false)).thenReturn(session);
        when(session.getAttribute("userId")).thenReturn(7);
        when(session.getAttribute("announcementToken")).thenReturn("login-token");
        when(req.getHeader("X-CSRF-Token")).thenReturn("login-token");
        when(req.getParameter("title")).thenReturn("标题");
        when(req.getParameter("content")).thenReturn("<script>alert(1)</script>\n正文");
        when(resp.getWriter()).thenReturn(new PrintWriter(body));
        when(conn.prepareStatement(startsWith("SELECT username"))).thenReturn(auth);
        when(auth.executeQuery()).thenReturn(authRows);
        when(authRows.next()).thenReturn(true);
    }

    @Test void ordinaryAccountCannotPublishEvenWithAdminDisplayNameOrFlag() throws Exception {
        when(session.getAttribute("username")).thenReturn("admin"); // stale/spoofed session is not authoritative
        when(session.getAttribute("isAdmin")).thenReturn(true);
        when(authRows.getString("username")).thenReturn("ordinary-user");
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(conn);
            new AnnouncementServlet().doPost(req, resp);
        }
        verify(resp).sendError(403);
        verify(conn, never()).prepareStatement(startsWith("INSERT"));
    }

    @Test void namedAdminCanPublishUsingParameterizedSql() throws Exception {
        when(authRows.getString("username")).thenReturn("admin");
        PreparedStatement insert = mock(PreparedStatement.class);
        when(conn.prepareStatement(startsWith("INSERT"))).thenReturn(insert);
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(conn);
            new AnnouncementServlet().doPost(req, resp);
        }
        verify(insert).setString(2, "<script>alert(1)</script>\n正文");
        verify(insert).setInt(3, 7);
        verify(insert).executeUpdate();
        verify(resp).setStatus(201);
    }

    @Test void missingTokenAndInvalidContentAreRejectedBeforeDatabaseAccess() throws Exception {
        try (var db = mockStatic(DBUtil.class)) {
            when(req.getHeader("X-CSRF-Token")).thenReturn(null);
            new AnnouncementServlet().doPost(req, resp);
            verify(resp).sendError(403);
            when(req.getHeader("X-CSRF-Token")).thenReturn("login-token");
            when(req.getParameter("title")).thenReturn("x".repeat(121));
            new AnnouncementServlet().doPost(req, resp);
            verify(resp).sendError(400);
            db.verifyNoInteractions();
        }
    }

    @Test void bannedAdminCannotPublish() throws Exception {
        when(authRows.getString("username")).thenReturn("admin");
        when(authRows.getBoolean("is_banned")).thenReturn(true);
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(conn);
            new AnnouncementServlet().doPost(req, resp);
        }
        verify(resp).sendError(403);
        verify(conn, never()).prepareStatement(startsWith("INSERT"));
    }

    @Test void anonymousCannotReadAnnouncementsOrPresence() throws Exception {
        when(req.getSession(false)).thenReturn(null);
        new AnnouncementServlet().doGet(req, resp);
        new OnlineUsersServlet().doGet(req, resp);
        verify(resp, times(2)).sendError(401);
    }

    @Test void presenceDeduplicatesUsersAndExpiresInactiveAndInvalidatedSessions() throws Exception {
        OnlineUsersServlet servlet = new OnlineUsersServlet();
        when(session.getId()).thenReturn("tab-session-a");
        when(session.getAttribute("username")).thenReturn("alice");
        servlet.doGet(req, resp);
        when(session.getId()).thenReturn("tab-session-b");
        servlet.doGet(req, resp);
        assertEquals(1, servlet.snapshot(System.currentTimeMillis()).size());
        assertEquals("alice", servlet.snapshot(System.currentTimeMillis()).get(0).get("name"));
        assertTrue(servlet.snapshot(System.currentTimeMillis() + 36000).isEmpty());
        servlet.doGet(req, resp);
        when(session.getAttribute("userId")).thenThrow(new IllegalStateException("Logged out"));
        assertTrue(servlet.snapshot(System.currentTimeMillis()).isEmpty());
    }

    @Test void privateHistoryIncludesBothDirectionsAndToleratesNullTimestamp() throws Exception {
        when(req.getParameter("chatWith")).thenReturn("9");
        when(req.getParameter("after")).thenReturn("20");
        PreparedStatement friends = mock(PreparedStatement.class), messages = mock(PreparedStatement.class);
        ResultSet friendship = mock(ResultSet.class), rows = mock(ResultSet.class);
        when(conn.prepareStatement(startsWith("SELECT 1 FROM friends"))).thenReturn(friends);
        when(friends.executeQuery()).thenReturn(friendship);
        when(friendship.next()).thenReturn(true);
        when(conn.prepareStatement(startsWith("SELECT c.id"))).thenReturn(messages);
        when(messages.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(true, false);
        when(rows.getLong("id")).thenReturn(21L);
        when(rows.getInt("user_id")).thenReturn(9);
        when(rows.getObject("receiver_id")).thenReturn(7);
        when(rows.getInt("receiver_id")).thenReturn(7);
        when(rows.getString("username")).thenReturn("friend");
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(conn);
            new GetMessagesServlet().doGet(req, resp);
            db.verify(DBUtil::getConnection, times(1));
        }
        verify(messages).setInt(1, 7); verify(messages).setInt(2, 9);
        verify(messages).setInt(3, 9); verify(messages).setInt(4, 7);
        verify(messages).setLong(5, 20);
        var result = JsonParser.parseString(body.toString()).getAsJsonArray().get(0).getAsJsonObject();
        assertEquals("", result.get("time").getAsString());
        assertEquals(21, result.get("id").getAsInt());
        verify(rows).close(); verify(messages).close(); verify(friends).close(); verify(conn).close();
    }

    @Test void nonFriendCannotReadHistory() throws Exception {
        when(req.getParameter("chatWith")).thenReturn("9");
        when(conn.prepareStatement(startsWith("SELECT 1 FROM friends"))).thenReturn(auth);
        when(authRows.next()).thenReturn(false);
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(conn);
            new GetMessagesServlet().doGet(req, resp);
        }
        verify(resp).sendError(403);
        verify(conn, never()).prepareStatement(startsWith("SELECT c.id"));
    }

    @Test void databaseFailureIsLoggedAndReturnsRetryableStatus() throws Exception {
        ServletConfig config = mock(ServletConfig.class);
        ServletContext context = mock(ServletContext.class);
        when(config.getServletContext()).thenReturn(context);
        GetMessagesServlet servlet = new GetMessagesServlet();
        servlet.init(config);
        SQLException problem = new SQLException("temporarily unavailable");
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenThrow(problem);
            servlet.doGet(req, resp);
        }
        verify(resp).sendError(503);
        verify(context).log(startsWith("Chat history load failed"), same(problem));
    }
}
