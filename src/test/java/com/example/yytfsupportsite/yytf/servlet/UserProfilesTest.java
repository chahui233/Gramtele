package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import com.google.gson.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.*;
import org.h2.tools.RunScript;
import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserProfilesTest {
    Connection c;
    String url;
    HttpServletRequest req;
    HttpServletResponse resp;
    HttpSession session;
    StringWriter output;

    @BeforeEach void setup() throws Exception {
        url = "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL";
        c = DriverManager.getConnection(url);
        try (var s = c.createStatement()) {
            s.execute("CREATE TABLE users(id INT PRIMARY KEY,username VARCHAR(50),display_name VARCHAR(50),avatar VARCHAR(200),signature VARCHAR(200) DEFAULT '',ipaddress VARCHAR(45),password VARCHAR(500),is_banned INT DEFAULT 0,is_admin INT DEFAULT 0)");
            s.execute("CREATE TABLE friends(user_id INT,friend_id INT,UNIQUE(user_id,friend_id))");
            s.execute("CREATE TABLE chat_messages(id BIGINT PRIMARY KEY,user_id INT,receiver_id INT,deleted INT DEFAULT 0)");
            s.execute("CREATE TABLE posts(id INT PRIMARY KEY,user_id INT,content VARCHAR(500),created_at TIMESTAMP)");
            s.execute("INSERT INTO users(id,username,password,avatar,ipaddress) VALUES(7,'alice','pw','/avatar/a.png','192.0.2.1'),(9,'bob','pw','/avatar/b.png',NULL),(11,'eve','pw',NULL,NULL)");
        }
        try (Reader r = Files.newBufferedReader(Path.of("db/friend-requests.sql"))) { RunScript.execute(c,r); }
        resetRequest();
    }
    @AfterEach void close() throws Exception { c.close(); }
    void resetRequest() throws Exception {
        req = mock(HttpServletRequest.class); resp = mock(HttpServletResponse.class); session = mock(HttpSession.class);
        when(req.getSession()).thenReturn(session); when(req.getSession(false)).thenReturn(session); when(req.getSession(true)).thenReturn(session);
        when(session.getAttribute("userId")).thenReturn(7); when(req.getContextPath()).thenReturn("/test");
        when(req.getRequestDispatcher(anyString())).thenReturn(mock(RequestDispatcher.class));
        output = new StringWriter(); when(resp.getWriter()).thenReturn(new PrintWriter(output));
    }
    void call(HttpServlet servlet, boolean post) throws Exception {
        ServletConfig config = mock(ServletConfig.class); when(config.getServletContext()).thenReturn(mock(ServletContext.class)); servlet.init(config);
        when(req.getMethod()).thenReturn(post ? "POST" : "GET");
        when(req.getProtocol()).thenReturn("HTTP/1.1");
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenAnswer(inv -> DriverManager.getConnection(url));
            servlet.service(req,resp);
        }
    }
    String field(String column, int id) throws Exception {
        try (var s = c.createStatement(); var r = s.executeQuery("SELECT " + column + " FROM users WHERE id=" + id)) { r.next(); return r.getString(1); }
    }
    JsonObject profile(int id) throws Exception {
        resetRequest(); when(req.getParameter("userId")).thenReturn(String.valueOf(id));
        call(new UserProfileServlet(),false);
        return JsonParser.parseString(output.toString()).getAsJsonObject();
    }
    long requestId() throws Exception {
        try (var s=c.createStatement(); var r=s.executeQuery("SELECT MAX(id) FROM friend_requests")) { r.next(); return r.getLong(1); }
    }

    @Test void optionalSignatureSavesLiteralTextClearsAndPreservesAvatar() throws Exception {
        String signature = "第一行\n<b>纯文本 & emoji 😀</b>";
        when(req.getParameter("displayName")).thenReturn("新昵称"); when(req.getParameter("signature")).thenReturn(signature);
        call(new UpdateProfileServlet(),true);
        assertEquals(signature,field("signature",7)); assertEquals("新昵称",field("display_name",7));
        assertEquals("/avatar/a.png",field("avatar",7)); verify(resp).sendRedirect("profile.jsp");
        for (String empty : new String[]{"",null}) {
            resetRequest(); when(req.getParameter("displayName")).thenReturn("新昵称"); when(req.getParameter("signature")).thenReturn(empty);
            call(new UpdateProfileServlet(),true); assertEquals("",field("signature",7));
        }
    }

    @Test void longSignatureIsRejectedWithoutChangingStoredProfile() throws Exception {
        when(req.getParameter("displayName")).thenReturn("新昵称"); when(req.getParameter("signature")).thenReturn("字".repeat(201));
        call(new UpdateProfileServlet(),true);
        verify(resp).sendError(eq(400),anyString()); assertEquals("",field("signature",7)); assertNull(field("display_name",7));
        resetRequest(); when(req.getParameter("displayName")).thenReturn("新昵称"); when(req.getParameter("signature")).thenReturn("字".repeat(200));
        call(new UpdateProfileServlet(),true); assertEquals(200,field("signature",7).length());
    }

    @Test void successfulLoginsStoreLatestIpv4AndIpv6OnlyForThatUser() throws Exception {
        for (String ip : List.of("198.51.100.8","2001:db8::42")) {
            resetRequest(); when(req.getParameter("username")).thenReturn("alice"); when(req.getParameter("password")).thenReturn("pw");
            when(req.getRemoteAddr()).thenReturn(ip); when(req.getHeader("X-Forwarded-For")).thenReturn("203.0.113.123");
            call(new LoginServlet(),true); verify(resp).sendRedirect("/test/home.jsp");
            assertEquals(ip,field("ipaddress",7)); assertNull(field("ipaddress",9));
        }
    }

    @Test void failedOrBannedLoginsLeaveIpUntouched() throws Exception {
        when(req.getParameter("username")).thenReturn("alice"); when(req.getParameter("password")).thenReturn("wrong");
        when(req.getRemoteAddr()).thenReturn("198.51.100.8"); call(new LoginServlet(),true);
        assertEquals("192.0.2.1",field("ipaddress",7)); verify(resp,never()).sendRedirect(anyString());
        resetRequest(); try(var s=c.createStatement()){s.execute("UPDATE users SET is_banned=1 WHERE id=7");}
        when(req.getParameter("username")).thenReturn("alice"); when(req.getParameter("password")).thenReturn("pw");
        when(req.getRemoteAddr()).thenReturn("198.51.100.8"); call(new LoginServlet(),true);
        assertEquals("192.0.2.1",field("ipaddress",7)); verify(resp,never()).sendRedirect(anyString());
    }

    @Test void profileExposesOnlyPublicFieldsAndAllRelationshipStates() throws Exception {
        try(var s=c.createStatement()){s.execute("UPDATE users SET display_name='',signature='hello' WHERE id=9");}
        var data=profile(9);
        assertEquals(Set.of("id","name","avatar","signature","relationship"),data.keySet());
        assertEquals("bob",data.get("name").getAsString()); assertEquals("hello",data.get("signature").getAsString());
        assertEquals("/avatar/b.png",data.get("avatar").getAsString()); assertEquals("none",data.get("relationship").getAsString());
        verify(resp).setHeader("Cache-Control","no-store");
        assertEquals("self",profile(7).get("relationship").getAsString());
        FriendRequests.send(c,7,9); assertEquals("pending",profile(9).get("relationship").getAsString());
        FriendRequests.respond(c,9,requestId(),true); assertEquals("friends",profile(9).get("relationship").getAsString());
        FriendRequests.send(c,11,7); assertEquals("incoming",profile(11).get("relationship").getAsString());
        assertEquals("",profile(11).get("avatar").getAsString());
    }

    @Test void profileRequiresLoginAndValidAvailableUser() throws Exception {
        when(req.getSession(false)).thenReturn(null); call(new UserProfileServlet(),false); verify(resp).sendError(401);
        for(String id : new String[]{null,"bad","0","-1"}) {
            resetRequest(); when(req.getParameter("userId")).thenReturn(id); call(new UserProfileServlet(),false); verify(resp).sendError(400);
        }
        resetRequest(); when(req.getParameter("userId")).thenReturn("404"); call(new UserProfileServlet(),false); verify(resp).sendError(404);
        try(var s=c.createStatement()){s.execute("UPDATE users SET is_banned=1 WHERE id=9");}
        resetRequest(); when(req.getParameter("userId")).thenReturn("9"); call(new UserProfileServlet(),false); verify(resp).sendError(404);
    }

    @Test void boardAndFriendSnapshotIncludeAvatarAndDisplayName() throws Exception {
        try(var s=c.createStatement()){
            s.execute("UPDATE users SET display_name='昵称' WHERE id=9");
            s.execute("INSERT INTO posts VALUES(1,9,'hello',CURRENT_TIMESTAMP)");
        }
        call(new GetPostsServlet(),false);
        var captor=org.mockito.ArgumentCaptor.forClass(List.class);
        verify(req).setAttribute(eq("posts"),captor.capture());
        var post=(Map<?,?>)captor.getValue().get(0);
        assertEquals("/avatar/b.png",post.get("avatar")); assertEquals("昵称",post.get("username"));
        FriendRequests.send(c,7,9); FriendRequests.respond(c,9,requestId(),true);
        var friends=new Gson().toJsonTree(UnreadMessages.start(c).snapshot(c,7)).getAsJsonObject().getAsJsonArray("friends");
        assertEquals("/avatar/b.png",friends.get(0).getAsJsonObject().get("avatar").getAsString());
        assertEquals("昵称",friends.get(0).getAsJsonObject().get("name").getAsString());
    }
}
