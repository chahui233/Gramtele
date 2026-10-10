package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/vadminServlet")
public class vadminServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String action = request.getParameter("action");
        int userId = Integer.parseInt(request.getParameter("userId"));

        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps;
            if ("ban".equals(action)) {
                ps = conn.prepareStatement("UPDATE users SET is_banned = 1 WHERE id = ?");
                ps.setInt(1, userId);
                ps.executeUpdate();
                ps.close();
            } else if ("unban".equals(action)) {
                ps = conn.prepareStatement("UPDATE users SET is_banned = 0 WHERE id = ?");
                ps.setInt(1, userId);
                ps.executeUpdate();
                ps.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        response.sendRedirect("chatadmin.jsp");  // 重定向回 chatadmin.jsp
    }
}
