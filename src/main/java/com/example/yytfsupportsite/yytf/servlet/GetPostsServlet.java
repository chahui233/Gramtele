package com.example.yytfsupportsite.yytf.servlet;

import jakarta.servlet.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.sql.*;
import java.util.*;
import com.example.yytfsupportsite.yytf.util.DBUtil;

@WebServlet("/GetPostsServlet")
public class GetPostsServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        int page = 1;
        int pageSize = 10;

        if (request.getParameter("page") != null) {
            page = Integer.parseInt(request.getParameter("page"));
        }

        List<Map<String, String>> posts = new ArrayList<>();
        int totalCount = 0;

        try (Connection conn = DBUtil.getConnection()) {
            // 总数
            PreparedStatement countStmt = conn.prepareStatement("SELECT COUNT(*) FROM posts");
            ResultSet countRs = countStmt.executeQuery();
            if (countRs.next()) {
                totalCount = countRs.getInt(1);
            }

            int offset = (page - 1) * pageSize;
            String sql = "SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, pageSize);
            ps.setInt(2, offset);

            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, String> post = new HashMap<>();
                post.put("userId", rs.getString("user_id"));
                post.put("username", rs.getString("username"));
                post.put("content", rs.getString("content"));
                post.put("createdAt", rs.getString("created_at"));
                posts.add(post);
            }

            rs.close();
            ps.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        int totalPages = (int) Math.ceil(totalCount / 10.0);

        request.setAttribute("posts", posts);
        request.setAttribute("totalPages", totalPages);
        request.setAttribute("currentPage", page);

        request.getRequestDispatcher("home.jsp").forward(request, response);
    }
}
