package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet("/FetchMessagesServlet")
public class FetchMessagesServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        int userId = (int) request.getSession().getAttribute("userId");
        String chatWithParam = request.getParameter("chatWith");
        int chatWithId = chatWithParam != null ? Integer.parseInt(chatWithParam) : -1;

        response.setContentType("application/json;charset=UTF-8");
        JSONArray messages = new JSONArray();

        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps;
            if (chatWithId == -1) {
                ps = conn.prepareStatement(
                        "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                                "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                                "WHERE c.receiver_id IS NULL ORDER BY c.timestamp ASC"
                );
            } else {
                ps = conn.prepareStatement(
                        "SELECT c.*, COALESCE(u.display_name, u.username) AS show_name, u.avatar " +
                                "FROM chat_messages c JOIN users u ON c.user_id = u.id " +
                                "WHERE (c.user_id=? AND c.receiver_id=?) OR (c.user_id=? AND c.receiver_id=?) " +
                                "ORDER BY c.timestamp ASC"
                );
                ps.setInt(1, userId);
                ps.setInt(2, chatWithId);
                ps.setInt(3, chatWithId);
                ps.setInt(4, userId);
            }

            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                JSONObject obj = new JSONObject();
                obj.put("senderName", rs.getString("show_name"));
                obj.put("avatar", rs.getString("avatar") != null ? rs.getString("avatar") : "images/taffy1.jpg");
                obj.put("content", rs.getString("content"));
                obj.put("image", rs.getString("image_url"));
                obj.put("time", rs.getTimestamp("timestamp").toString());
                messages.put(obj);
            }

            rs.close();
            ps.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        PrintWriter out = response.getWriter();
        out.print(messages.toString());
        out.flush();
    }
}
