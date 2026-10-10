package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.*;
import java.sql.Connection;

@WebServlet("/deleteUser")
public class DeleteUserServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        int userId = Integer.parseInt(request.getParameter("userId"));
        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps = conn.prepareStatement("DELETE FROM users WHERE id = ?");
            ps.setInt(1, userId);
            ps.executeUpdate();
            response.sendRedirect("admin.jsp");
        } catch (Exception e) {
            response.getWriter().println("删除用户失败：" + e.getMessage());
        }
    }
}