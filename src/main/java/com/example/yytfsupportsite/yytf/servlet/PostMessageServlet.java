package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.*;

@WebServlet("/postMessage")
public class PostMessageServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String content = request.getParameter("content");  // 获取用户提交的留言内容
        HttpSession session = request.getSession();
        int userId = (int) session.getAttribute("userId");  // 获取当前登录用户的ID

        // 默认留言状态为 "active"
        String status = "active";
        int likes = 0; // 留言初始点赞数为 0

        try (Connection conn = DBUtil.getConnection()) {
            String query = "INSERT INTO posts (user_id, content, status, likes) VALUES (?, ?, ?, ?)";
            PreparedStatement ps = conn.prepareStatement(query);
            ps.setInt(1, userId); // 绑定用户ID
            ps.setString(2, content); // 绑定留言内容
            ps.setString(3, status); // 绑定留言状态（默认为 active）
            ps.setInt(4, likes); // 设置初始点赞数为0

            ps.executeUpdate(); // 执行插入操作
            response.sendRedirect("home.jsp"); // 提交后重定向回主页
        } catch (Exception e) {
            e.printStackTrace();
            response.getWriter().println("留言发布失败：" + e.getMessage());
        }
    }
}
