package com.example.yytfsupportsite.yytf.servlet;
import com.example.yytfsupportsite.yytf.util.*;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
@WebServlet("/register")
public class RegisterServlet extends HttpServlet {
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        req.setCharacterEncoding("UTF-8");
        String name = req.getParameter("username"), password = req.getParameter("password");
        if (name == null || name.isBlank() || name.trim().length() > 50 ||
                password == null || password.length() < 8 || password.length() > 1024) {
            req.setAttribute("msg", "用户名为 1–50 个字符，密码至少 8 个字符");
            req.getRequestDispatcher("/register.jsp").forward(req, resp); return;
        }
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement("INSERT INTO users(username, password) VALUES(?, ?)")) {
            ps.setString(1, name.trim()); ps.setString(2, Passwords.hash(password)); ps.executeUpdate();
            resp.sendRedirect(req.getContextPath() + "/login.jsp");
        } catch (SQLException e) {
            getServletContext().log("Registration failed", e);
            req.setAttribute("msg", e.getErrorCode() == 1062 ? "账号已被注册" : "注册失败，请稍后重试");
            req.getRequestDispatcher("/register.jsp").forward(req, resp);
        }
    }
}
