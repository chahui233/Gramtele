package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/AdminUserServlet")
public class AdminUserServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String action = request.getParameter("action");
        String userIdStr = request.getParameter("userId");

        if (userIdStr == null || action == null) {
            response.sendRedirect("admin.jsp");
            return;
        }

        try (Connection conn = DBUtil.getConnection()) {
            int userId = Integer.parseInt(userIdStr);
            PreparedStatement ps;

            switch (action) {
                case "ban":
                    ps = conn.prepareStatement("UPDATE users SET is_banned = 1 WHERE id = ?");
                    ps.setInt(1, userId);
                    ps.executeUpdate();
                    ps.close();
                    break;
                case "unban":
                    ps = conn.prepareStatement("UPDATE users SET is_banned = 0 WHERE id = ?");
                    ps.setInt(1, userId);
                    ps.executeUpdate();
                    ps.close();
                    break;
                case "delete":
                    // 删除用户记录，同时可扩展删除与该用户关联的内容
                    ps = conn.prepareStatement("DELETE FROM users WHERE id = ?");
                    ps.setInt(1, userId);
                    ps.executeUpdate();
                    ps.close();
                    break;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        response.sendRedirect("admin.jsp");
    }
}
