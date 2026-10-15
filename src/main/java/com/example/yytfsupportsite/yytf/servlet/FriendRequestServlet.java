package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import com.google.gson.Gson;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import java.util.Map;

@WebServlet("/friend-requests")
public class FriendRequestServlet extends HttpServlet {
    @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Integer id = SocialAuth.user(req, resp, false);
        if (id == null) return;
        long before;
        try { before = req.getParameter("before") == null ? Long.MAX_VALUE : Long.parseLong(req.getParameter("before")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (before <= 0) { resp.sendError(400); return; }
        try (Connection c = DBUtil.getConnection()) {
            Object result = "count".equals(req.getParameter("view"))
                    ? Map.of("pending", FriendRequests.pendingCount(c, id)) : FriendRequests.inbox(c, id, before);
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write(new Gson().toJson(result));
        } catch (SQLException e) {
            getServletContext().log("Friend notifications failed; check friend-requests.sql migration", e); resp.sendError(503);
        }
    }

    @Override protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Integer userId = SocialAuth.user(req, resp, true);
        if (userId == null) return;
        long requestId;
        try { requestId = Long.parseLong(req.getParameter("requestId")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        String action = req.getParameter("action");
        if (requestId <= 0 || !("accept".equals(action) || "reject".equals(action))) { resp.sendError(400); return; }
        try (Connection c = DBUtil.getConnection()) {
            String result = FriendRequests.respond(c, userId, requestId, "accept".equals(action));
            if ("missing".equals(result)) { resp.sendError(404); return; }
            if ("invalid".equals(result)) { resp.sendError(409); return; }
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write(new Gson().toJson(Map.of("status", result)));
        } catch (SQLException e) {
            getServletContext().log("Friend request response failed", e); resp.sendError(503);
        }
    }
}
