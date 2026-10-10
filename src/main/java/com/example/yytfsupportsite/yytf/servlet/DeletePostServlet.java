package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.*;
import java.sql.Connection;
@WebServlet("/deletePost")
public class DeletePostServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        int postId = Integer.parseInt(request.getParameter("postId"));
        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps = conn.prepareStatement("DELETE FROM posts WHERE id = ?");
            ps.setInt(1, postId);
            ps.executeUpdate();
            response.sendRedirect("admin.jsp");
        } catch (Exception e) {
            response.getWriter().println("删除留言失败：" + e.getMessage());
        }
    }
}
