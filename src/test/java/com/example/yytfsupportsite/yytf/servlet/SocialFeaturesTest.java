package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import com.google.gson.*;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.*;
import org.h2.tools.RunScript;
import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SocialFeaturesTest {
    private Connection c;
    private String url;
    @BeforeEach void setup() throws Exception {
        url = "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;LOCK_TIMEOUT=10000";
        c = DriverManager.getConnection(url);
        try (Statement s = c.createStatement()) {
            s.execute("CREATE TABLE users(id INT PRIMARY KEY, username VARCHAR(40), display_name VARCHAR(80), avatar VARCHAR(200), signature VARCHAR(200) DEFAULT '', ipaddress VARCHAR(45), password VARCHAR(500), is_banned BOOLEAN DEFAULT FALSE, is_admin BOOLEAN DEFAULT FALSE)");
            s.execute("CREATE TABLE friends(user_id INT,friend_id INT, UNIQUE(user_id,friend_id))");
            s.execute("CREATE TABLE chat_messages(id BIGINT PRIMARY KEY,user_id INT,receiver_id INT,content VARCHAR(4000), image_url VARCHAR(200),timestamp TIMESTAMP,deleted INT DEFAULT 0)");
            s.execute("INSERT INTO users(id,username,password) VALUES(7,'alice','pw'),(9,'bob','pw'),(11,'eve','pw')");
        }
        try (Reader reader = Files.newBufferedReader(Path.of("db/friend-requests.sql"))) { RunScript.execute(c, reader); }
    }
    @AfterEach void close() throws Exception { c.close(); }
    long scalar(String sql) throws Exception {
        try (var s = c.createStatement(); var r = s.executeQuery(sql)) { r.next(); return r.getLong(1); }
    }
    long requestId() throws Exception { return scalar("SELECT MAX(id) FROM friend_requests"); }
    void message(long id, int sender, Integer receiver) throws Exception {
        try (var ps = c.prepareStatement("INSERT INTO chat_messages(id,user_id,receiver_id) VALUES(?,?,?)")) {
            ps.setLong(1,id); ps.setInt(2,sender); ps.setObject(3,receiver); ps.executeUpdate();
        }
    }
    JsonObject snapshot(UnreadMessages state) throws Exception { return new Gson().toJsonTree(state.snapshot(c,7)).getAsJsonObject(); }
    long group(UnreadMessages state) throws Exception { return snapshot(state).get("groupUnread").getAsLong(); }
    long privateCount(UnreadMessages state) throws Exception {
        return snapshot(state).getAsJsonArray("friends").get(0).getAsJsonObject().get("unread").getAsLong();
    }

    @Test void sendingOnlyCreatesPendingAndCrossRequestsStillRequireAcceptance() throws Exception {
        assertEquals("invalid", FriendRequests.send(c,7,7));
        assertEquals("invalid", FriendRequests.send(c,7,404));
        assertEquals("success", FriendRequests.send(c,7,9));
        assertEquals("pending", FriendRequests.send(c,7,9));
        assertEquals("incoming", FriendRequests.send(c,9,7));
        assertEquals(0,scalar("SELECT COUNT(*) FROM friends"));
        assertEquals(1,scalar("SELECT COUNT(*) FROM friend_requests"));
        assertEquals(1,FriendRequests.pendingCount(c,9));
        assertEquals(0,FriendRequests.pendingCount(c,7));
        assertEquals("missing", FriendRequests.respond(c,7,requestId(),true));
        assertEquals("missing", FriendRequests.respond(c,11,requestId(),true));
        assertEquals("accepted", FriendRequests.respond(c,9,requestId(),true));
        assertEquals(2,scalar("SELECT COUNT(*) FROM friends"));
        assertEquals(0,FriendRequests.pendingCount(c,9));
        assertEquals("already",FriendRequests.send(c,7,9));
        assertEquals("resolved",FriendRequests.respond(c,9,requestId(),true));
        assertEquals(2,scalar("SELECT COUNT(*) FROM friends"));
    }

    @Test void rejectionAndDeletionDoNotAllowReplayingOldAcceptToRecreateFriendships() throws Exception {
        FriendRequests.send(c,7,9);
        long first = requestId();
        assertEquals("rejected",FriendRequests.respond(c,9,first,false));
        assertFalse(FriendRequests.areFriends(c,7,9));
        FriendRequests.send(c,7,9);
        long second = requestId();
        assertTrue(second > first);
        assertEquals("resolved",FriendRequests.respond(c,9,first,true));
        FriendRequests.respond(c,9,second,true);
        FriendRequests.delete(c,7,9);
        assertEquals("resolved",FriendRequests.respond(c,9,second,true));
        assertFalse(FriendRequests.areFriends(c,7,9));
        FriendRequests.send(c,7,9);
        long third = requestId();
        FriendRequests.delete(c,7,9);
        assertEquals("resolved",FriendRequests.respond(c,9,third,true));
        assertFalse(FriendRequests.areFriends(c,7,9));
    }

    @Test void failedAcceptanceRollsBackBothFriendshipAndRequestState() throws Exception {
        FriendRequests.send(c,7,9);
        try (var s = c.createStatement()) { s.execute("ALTER TABLE friends ADD CONSTRAINT reject_second CHECK(user_id<>9)"); }
        assertThrows(SQLException.class, () -> FriendRequests.respond(c,9,requestId(),true));
        assertEquals(0,scalar("SELECT COUNT(*) FROM friends"));
        assertEquals(1,FriendRequests.pendingCount(c,9));
    }

    @Test void concurrentRequestsAndAcceptsAreIdempotent() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch go = new CountDownLatch(1);
            Callable<String> send = () -> { go.await(); try (var db = DriverManager.getConnection(url)) { return FriendRequests.send(db,7,9); } };
            Future<String> a = pool.submit(send), b = pool.submit(send); go.countDown();
            assertEquals(Set.of("success","pending"), Set.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS)));
            long id = requestId();
            Callable<String> accept = () -> { try (var db = DriverManager.getConnection(url)) { return FriendRequests.respond(db,9,id,true); } };
            a = pool.submit(accept); b = pool.submit(accept);
            assertEquals(Set.of("accepted","resolved"), Set.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS)));
            assertEquals(1,scalar("SELECT COUNT(*) FROM friend_requests"));
            assertEquals(2,scalar("SELECT COUNT(*) FROM friends"));
        } finally { pool.shutdownNow(); }
    }

    @Test void inboxIsRecipientScopedAndPaginatesWithoutSkippingOlderPendingRequests() throws Exception {
        for (int i=0;i<52;i++) {
            try (var s=c.createStatement()) { s.execute("INSERT INTO friend_requests(sender_id,recipient_id) VALUES(7,9)"); }
        }
        try (var s=c.createStatement()) { s.execute("INSERT INTO friend_requests(sender_id,recipient_id) VALUES(9,11)"); }
        var page = FriendRequests.inbox(c,9,Long.MAX_VALUE);
        assertEquals(50,page.size());
        var older = FriendRequests.inbox(c,9,(long)page.get(49).get("id"));
        assertEquals(2,older.size());
        assertEquals(1,FriendRequests.inbox(c,11,Long.MAX_VALUE).size());
        assertTrue(FriendRequests.inbox(c,7,Long.MAX_VALUE).isEmpty());
    }

    @Test void unreadStartsAtLoginExcludesOwnDeletedUnrelatedAndUnacceptedPrivateMessages() throws Exception {
        message(100,9,null);
        UnreadMessages state = UnreadMessages.start(c);
        FriendRequests.send(c,7,9); FriendRequests.respond(c,9,requestId(),true);
        message(101,9,null); message(102,7,null); message(103,9,7);
        message(104,7,9); message(105,11,7); message(106,9,11); message(107,11,null);
        message(108,9,null);
        try (var s=c.createStatement()) { s.execute("UPDATE chat_messages SET deleted=1 WHERE id=108"); }
        assertEquals(2,group(state)); assertEquals(1,privateCount(state));
        assertEquals(2,group(state)); // Reads/polls don't mutate the count.
        assertTrue(state.markRead(c,7,-1,101));
        assertEquals(1,group(state)); // A later arrival wasn't acknowledged by the older response.
        assertTrue(state.markRead(c,7,-1,100)); assertEquals(1,group(state)); // Never rewind.
        assertFalse(state.markRead(c,7,11,107));
        state.markRead(c,7,9,103); assertEquals(0,privateCount(state)); assertEquals(1,group(state));
        state.markRead(c,7,-1,Long.MAX_VALUE);
        message(109,9,null);
        assertEquals(1,group(state)); // Client cannot mark future IDs as read.
        UnreadMessages nextLogin = UnreadMessages.start(c);
        assertEquals(0,group(nextLogin)); assertEquals(0,privateCount(nextLogin));
    }

    @Test void incomingAlertCursorSurvivesReadAcknowledgementAndExcludesUnrelatedMessages() throws Exception {
        message(100,9,null);
        UnreadMessages state = UnreadMessages.start(c);
        assertEquals(100L,state.snapshot(c,7).get("latestIncoming"));
        FriendRequests.send(c,7,9); FriendRequests.respond(c,9,requestId(),true);
        message(101,9,null); message(102,9,7);
        state.markRead(c,7,-1,101); state.markRead(c,7,9,102);
        assertEquals(0,group(state)); assertEquals(0,privateCount(state));
        assertEquals(102L,state.snapshot(c,7).get("latestIncoming"));
        assertEquals(100L,state.snapshot(c,7).get("loginCursor"));
        message(103,7,null); message(104,9,11); message(105,11,7); message(106,9,null);
        try (var s=c.createStatement()) { s.execute("UPDATE chat_messages SET deleted=1 WHERE id=106"); }
        assertEquals(102L,state.snapshot(c,7).get("latestIncoming"));
        message(107,11,null);
        assertEquals(107L,state.snapshot(c,7).get("latestIncoming"));
    }

    @Test void loginCreatesBaselineBeforeUserVisitsChatAndRetainsItAcrossSessionLookups() throws Exception {
        message(10,9,null);
        var req=mock(HttpServletRequest.class); var resp=mock(HttpServletResponse.class); var session=mock(HttpSession.class);
        Map<String,Object> attributes = new HashMap<>();
        when(req.getParameter("username")).thenReturn("alice"); when(req.getParameter("password")).thenReturn("pw");
        when(req.getSession(true)).thenReturn(session); when(req.getContextPath()).thenReturn("/test");
        doAnswer(inv -> { attributes.put(inv.getArgument(0),inv.getArgument(1)); return null; }).when(session).setAttribute(anyString(),any());
        when(session.getAttribute(anyString())).thenAnswer(inv -> attributes.get(inv.getArgument(0)));
        try (var db=mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenAnswer(inv -> DriverManager.getConnection(url));
            new LoginServlet().doPost(req,resp);
        }
        verify(resp).sendRedirect("/test/home.jsp");
        message(11,9,null);
        var state=UnreadMessages.from(session,c);
        assertEquals(1,group(state));
        assertSame(state,UnreadMessages.from(session,c));
    }

    @Test void mutationEndpointsRequireLoginAndTokenAndPendingCannotReadPrivateHistory() throws Exception {
        var req=mock(HttpServletRequest.class); var resp=mock(HttpServletResponse.class); var session=mock(HttpSession.class);
        try (var db=mockStatic(DBUtil.class)) {
            new AddFriendServlet().doPost(req,resp);
            verify(resp).sendError(401);
            when(req.getSession(false)).thenReturn(session);
            when(session.getAttribute("userId")).thenReturn(7);
            new FriendRequestServlet().doPost(req,resp);
            new ChatStateServlet().doPost(req,resp);
            new DeleteFriendServlet().doPost(req,resp);
            verify(resp,times(3)).sendError(403);
            db.verifyNoInteractions();
        }
        FriendRequests.send(c,7,9);
        when(req.getParameter("chatWith")).thenReturn("9");
        try (var db=mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenAnswer(inv -> DriverManager.getConnection(url));
            new GetMessagesServlet().doGet(req,resp);
        }
        verify(resp,times(4)).sendError(403);
    }

    @Test void bannedUsersCannotSendOrAcceptRequests() throws Exception {
        FriendRequests.send(c,7,9);
        try (var s=c.createStatement()) { s.execute("UPDATE users SET is_banned=TRUE WHERE id=7"); }
        assertEquals("invalid",FriendRequests.respond(c,9,requestId(),true));
        assertEquals("invalid",FriendRequests.send(c,7,11));
        assertFalse(FriendRequests.areFriends(c,7,9));
        assertEquals("rejected",FriendRequests.respond(c,9,requestId(),false));
    }
}
