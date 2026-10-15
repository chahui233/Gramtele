package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.apache.catalina.startup.Tomcat;
import org.apache.jasper.servlet.JasperInitializer;
import org.apache.jasper.servlet.JspServlet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Path;
import java.sql.*;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatPagesTest {
    @TempDir Path directory;

    @Test void changedJspPagesCompileAndRenderInTomcat() throws Exception {
        Tomcat tomcat = new Tomcat();
        tomcat.setBaseDir(directory.toString());
        tomcat.setPort(0);
        tomcat.getConnector();
        var context = tomcat.addContext("/test", Path.of("src/main/webapp").toAbsolutePath().toString());
        context.setParentClassLoader(DBUtil.class.getClassLoader());
        context.addServletContainerInitializer(new JasperInitializer(), null);
        Tomcat.addServlet(context, "jsp", new JspServlet());
        context.addServletMappingDecoded("*.jsp", "jsp");
        Tomcat.addServlet(context, "render", new HttpServlet() {
            @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
                req.getSession().setAttribute("userId", 7);
                req.getSession().setAttribute("username", "admin".equals(req.getParameter("user")) ? "admin" : "alice");
                req.getSession().setAttribute("announcementToken", "test-login-token");
                if (req.getParameter("posts") == null) req.setAttribute("posts", List.of());
                if ("board".equals(req.getParameter("posts"))) req.setAttribute("posts", List.of(
                        Map.of("userId", "9", "username", "三大野猪", "avatar", "/avatar/b.png", "content",
                                "鲜我的新项目 大家帮忙点点Star：\nhttps://github.com/chahui233/introduce-my-hometown/" + "long-path-".repeat(20)
                                        + "\n第二段保留换行", "createdAt", "2026-10-13 13:03:09"),
                        Map.of("userId", "11", "username", "很长的用户名".repeat(20), "content",
                                "A".repeat(512) + "\n👩🏽‍💻 中文与 emoji", "createdAt", "2026-10-13 13:04:09"),
                        Map.of("userId", "12", "username", "普通用户", "content", "<b>普通文本</b>\n下一行",
                                "createdAt", "2026-10-13 13:05:09")));
                try (var db = mockStatic(DBUtil.class)) {
                    Connection conn = mock(Connection.class);
                    PreparedStatement ps = mock(PreparedStatement.class);
                    ResultSet rs = mock(ResultSet.class);
                    when(conn.prepareStatement(anyString())).thenReturn(ps);
                    when(ps.executeQuery()).thenReturn(rs);
                    db.when(DBUtil::getConnection).thenReturn(conn);
                    String page = req.getParameter("page");
                    if ("profile".equals(page)) {
                        when(rs.next()).thenReturn(true, false);
                        when(rs.getString("display_name")).thenReturn("Alice");
                        when(rs.getString("signature")).thenReturn("第一行\n</textarea><b>纯文本 & 😀</b>");
                    }
                    req.getRequestDispatcher("notifications".equals(page) ? "/notifications.jsp" :
                            "profile".equals(page) ? "/profile.jsp" :
                            "chat".equals(page) ? "/chat.jsp" : "/home.jsp").forward(req, resp);
                } catch (SQLException e) { throw new ServletException(e); }
            }
        });
        context.addServletMappingDecoded("/render", "render");
        try {
            tomcat.start();
            String base = "http://127.0.0.1:" + tomcat.getConnector().getLocalPort() + "/test/render";
            HttpClient client = HttpClient.newHttpClient();
            var admin = get(client, base + "?user=admin");
            assertEquals(200, admin.statusCode(), admin.body());
            assertTrue(admin.body().contains("id=\"announcementForm\""));
            assertTrue(admin.body().contains("data-login-token=\"test-login-token\""));
            assertTrue(admin.body().contains("id=\"messageAlerts\""));
            java.nio.file.Files.writeString(Path.of("target/browser-home.html"), admin.body());
            var board = get(client, base + "?posts=board");
            assertEquals(200, board.statusCode(), board.body());
            assertTrue(board.body().contains("&lt;b&gt;普通文本&lt;/b&gt;"));
            java.nio.file.Files.writeString(Path.of("target/browser-message-board.html"), board.body());
            var ordinary = get(client, base);
            assertEquals(200, ordinary.statusCode());
            assertFalse(ordinary.body().contains("id=\"announcementForm\""));
            assertTrue(ordinary.body().contains("id=\"announcementButton\""));
            var redirect = get(client, base + "?posts=missing");
            assertEquals(302, redirect.statusCode());
            var group = get(client, base + "?page=chat");
            assertEquals(200, group.statusCode(), group.body());
            assertTrue(group.body().contains("id=\"onlineButton\""));
            assertTrue(group.body().contains("id=\"emojiButton\""));
            assertTrue(group.body().indexOf("notifications.jsp") < group.body().indexOf("好友列表"));
            // Browser regressions consume HTML compiled by Jasper, rather than a hand-written page copy.
            java.nio.file.Files.writeString(Path.of("target/browser-chat.html"), group.body());
            var privateChat = get(client, base + "?page=chat&chatWith=9");
            assertEquals(200, privateChat.statusCode(), privateChat.body());
            assertFalse(privateChat.body().contains("id=\"onlineButton\""));
            assertTrue(privateChat.body().contains("data-chat-with=\"9\""));
            java.nio.file.Files.writeString(Path.of("target/browser-private-chat.html"), privateChat.body());
            var notifications = get(client, base + "?page=notifications");
            assertEquals(200, notifications.statusCode(), notifications.body());
            assertTrue(notifications.body().contains("id=\"notificationList\""));
            java.nio.file.Files.writeString(Path.of("target/browser-notifications.html"), notifications.body());
            var profile = get(client, base + "?page=profile");
            assertEquals(200, profile.statusCode(), profile.body());
            assertTrue(profile.body().contains("id=\"messageAlerts\""));
            assertTrue(profile.body().contains("&lt;/textarea&gt;&lt;b&gt;纯文本 &amp; 😀&lt;/b&gt;"));
            java.nio.file.Files.writeString(Path.of("target/browser-profile.html"), profile.body());
            var registrationClient = HttpClient.newBuilder().cookieHandler(new java.net.CookieManager()).build();
            var registration = get(registrationClient, base.replace("/render", "/register.jsp"));
            assertEquals(200, registration.statusCode(), registration.body());
            assertTrue(registration.body().contains("data-password-rule=\"10\""));
            assertTrue(registration.body().contains("data-password-rule=\"11\""));
            var target = java.util.regex.Pattern.compile("data-challenge-prefix=\"([a-f0-9]{12})\"").matcher(registration.body());
            assertTrue(target.find());
            var reloaded = get(registrationClient, base.replace("/render", "/register.jsp"));
            assertTrue(reloaded.body().contains("data-challenge-prefix=\"" + target.group(1) + "\""));
            java.nio.file.Files.writeString(Path.of("target/browser-register.html"), registration.body());
        } finally {
            tomcat.stop(); tomcat.destroy();
        }
    }
    private HttpResponse<String> get(HttpClient client, String url) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
