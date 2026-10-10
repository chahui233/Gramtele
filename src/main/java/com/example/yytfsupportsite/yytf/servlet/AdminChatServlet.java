package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/AdminChatServlet")
public class AdminChatServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String msgIdStr = request.getParameter("messageId");

        if (msgIdStr == null) {
            response.sendRedirect("admin.jsp");
            return;
        }

        try (Connection conn = DBUtil.getConnection()) {
            int msgId = Integer.parseInt(msgIdStr);
            PreparedStatement ps = conn.prepareStatement("DELETE FROM chat_messages WHERE id = ?");
            ps.setInt(1, msgId);
            ps.executeUpdate();
            ps.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        response.sendRedirect("admin.jsp");
    }
}
