package com.example.yytfsupportsite.yytf.util;

import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.sql.*;
import java.util.*;

/** Per-login read cursors; DB IDs prevent duplicate socket/poll deliveries from inflating counts. */
public final class UnreadMessages implements Serializable {
    private static final long serialVersionUID = 1L;
    public static final String SESSION_KEY = "chatUnread";
    private final long loginCursor;
    private final Map<Integer, Long> read = new HashMap<>();

    public UnreadMessages(long loginCursor) { this.loginCursor = loginCursor; }

    public static UnreadMessages start(Connection c) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COALESCE(MAX(id),0) FROM chat_messages");
             ResultSet rs = ps.executeQuery()) {
            rs.next(); return new UnreadMessages(rs.getLong(1));
        }
    }

    public static UnreadMessages from(HttpSession session, Connection c) throws SQLException {
        synchronized (session) {
            UnreadMessages state = (UnreadMessages) session.getAttribute(SESSION_KEY);
            // Sessions created before this upgrade start counting on their first chat visit.
            if (state == null) { state = start(c); session.setAttribute(SESSION_KEY, state); }
            return state;
        }
    }

    public synchronized Map<String, Object> snapshot(Connection c, int userId) throws SQLException {
        Map<Integer, Long> counts = new HashMap<>();
        String privateCursor = read.keySet().stream().anyMatch(id -> id != -1)
                ? "CASE c.user_id " + "WHEN ? THEN ? ".repeat((int) read.keySet().stream().filter(id -> id != -1).count()) + "ELSE ? END"
                : "?";
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT CASE WHEN c.receiver_id IS NULL THEN -1 ELSE c.user_id END AS conversation, COUNT(*) AS unread_count " +
                "FROM chat_messages c WHERE c.id>? AND c.user_id<>? AND COALESCE(c.deleted,0)=0 " +
                "AND (c.receiver_id IS NULL OR (c.receiver_id=? AND EXISTS (SELECT 1 FROM friends f " +
                "WHERE (f.user_id=? AND f.friend_id=c.user_id) OR (f.friend_id=? AND f.user_id=c.user_id)))) " +
                "AND c.id > CASE WHEN c.receiver_id IS NULL THEN ? ELSE " + privateCursor + " END " +
                "GROUP BY CASE WHEN c.receiver_id IS NULL THEN -1 ELSE c.user_id END")) {
            int p = 1;
            ps.setLong(p++, loginCursor); ps.setInt(p++, userId); ps.setInt(p++, userId);
            ps.setInt(p++, userId); ps.setInt(p++, userId); ps.setLong(p++, read.getOrDefault(-1, loginCursor));
            for (var entry : read.entrySet()) if (entry.getKey() != -1) {
                ps.setInt(p++, entry.getKey()); ps.setLong(p++, entry.getValue());
            }
            ps.setLong(p, loginCursor); ps.setQueryTimeout(8);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) counts.put(rs.getInt("conversation"), rs.getLong("unread_count"));
            }
        }
        List<Map<String, Object>> friends = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT u.id,COALESCE(NULLIF(u.display_name,''),u.username) AS name,u.avatar FROM users u " +
                "WHERE u.id<>? AND EXISTS (SELECT 1 FROM friends f WHERE (f.user_id=? AND f.friend_id=u.id) " +
                "OR (f.friend_id=? AND f.user_id=u.id)) ORDER BY u.id")) {
            ps.setInt(1, userId); ps.setInt(2, userId); ps.setInt(3, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) friends.add(Map.of("id", rs.getInt("id"), "name", rs.getString("name"),
                        "avatar", Objects.requireNonNullElse(rs.getString("avatar"), ""),
                        "unread", counts.getOrDefault(rs.getInt("id"), 0L)));
            }
        }
        // Independent of read cursors: another tab may acknowledge a new message before
        // the alert poll sees it. Never use an unread-count increase as an arrival signal.
        long latestIncoming = loginCursor;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT COALESCE(MAX(c.id),0) FROM chat_messages c WHERE c.id>? AND c.user_id<>? " +
                "AND COALESCE(c.deleted,0)=0 AND (c.receiver_id IS NULL OR (c.receiver_id=? " +
                "AND EXISTS (SELECT 1 FROM friends f WHERE (f.user_id=? AND f.friend_id=c.user_id) " +
                "OR (f.friend_id=? AND f.user_id=c.user_id))))")) {
            ps.setLong(1, loginCursor); ps.setInt(2, userId); ps.setInt(3, userId);
            ps.setInt(4, userId); ps.setInt(5, userId); ps.setQueryTimeout(8);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next(); latestIncoming = Math.max(loginCursor, rs.getLong(1));
            }
        }
        return Map.of("groupUnread", counts.getOrDefault(-1, 0L), "friends", friends,
                "latestIncoming", latestIncoming, "loginCursor", loginCursor);
    }

    public synchronized boolean markRead(Connection c, int userId, int conversation, long through) throws SQLException {
        if (conversation != -1 && !FriendRequests.areFriends(c, userId, conversation)) return false;
        String scope = conversation == -1 ? "receiver_id IS NULL" :
                "((user_id=? AND receiver_id=?) OR (user_id=? AND receiver_id=?))";
        try (PreparedStatement ps = c.prepareStatement("SELECT COALESCE(MAX(id),0) FROM chat_messages WHERE id<=? AND " + scope)) {
            ps.setLong(1, through);
            if (conversation != -1) {
                ps.setInt(2, userId); ps.setInt(3, conversation); ps.setInt(4, conversation); ps.setInt(5, userId);
            }
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                read.merge(conversation, Math.max(loginCursor, rs.getLong(1)), Math::max);
            }
        }
        return true;
    }
}
