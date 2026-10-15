package com.example.yytfsupportsite.yytf.servlet;
import com.example.yytfsupportsite.yytf.util.*;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
@WebServlet("/login")
public class LoginServlet extends HttpServlet {
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        req.setCharacterEncoding("UTF-8");
        String username = req.getParameter("username"), password = req.getParameter("password");
        if (username == null || username.isBlank() || password == null || password.length() > 1024) {
            failure(req, resp, "请输入有效的用户名和密码"); return;
        }
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE username=?")) {
            ps.setString(1, username.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next() || !Passwords.verify(password, rs.getString("password"))) {
                    failure(req, resp, "用户名或密码错误"); return;
                }
                if (rs.getBoolean("is_banned")) { failure(req, resp, "账号已被禁用"); return; }
                int id = rs.getInt("id");
                if (!Passwords.isHash(rs.getString("password"))) {
                    try (PreparedStatement update = conn.prepareStatement("UPDATE users SET password=? WHERE id=?")) {
                        update.setString(1, Passwords.hash(password)); update.setInt(2, id); update.executeUpdate();
                    }
                }
                UnreadMessages unread = UnreadMessages.start(conn);
                // Tomcat resolves the client address. Forwarded headers require a trusted
                // reverse-proxy configuration; never accept arbitrary request headers here.
                try (PreparedStatement update = conn.prepareStatement("UPDATE users SET ipaddress=? WHERE id=?")) {
                    update.setString(1, req.getRemoteAddr()); update.setInt(2, id); update.executeUpdate();
                }
                HttpSession old = req.getSession(false);
                if (old != null) old.invalidate();
                HttpSession session = req.getSession(true);
                session.setAttribute("userId", id);
                session.setAttribute(UnreadMessages.SESSION_KEY, unread);
                session.setAttribute("username", rs.getString("username"));
                session.setAttribute("displayName", rs.getString("display_name"));
                session.setAttribute("avatar", rs.getString("avatar"));
                session.setAttribute("isAdmin", rs.getBoolean("is_admin"));
                session.setAttribute("announcementToken", java.util.UUID.randomUUID().toString());
                resp.sendRedirect(req.getContextPath() + "/home.jsp");
            }
        } catch (SQLException e) {
            getServletContext().log("Login failed (SQLState=" + e.getSQLState()
                    + ", vendorCode=" + e.getErrorCode() + "): " + e.getMessage(), e);
            resp.setStatus(503); failure(req, resp, "登录服务暂不可用，请检查数据库配置");
        }
    }
    private void failure(HttpServletRequest req, HttpServletResponse resp, String message) throws ServletException, IOException {
        req.setAttribute("loginMessage", message);
        req.getRequestDispatcher("/login.jsp").forward(req, resp);
    }
}
