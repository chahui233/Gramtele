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
        if (name == null || name.isBlank() || name.trim().length() > 50) {
            req.setAttribute("msg", "用户名应为 1–50 个字符");
            req.getRequestDispatcher("/register.jsp").forward(req, resp); return;
        }
        if (password == null || password.length() > 1024 || !RegistrationPasswordRules.evaluate(password).passes()) {
            req.setAttribute("msg", "密码必须满足全部 10 项要求，且不超过输入长度上限（1024）");
            req.getRequestDispatcher("/register.jsp").forward(req, resp); return;
        }
        HttpSession session = req.getSession(false);
        if (session == null) {
            challengeFailure(req, resp, "请先打开注册页面，获取本次随机挑战。"); return;
        }
        // Serialize submission and consumption: one solved challenge creates at most one account.
        synchronized (session) {
            var challenge = (RegistrationChallenge.Challenge) session.getAttribute(RegistrationChallenge.SESSION_KEY);
            if (challenge == null || challenge.expired(System.currentTimeMillis())
                    || !challenge.id().equals(req.getParameter("challengeId"))) {
                challengeFailure(req, resp, "随机挑战已失效或不属于当前会话，请使用页面上的当前挑战。"); return;
            }
            // Salt, target and difficulty come only from the server session, never POST parameters.
            if (!challenge.matches(password)) {
                challengeFailure(req, resp, "密码尚未通过第 11 项随机哈希挑战。"); return;
            }
            try (Connection conn = DBUtil.getConnection();
                 PreparedStatement ps = conn.prepareStatement("INSERT INTO users(username, password) VALUES(?, ?)")) {
                ps.setString(1, name.trim()); ps.setString(2, Passwords.hash(password)); ps.executeUpdate();
                session.removeAttribute(RegistrationChallenge.SESSION_KEY);
                resp.sendRedirect(req.getContextPath() + "/login.jsp");
            } catch (SQLException e) {
                getServletContext().log("Registration failed", e);
                req.setAttribute("msg", e.getErrorCode() == 1062 ? "账号已被注册" : "注册失败，请稍后重试");
                req.getRequestDispatcher("/register.jsp").forward(req, resp);
            }
        }
    }
    private void challengeFailure(HttpServletRequest req, HttpServletResponse resp, String message)
            throws ServletException, IOException {
        req.setAttribute("msg", message);
        req.getRequestDispatcher("/register.jsp").forward(req, resp);
    }
}
