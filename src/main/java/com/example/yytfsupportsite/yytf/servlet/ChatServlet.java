package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import com.example.yytfsupportsite.yytf.websocket.ChatWebSocket;

import java.io.*;
import java.sql.*;
import java.util.UUID;
import java.util.Set;

@WebServlet("/ChatServlet")
@MultipartConfig

public class ChatServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        HttpSession session = request.getSession();

        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            response.sendRedirect("login.jsp");
            return;
        }


        String content = request.getParameter("content");
        content=sanitize(content);
        String chatWithIdParam = request.getParameter("chatWithId");
        Part imagePart = request.getPart("image");

        boolean hasText = content != null && !content.trim().isEmpty();
        boolean hasImage = imagePart != null && imagePart.getSize() > 0;

        if (!hasText && !hasImage) {
            if (chatWithIdParam != null && !chatWithIdParam.equals("-1")) {
                response.sendRedirect("chat.jsp?chatWith=" + chatWithIdParam);
            } else {
                response.sendRedirect("chat.jsp");
            }
            return;
        }

        int chatWithId = -1; // 默认是群聊
        if (chatWithIdParam != null && !chatWithIdParam.isEmpty()) {
            try {
                chatWithId = Integer.parseInt(chatWithIdParam);
            } catch (NumberFormatException ignored) {}
        }

        if (chatWithId != -1) {
            try {
                if (chatWithId == userId || !areFriends(userId, chatWithId)) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "只能向好友发送私聊消息");
                    return;
                }
            } catch (SQLException e) {
                response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                return;
            }
        }

        // 处理图片上传
        String imageUrl = null;
        if (hasImage) {
            String contentType = imagePart.getContentType();
            if (imagePart.getSize() > 5 * 1024 * 1024L ||
                    contentType == null || !Set.of("image/jpeg", "image/png", "image/gif", "image/webp").contains(contentType)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "图片格式或大小不合法");
                return;
            }
            String uploadPath = "/www/chat_images/";
            File uploadDir = new File(uploadPath);
            if (!uploadDir.exists()) uploadDir.mkdirs();
            String extension = switch (contentType) {
                case "image/png" -> ".png";
                case "image/gif" -> ".gif";
                case "image/webp" -> ".webp";
                default -> ".jpg";
            };
            String fileName = UUID.randomUUID() + extension;
            String fullPath = uploadPath + fileName;

            // 写入文件
            imagePart.write(fullPath);

            // 设置返回给前端的访问路径
            imageUrl = "/chat_images/" + fileName;
        }


        // 存入数据库
        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps;
            if (chatWithId == -1) {
                // 群聊：没有 receiver_id
                ps = conn.prepareStatement(
                        "INSERT INTO chat_messages (user_id, content, image_url, timestamp) " +
                                "VALUES (?, ?, ?, NOW())", Statement.RETURN_GENERATED_KEYS
                );
                ps.setInt(1, userId);
                ps.setString(2, hasText ? content : null);
                ps.setString(3, imageUrl);
            } else {
                // 私聊：有 receiver_id
                ps = conn.prepareStatement(
                        "INSERT INTO chat_messages (user_id, content, image_url, timestamp, receiver_id) " +
                                "VALUES (?, ?, ?, NOW(), ?)", Statement.RETURN_GENERATED_KEYS
                );
                ps.setInt(1, userId);
                ps.setString(2, hasText ? content : null);
                ps.setString(3, imageUrl);
                ps.setInt(4, chatWithId);
            }
            ps.executeUpdate();
            long messageId;
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) throw new SQLException("Missing generated chat message ID");
                messageId = keys.getLong(1);
            }
            ps.close();
            // 获取发送者昵称和头像
            String senderName = (String) session.getAttribute("displayName");
            if (senderName == null) senderName = (String) session.getAttribute("username");

            String avatar = (String) session.getAttribute("avatar");
            if (avatar == null || avatar.isEmpty()) avatar = "images/taffy1.jpg";

// 当前时间
            String now = new java.sql.Timestamp(System.currentTimeMillis()).toString();

// 推送消息
            ChatWebSocket.pushMessage(
                    messageId,
                    userId,
                    chatWithId == -1 ? null : chatWithId,
                    senderName,
                    avatar,
                    hasText ? content : "",
                    imageUrl != null ? imageUrl : "",
                    now
            );

        } catch (Exception e) {
            getServletContext().log("Failed to save chat message", e);
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "消息发送失败，请稍后重试");
            return;
        }

        // 重定向回聊天页面
        if (chatWithId == -1) {
            response.sendRedirect("chat.jsp");
        } else {
            response.sendRedirect("chat.jsp?chatWith=" + chatWithId);
        }
    }

    public static String sanitize(String input) {
        if (input == null) return null;
        String value = input.trim();
        return value.length() > 4000 ? value.substring(0, 4000) : value;
    }

    private boolean areFriends(int first, int second) throws SQLException {
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT 1 FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?) LIMIT 1")) {
            ps.setInt(1, first); ps.setInt(2, second); ps.setInt(3, second); ps.setInt(4, first);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }
}
