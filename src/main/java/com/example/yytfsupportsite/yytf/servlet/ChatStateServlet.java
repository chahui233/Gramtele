package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import com.google.gson.Gson;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;

@WebServlet("/chat-state")
public class ChatStateServlet extends HttpServlet {
    @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        handle(req, resp, false);
    }
    @Override protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        handle(req, resp, true);
    }
    private void handle(HttpServletRequest req, HttpServletResponse resp, boolean mark) throws IOException {
        Integer userId = SocialAuth.user(req, resp, mark);
        if (userId == null) return;
        int conversation = -1;
        long through = 0;
        if (mark) {
            try {
                conversation = Integer.parseInt(req.getParameter("chatWith"));
                through = Long.parseLong(req.getParameter("through"));
            } catch (NumberFormatException e) { resp.sendError(400); return; }
            if ((conversation != -1 && (conversation <= 0 || conversation == userId)) || through < 0) {
                resp.sendError(400); return;
            }
        }
        try (Connection c = DBUtil.getConnection()) {
            UnreadMessages state = UnreadMessages.from(req.getSession(false), c);
            if (mark && !state.markRead(c, userId, conversation, through)) { resp.sendError(403); return; }
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write(new Gson().toJson(state.snapshot(c, userId)));
        } catch (SQLException e) {
            getServletContext().log("Unread counts failed", e); resp.sendError(503);
        }
    }
}
