package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/DeleteChatServlet")
public class DeleteChatServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        HttpSession session = request.getSession();
        String username = (String) session.getAttribute("username");

        if (!"admin".equals(username)) {
            response.sendRedirect("chat.jsp");
            return;
        }

        String idStr = request.getParameter("id");
        try {
            int id = Integer.parseInt(idStr);
            try (Connection conn = DBUtil.getConnection()) {
                PreparedStatement ps = conn.prepareStatement("DELETE FROM chat_messages WHERE id = ?");
                ps.setInt(1, id);
                ps.executeUpdate();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        response.sendRedirect("chat.jsp");
    }
}
