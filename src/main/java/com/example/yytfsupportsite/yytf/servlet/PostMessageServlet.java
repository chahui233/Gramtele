package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.*;
import java.util.regex.Pattern;

@WebServlet("/postMessage")
public class PostMessageServlet extends HttpServlet {
    // Keep this in sync with message-board.js. Formatting characters alone are not a visible post.
    private static final Pattern INVISIBLE_ONLY = Pattern.compile(
            "[\\p{Z}\\p{Cc}\\p{Cf}\\u034f\\u115f\\u1160\\u3164\\uffa0\\ufe00-\\ufe0f\\x{E0100}-\\x{E01EF}]*");

    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        request.setCharacterEncoding("UTF-8");
        HttpSession session = request.getSession(false);
        Integer userId = session == null ? null : (Integer) session.getAttribute("userId");
        if (userId == null) { response.sendError(HttpServletResponse.SC_UNAUTHORIZED); return; }
        String content = request.getParameter("content");  // 获取用户提交的留言内容
        if (content == null || INVISIBLE_ONLY.matcher(content).matches()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write("留言内容不能为空。");
            return;
        }

        // 默认留言状态为 "active"
        String status = "active";
        int likes = 0; // 留言初始点赞数为 0

        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO posts (user_id, content, status, likes) VALUES (?, ?, ?, ?)")) {
            ps.setInt(1, userId); // 绑定用户ID
            ps.setString(2, content); // 绑定留言内容
            ps.setString(3, status); // 绑定留言状态（默认为 active）
            ps.setInt(4, likes); // 设置初始点赞数为0

            ps.executeUpdate(); // 执行插入操作
            response.sendRedirect("home.jsp"); // 提交后重定向回主页
        } catch (SQLException e) {
            getServletContext().log("Post message failed", e);
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write("留言发布失败，请稍后重试。");
        }
    }
}
