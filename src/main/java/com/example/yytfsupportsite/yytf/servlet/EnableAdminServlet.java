package com.example.yytfsupportsite.yytf.servlet;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.*;

import java.io.IOException;

@WebServlet("/EnableAdminServlet")
public class EnableAdminServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession();
        session.setAttribute("adminMode", true);
        response.setStatus(200);
    }
}
