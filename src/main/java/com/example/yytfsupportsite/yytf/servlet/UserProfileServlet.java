package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import com.google.gson.Gson;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import java.util.Map;
import java.util.Objects;

@WebServlet("/user-profile")
public class UserProfileServlet extends HttpServlet {
    @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Integer viewer = SocialAuth.user(req, resp, false);
        if (viewer == null) return;
        int id;
        try { id = Integer.parseInt(req.getParameter("userId")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (id <= 0) { resp.sendError(400); return; }
        try (Connection c = DBUtil.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "SELECT id,COALESCE(NULLIF(display_name,''),username) AS name,avatar,signature " +
                     "FROM users WHERE id=? AND COALESCE(is_banned,0)=0")) {
            ps.setInt(1, id); ps.setQueryTimeout(8);
            String name, avatar, signature;
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) { resp.sendError(404); return; }
                name = rs.getString("name");
                avatar = Objects.requireNonNullElse(rs.getString("avatar"), "");
                signature = Objects.requireNonNullElse(rs.getString("signature"), "");
            }
            String relationship = id == viewer ? "self" : FriendRequests.areFriends(c, viewer, id) ? "friends" : "none";
            if ("none".equals(relationship)) {
                try (PreparedStatement pending = c.prepareStatement(
                        "SELECT sender_id FROM friend_requests WHERE status='pending' AND " +
                        "((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) ORDER BY id DESC LIMIT 1")) {
                    pending.setInt(1, viewer); pending.setInt(2, id); pending.setInt(3, id); pending.setInt(4, viewer);
                    try (ResultSet rs = pending.executeQuery()) {
                        if (rs.next()) relationship = rs.getInt(1) == viewer ? "pending" : "incoming";
                    }
                }
            }
            // Explicit public fields only: login IP, password and account flags stay private.
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write(new Gson().toJson(Map.of("id", id, "name", name, "avatar", avatar,
                    "signature", signature, "relationship", relationship)));
        } catch (SQLException e) {
            getServletContext().log("User profile load failed", e); resp.sendError(503);
        }
    }
}
