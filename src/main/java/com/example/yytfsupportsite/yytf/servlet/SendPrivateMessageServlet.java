package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;

@WebServlet("/SendPrivateMessageServlet")
public class SendPrivateMessageServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);
        Integer senderId = session == null ? null : (Integer) session.getAttribute("userId");
        if (senderId == null) { response.sendError(401); return; }
        int receiverId;
        try { receiverId = Integer.parseInt(request.getParameter("receiverId")); }
        catch (NumberFormatException e) { response.sendError(400); return; }
        if (receiverId == senderId) { response.sendError(400); return; }
        String content = request.getParameter("content");
        if (content == null || content.isBlank() || content.length() > 4000) { response.sendError(400); return; }

        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO private_messages (sender_id, receiver_id, content) " +
                            "SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?))");
            ps.setInt(1, senderId);
            ps.setInt(2, receiverId);
            ps.setString(3, content);
            ps.setInt(4, senderId); ps.setInt(5, receiverId); ps.setInt(6, receiverId); ps.setInt(7, senderId);
            ps.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
        response.sendRedirect("chat.jsp?friendId=" + receiverId);
    }
}
