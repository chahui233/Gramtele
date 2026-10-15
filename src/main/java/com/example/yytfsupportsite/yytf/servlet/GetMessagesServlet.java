package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@WebServlet("/GetMessagesServlet")
public class GetMessagesServlet extends HttpServlet {
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        HttpSession session = req.getSession(false);
        Integer userId = session == null ? null : (Integer) session.getAttribute("userId");
        if (userId == null) { resp.sendError(401); return; }

        String chatWithStr = req.getParameter("chatWith");
        int chatWith;
        try { chatWith = chatWithStr != null ? Integer.parseInt(chatWithStr) : -1; }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (chatWith != -1 && (chatWith <= 0 || chatWith == userId)) { resp.sendError(400); return; }
        long after;
        try { after = req.getParameter("after") == null ? 0 : Long.parseLong(req.getParameter("after")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (after < 0) { resp.sendError(400); return; }
        Long before = null;
        try {
            if (req.getParameter("before") != null) before = Long.parseLong(req.getParameter("before"));
        } catch (NumberFormatException e) { resp.sendError(400); return; }
        if (before != null && before <= 0) { resp.sendError(400); return; }
        int limit;
        try { limit = req.getParameter("limit") == null ? 30 : Integer.parseInt(req.getParameter("limit")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (limit < 1 || limit > 100 || (before != null && after != 0)) { resp.sendError(400); return; }
        boolean latestPage = before == null && req.getParameter("after") == null;
        boolean hasMore;

        List<Map<String, Object>> msgs = new ArrayList<>();
        try (Connection c = DBUtil.getConnection()) {
            if (chatWith != -1 && !areFriends(c, userId, chatWith)) { resp.sendError(403); return; }
            PreparedStatement ps;
            String scope = chatWith == -1 ? "c.receiver_id IS NULL" :
                    "((c.user_id=? AND c.receiver_id=?) OR (c.user_id=? AND c.receiver_id=?))";
            String direction = before != null ? "c.id < ?" : latestPage ? "1=1" : "c.id > ?";
            String order = before != null || latestPage ? "DESC" : "ASC";
            ps = c.prepareStatement(
                    "SELECT c.id, c.user_id, c.receiver_id, c.content, c.image_url, c.timestamp, u.display_name, u.username, u.avatar " +
                            "FROM chat_messages c JOIN users u ON c.user_id=u.id WHERE " + scope + " AND " + direction +
                            " ORDER BY c.id " + order + " LIMIT ?");
            int parameter = 1;
            if (chatWith != -1) {
                ps.setInt(parameter++, userId); ps.setInt(parameter++, chatWith);
                ps.setInt(parameter++, chatWith); ps.setInt(parameter++, userId);
            }
            if (before != null) ps.setLong(parameter++, before);
            else if (!latestPage) ps.setLong(parameter++, after);
            ps.setInt(parameter, limit + 1);
            try (ps) {
                ps.setQueryTimeout(8);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> m = new HashMap<>();
                        m.put("id", rs.getLong("id"));
                        String name = rs.getString("display_name");
                        if (name == null) name = rs.getString("username");
                        m.put("senderName", name);
                        m.put("senderId", rs.getInt("user_id"));
                        m.put("chatWith", rs.getObject("receiver_id") == null ? -1 : rs.getInt("receiver_id"));
                        String avatar = rs.getString("avatar");
                        m.put("avatar", avatar != null && !avatar.isEmpty() ? avatar : "images/taffy1.jpg");
                        m.put("content", rs.getString("content"));
                        m.put("image", rs.getString("image_url"));
                        java.sql.Timestamp timestamp = rs.getTimestamp("timestamp");
                        m.put("time", timestamp == null ? "" : timestamp.toString());
                        msgs.add(m);
                    }
                }
            }
            hasMore = msgs.size() > limit;
            if (hasMore) msgs.remove(msgs.size() - 1);
            if (before != null || latestPage) java.util.Collections.reverse(msgs);
        } catch (SQLException e) {
            getServletContext().log("Chat history load failed for user=" + userId + ", chatWith=" + chatWith, e);
            resp.sendError(503);
            return;
        }
        resp.setContentType("application/json;charset=UTF-8");
        resp.setHeader("Cache-Control", "no-store");
        resp.setHeader("X-Has-More", Boolean.toString(hasMore));
        resp.getWriter().write(new Gson().toJson(msgs));
    }

    private boolean areFriends(Connection conn, int first, int second) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                     "SELECT 1 FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?) LIMIT 1")) {
            ps.setInt(1, first); ps.setInt(2, second); ps.setInt(3, second); ps.setInt(4, first);
            ps.setQueryTimeout(8);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }
}
