package com.example.yytfsupportsite.yytf.util;

import java.sql.*;
import java.util.*;

/** All friendship mutations lock the two user rows in ID order, including deletion. */
public final class FriendRequests {
    private FriendRequests() {}

    public static boolean areFriends(Connection c, int first, int second) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT 1 FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)")) {
            ps.setInt(1, first); ps.setInt(2, second); ps.setInt(3, second); ps.setInt(4, first);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    private static boolean lockUsers(Connection c, int first, int second) throws SQLException {
        if (first <= 0 || second <= 0 || first == second) return false;
        boolean available = true;
        for (int id : new int[]{Math.min(first, second), Math.max(first, second)}) {
            try (PreparedStatement ps = c.prepareStatement("SELECT is_banned FROM users WHERE id=? FOR UPDATE")) {
                ps.setInt(1, id);
                try (ResultSet rs = ps.executeQuery()) { available &= rs.next() && !rs.getBoolean(1); }
            }
        }
        return available;
    }

    public static String send(Connection c, int sender, int recipient) throws SQLException {
        c.setAutoCommit(false);
        try {
            if (!lockUsers(c, sender, recipient)) return "invalid";
            if (areFriends(c, sender, recipient)) return "already";
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT sender_id FROM friend_requests WHERE status='pending' AND " +
                    "((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) FOR UPDATE")) {
                ps.setInt(1, sender); ps.setInt(2, recipient); ps.setInt(3, recipient); ps.setInt(4, sender);
                try (ResultSet rs = ps.executeQuery()) {
                    // Crossed requests still need explicit acceptance by the recipient.
                    if (rs.next()) return rs.getInt(1) == sender ? "pending" : "incoming";
                }
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO friend_requests(sender_id,recipient_id) VALUES (?,?)")) {
                ps.setInt(1, sender); ps.setInt(2, recipient); ps.executeUpdate();
            }
            c.commit();
            return "success";
        } finally { c.rollback(); c.setAutoCommit(true); }
    }

    public static String respond(Connection c, int recipient, long requestId, boolean accept) throws SQLException {
        int sender;
        // Lookup before the transaction, so its snapshot starts after acquiring user locks.
        try (PreparedStatement ps = c.prepareStatement("SELECT sender_id FROM friend_requests WHERE id=? AND recipient_id=?")) {
            ps.setLong(1, requestId); ps.setInt(2, recipient);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return "missing";
                sender = rs.getInt(1);
            }
        }
        c.setAutoCommit(false);
        try {
            boolean available = lockUsers(c, sender, recipient);
            if (accept && !available) return "invalid";
            try (PreparedStatement ps = c.prepareStatement("SELECT status FROM friend_requests WHERE id=? AND recipient_id=? FOR UPDATE")) {
                ps.setLong(1, requestId); ps.setInt(2, recipient);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return "missing";
                    if (!"pending".equals(rs.getString(1))) return "resolved";
                }
            }
            if (accept) {
                // Repair a legacy one-way friendship without duplicating its existing row.
                for (int[] pair : new int[][]{{sender, recipient}, {recipient, sender}}) {
                    try (PreparedStatement ps = c.prepareStatement("INSERT INTO friends(user_id,friend_id) " +
                            "SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM friends WHERE user_id=? AND friend_id=?)")) {
                        ps.setInt(1, pair[0]); ps.setInt(2, pair[1]); ps.setInt(3, pair[0]); ps.setInt(4, pair[1]);
                        ps.executeUpdate();
                    }
                }
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE friend_requests SET status=?, responded_at=CURRENT_TIMESTAMP WHERE id=?")) {
                ps.setString(1, accept ? "accepted" : "rejected"); ps.setLong(2, requestId); ps.executeUpdate();
            }
            c.commit();
            return accept ? "accepted" : "rejected";
        } finally { c.rollback(); c.setAutoCommit(true); }
    }

    public static boolean delete(Connection c, int userId, int friendId) throws SQLException {
        c.setAutoCommit(false);
        try {
            // Lock even banned users: an existing friendship can always be removed.
            lockUsers(c, userId, friendId);
            int rows;
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)")) {
                ps.setInt(1, userId); ps.setInt(2, friendId); ps.setInt(3, friendId); ps.setInt(4, userId);
                rows = ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE friend_requests SET status='cancelled', responded_at=CURRENT_TIMESTAMP " +
                    "WHERE status='pending' AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))")) {
                ps.setInt(1, userId); ps.setInt(2, friendId); ps.setInt(3, friendId); ps.setInt(4, userId); ps.executeUpdate();
            }
            c.commit();
            return rows > 0;
        } finally { c.rollback(); c.setAutoCommit(true); }
    }

    public static List<Map<String, Object>> inbox(Connection c, int recipient, long before) throws SQLException {
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT r.id,r.sender_id,r.status,r.created_at,u.username,u.display_name,u.avatar FROM friend_requests r " +
                "JOIN users u ON u.id=r.sender_id WHERE r.recipient_id=? AND r.id<? ORDER BY r.id DESC LIMIT 50")) {
            ps.setInt(1, recipient); ps.setLong(2, before);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", rs.getLong("id")); item.put("senderId", rs.getInt("sender_id"));
                    item.put("name", Objects.requireNonNullElse(rs.getString("display_name"), rs.getString("username")));
                    item.put("avatar", rs.getString("avatar")); item.put("status", rs.getString("status"));
                    item.put("time", rs.getTimestamp("created_at").toString()); items.add(item);
                }
            }
        }
        return items;
    }

    public static long pendingCount(Connection c, int userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM friend_requests r JOIN users u ON u.id=r.sender_id " +
                "WHERE r.recipient_id=? AND r.status='pending'")) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getLong(1); }
        }
    }
}
