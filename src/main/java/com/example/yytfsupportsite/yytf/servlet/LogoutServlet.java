package com.example.yytfsupportsite.yytf.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;

@WebServlet("/logout")
public class LogoutServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // 清除 Session
        HttpSession session = request.getSession(false); // 获取已有 session
        if (session != null) {
            session.invalidate();
        }

        // 重定向回登录页
        response.sendRedirect("login.jsp");
    }
}
