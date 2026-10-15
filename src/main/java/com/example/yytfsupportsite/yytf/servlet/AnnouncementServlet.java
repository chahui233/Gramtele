package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import com.google.gson.Gson;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import java.util.*;

@WebServlet("/announcements")
public class AnnouncementServlet extends HttpServlet {
    private Integer userId(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        Integer id = session == null ? null : (Integer) session.getAttribute("userId");
        if (id == null) resp.sendError(401);
        return id;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        if (userId(req, resp) == null) return;
        List<Map<String, Object>> announcements = new ArrayList<>();
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT id, title, content, created_at FROM announcements ORDER BY id DESC LIMIT 50");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                announcements.add(Map.of("id", rs.getLong("id"), "title", rs.getString("title"),
                        "content", rs.getString("content"), "time", rs.getTimestamp("created_at").toString()));
            }
        } catch (SQLException e) {
            getServletContext().log("Announcement read failed; check announcements migration", e);
            resp.sendError(503); return;
        }
        resp.setHeader("Cache-Control", "no-store");
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write(new Gson().toJson(announcements));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Integer id = userId(req, resp);
        if (id == null) return;
        HttpSession session = req.getSession(false);
        // A per-login random token also protects installations behind a reverse proxy.
        Object token = session.getAttribute("announcementToken");
        if (!(token instanceof String) || !token.equals(req.getHeader("X-CSRF-Token"))) {
            resp.sendError(403); return;
        }
        req.setCharacterEncoding("UTF-8");
        String title = req.getParameter("title"), content = req.getParameter("content");
        if (title == null || title.isBlank() || title.strip().length() > 120
                || content == null || content.isBlank() || content.strip().length() > 10000) {
            resp.sendError(400); return;
        }
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement auth = conn.prepareStatement("SELECT username, is_banned FROM users WHERE id=?")) {
            auth.setInt(1, id);
            try (ResultSet rs = auth.executeQuery()) {
                // Deliberately restrict publishing to the named account, not display_name or a client flag.
                if (!rs.next() || !"admin".equals(rs.getString("username")) || rs.getBoolean("is_banned")) {
                    resp.sendError(403); return;
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO announcements (title, content, author_id) VALUES (?, ?, ?)")) {
                ps.setString(1, title.strip()); ps.setString(2, content.strip()); ps.setInt(3, id);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            getServletContext().log("Announcement publish failed", e);
            resp.sendError(503); return;
        }
        resp.setStatus(201);
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write("{\"ok\":true}");
    }
}
