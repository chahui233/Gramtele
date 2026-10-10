package com.example.yytfsupportsite.yytf.servlet;

import jakarta.servlet.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;

@WebServlet("/DisableAdminServlet")
public class DisableAdminServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession();
        session.removeAttribute("adminMode");
        response.setStatus(200);
    }
}
